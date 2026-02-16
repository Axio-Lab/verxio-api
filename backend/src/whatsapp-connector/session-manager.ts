import makeWASocket, {
  type WASocket,
  type WAMessage,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
} from "baileys";
import { prisma } from "../lib/prisma";
import { usePostgresAuthState } from "./auth-adapter";
import { normalizeMessage } from "./normalize-message";
import type { IncomingWhatsAppEvent, WhatsAppPayload } from "./types";

const WORKER_ID = process.env.WHATSAPP_CONNECTOR_WORKER_ID || "default";

/** Silent logger so we only see our own "[WhatsApp Connector] Incoming" logs, not Baileys decrypt/retry noise */
const silentLogger = {
  level: "silent" as const,
  child: () => silentLogger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

export type OnIncomingCallback = (event: IncomingWhatsAppEvent) => Promise<void>;

export interface SessionInfo {
  sessionId: string;
  integrationId?: string | null;
  credentialId?: string | null;
  socket: WASocket;
}

const sessions = new Map<string, SessionInfo>();

export async function getSessionsToRun(): Promise<
  { id: string; integrationId: string | null; credentialId: string | null }[]
> {
  const list = await (prisma as any).whatsAppSession.findMany({
    where: {
      status: { in: ["open", "connecting", "qr"] },
      OR: [{ workerId: null }, { workerId: WORKER_ID }],
    },
    select: { id: true, integrationId: true, credentialId: true },
  });
  return list;
}

export async function startSession(
  sessionId: string,
  onIncoming: OnIncomingCallback
): Promise<{ qr?: string; status: string }> {
  if (sessions.has(sessionId)) {
    const info = sessions.get(sessionId)!;
    return { status: "open" };
  }

  const row = await (prisma as any).whatsAppSession.findUnique({
    where: { id: sessionId },
  });
  if (!row) {
    throw new Error(`WhatsAppSession ${sessionId} not found`);
  }

  // Only clear auth when stuck in connecting/qr (e.g. corrupt state). Do NOT clear when
  // "disconnected" — that can be after pairing (515 restart required) and we need to reconnect with saved creds.
  const shouldClearAuth = row.status === "connecting" || row.status === "qr";
  await (prisma as any).whatsAppSession.update({
    where: { id: sessionId },
    data: {
      status: "connecting",
      workerId: WORKER_ID,
      ...(shouldClearAuth ? { authState: null } : {}),
    },
  });

  const { state, saveCreds } = await usePostgresAuthState(prisma as any, sessionId);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ["Verxio", "Chrome", "1.0.0"],
    syncFullHistory: false,
    logger: silentLogger,
  });

  sock.ev.on("creds.update", saveCreds);

  let resolveFirstQr: (qr: string | undefined) => void;
  const firstQrPromise = new Promise<string | undefined>((resolve) => {
    resolveFirstQr = (qr: string | undefined) => resolve(qr);
  });
  const QR_WAIT_MS = 20000;

  (sock as any).__connectionStatus = "connecting";
  sock.ev.on("connection.update", async (update) => {
    const qr = (update as any).qr;
    if (qr) {
      await (prisma as any).whatsAppSession.update({
        where: { id: sessionId },
        data: { status: "qr" },
      });
      (sock as any).__lastQr = qr;
      (sock as any).__connectionStatus = "qr";
      resolveFirstQr(qr);
    }
    const status = update.connection;
    if (status === "open") {
      (sock as any).__connectionStatus = "open";
      resolveFirstQr(undefined);
      const meId = (state.creds as any).me?.id as string | undefined;
      const phone = meId?.split(":")[0];
      (sock as any).__ownerJid = phone ? `${phone}@s.whatsapp.net` : null;
      await (prisma as any).whatsAppSession.update({
        where: { id: sessionId },
        data: {
          status: "open",
          phoneNumber: phone || null,
          lastUsedAt: new Date(),
        },
      });
    } else if (status === "close") {
      (sock as any).__connectionStatus = "close";
      sessions.delete(sessionId);
      const reason = (update as any).lastDisconnect?.error as any;
      const isLogout = reason?.output?.logoutRequested;
      const code = reason?.output?.statusCode;
      const data = reason?.data ?? reason?.output?.data;
      const isDeviceRemoved =
        data?.content?.[0]?.attrs?.type === "device_removed" ||
        (code === 401 && (reason?.message || "").includes("conflict"));
      const shouldClearAuth =
        isLogout ||
        code === DisconnectReason.loggedOut ||
        code === DisconnectReason.connectionReplaced ||
        isDeviceRemoved;
      if (shouldClearAuth) {
        await (prisma as any).whatsAppSession.update({
          where: { id: sessionId },
          data: {
            status: "disconnected",
            authState: null,
            workerId: null,
            phoneNumber: null,
          },
        });
      } else if (code === DisconnectReason.restartRequired) {
        await (prisma as any).whatsAppSession.update({
          where: { id: sessionId },
          data: { status: "disconnected", workerId: null },
        });
        setTimeout(() => {
          startSession(sessionId, onIncoming).catch((err) =>
            console.error("[WhatsApp Connector] auto-reconnect after 515 failed:", err)
          );
        }, 2500);
      } else {
        await (prisma as any).whatsAppSession.update({
          where: { id: sessionId },
          data: { status: "disconnected", workerId: null },
        });
      }
    }
  });

  // Only two message types are ever tracked:
  // 1. Only-owner mode ON:  self message to self (owner → own number).
  // 2. Only-owner mode OFF: another number → connected number (incoming from contact).
  function shouldTrackMessage(
    onlyOwnerMode: boolean,
    fromMe: boolean,
    remoteJid: string | null | undefined,
    ownerJid: string | null | undefined
  ): boolean {
    if (onlyOwnerMode) {
      return fromMe && !!remoteJid && !!ownerJid && remoteJid === ownerJid;
    }
    return !fromMe;
  }

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const ownerJid = (sock as any).__ownerJid as string | null;

    // Credential-only session (workflow trigger): process all 1:1 messages (self-chat + incoming from others)
    if (row.credentialId && !row.integrationId) {
      for (const msg of messages) {
        const fromMe = msg.key.fromMe === true;
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid.endsWith("@g.us")) continue;
        const isSelfChat = fromMe && remoteJid === ownerJid;
        const isIncoming = !fromMe;
        if (!isSelfChat && !isIncoming) continue;
        const payload = normalizeMessage(msg as WAMessage);
        if (!payload) continue;
        try {
          await onIncoming({
            sessionId,
            integrationId: undefined,
            credentialId: row.credentialId,
            payload,
          });
        } catch (err) {
          console.error("[WhatsApp Connector] onIncoming error:", err);
        }
      }
      return;
    }

    // Chat Integration session: use only-owner setting
    if (!row.integrationId) return;
    const integration = await (prisma as any).chatIntegration
      .findUnique({
        where: { id: row.integrationId },
        select: { whatsappOnlyOwnerCanChat: true },
      })
      .catch(() => null);
    const onlyOwnerMode = integration?.whatsappOnlyOwnerCanChat !== false;
    for (const msg of messages) {
      const fromMe = msg.key.fromMe === true;
      const remoteJid = msg.key.remoteJid;
      const isGroupMsg = !!remoteJid && remoteJid.endsWith("@g.us");

      // For group messages: always allow through (mention filtering happens in the backend).
      // For 1:1 messages: apply the owner-mode filter as before.
      if (!isGroupMsg) {
        const track = shouldTrackMessage(onlyOwnerMode, fromMe, remoteJid, ownerJid);
        if (!track) continue;
      }
      // Pass allowGroups=true for integration sessions so group messages are normalized
      const payload = normalizeMessage(msg as WAMessage, /* allowGroups */ true);
      if (!payload) continue;
      try {
        await onIncoming({
          sessionId,
          integrationId: row.integrationId,
          credentialId: row.credentialId ?? undefined,
          payload,
          botJid: ownerJid || undefined, // pass the connected account's JID for group mention detection
        });
      } catch (err) {
        console.error("[WhatsApp Connector] onIncoming error:", err);
      }
    }
  });

  sessions.set(sessionId, {
    sessionId,
    integrationId: row.integrationId,
    credentialId: row.credentialId,
    socket: sock,
  });

  const firstQr = await Promise.race([
    firstQrPromise,
    new Promise<string | undefined>((r) => setTimeout(() => r(undefined), QR_WAIT_MS)),
  ]);
  const lastQr = (sock as any).__lastQr as string | undefined;
  const qr = firstQr ?? lastQr;
  const connStatus = (sock as any).__connectionStatus ?? "connecting";
  return { status: connStatus, qr };
}

export function stopSession(sessionId: string): void {
  const info = sessions.get(sessionId);
  if (info?.socket) {
    try {
      info.socket.end(undefined);
    } catch (_) {}
    sessions.delete(sessionId);
  }
}

function buildQuotedMessage(quotedKey: {
  remoteJid: string;
  id: string;
  fromMe?: boolean;
  participant?: string;
}): WAMessage {
  const jid = formatJid(quotedKey.remoteJid);
  const key: WAMessage["key"] = {
    remoteJid: jid,
    id: quotedKey.id,
    fromMe: quotedKey.fromMe ?? false,
    participant: quotedKey.participant ? formatJid(quotedKey.participant) : undefined,
  };
  return {
    key,
    message: { conversation: "" },
  } as WAMessage;
}

export async function sendMessage(
  sessionRef: string,
  toJid: string,
  text: string,
  options?: {
    media?: { url: string; mimetype?: string; caption?: string };
    quotedKey?: { remoteJid: string; id: string; fromMe?: boolean; participant?: string };
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const info = resolveSession(sessionRef);
  if (!info) {
    return { success: false, error: `Session not found: ${sessionRef}` };
  }
  const jid = formatJid(toJid);
  const quoted = options?.quotedKey ? buildQuotedMessage(options.quotedKey) : undefined;
  try {
    if (options?.media?.url) {
      const sent = await info.socket.sendMessage(
        jid,
        {
          image: { url: options.media.url },
          caption: options.media.caption || text,
        },
        quoted ? { quoted } : undefined
      );
      return { success: true, messageId: sent?.key?.id ?? undefined };
    }
    const sent = await info.socket.sendMessage(jid, { text }, quoted ? { quoted } : undefined);
    return { success: true, messageId: sent?.key?.id ?? undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

function resolveSession(sessionRef: string): SessionInfo | undefined {
  const byId = sessions.get(sessionRef);
  if (byId) return byId;
  for (const info of sessions.values()) {
    if (info.integrationId === sessionRef || info.credentialId === sessionRef) return info;
  }
  return undefined;
}

function formatJid(input: string): string {
  // If it already has @g.us (group JID), return as-is
  if (input.endsWith("@g.us")) return input;
  // If it already has another @ suffix, return as-is
  if (input.includes("@")) return input;
  const cleaned = input.replace(/\D/g, "");
  if (cleaned.length === 0) return input;
  return `${cleaned}@s.whatsapp.net`;
}

export function getSessionStatus(sessionId: string): { status: string; qr?: string } | null {
  const info = sessions.get(sessionId);
  if (!info) return null;
  const sock = info.socket as any;
  const status = sock.__connectionStatus ?? "connecting";
  const qr = sock.__lastQr;
  return { status, qr };
}

export function getSocketForSession(sessionId: string): WASocket | undefined {
  return sessions.get(sessionId)?.socket;
}
