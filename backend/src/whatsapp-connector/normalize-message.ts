import type { WAMessage } from "baileys";
import type { WhatsAppPayload } from "./types";

/** JIDs we never process (status/stories, etc.). */
const IGNORED_JIDS = ["status@broadcast"];

/** Extract phone number only from a JID (strip @s.whatsapp.net, @g.us, @lid, etc.). */
function jidToNumber(jid: string): string {
  if (!jid) return jid;
  const at = jid.indexOf("@");
  if (at === -1) return jid.replace(/\D/g, "") || jid;
  return jid.slice(0, at).replace(/\D/g, "") || jid;
}

/**
 * Normalize to payload only for 1:1 chats. Caller (session-manager) then allows only:
 * - Only-owner ON:  self message to self.
 * - Only-owner OFF: another number → connected number.
 */
export function normalizeMessage(msg: WAMessage): WhatsAppPayload | null {
  const key = msg.key;
  if (!key?.remoteJid) return null;
  if (IGNORED_JIDS.some((j) => key.remoteJid === j || key.remoteJid?.startsWith(j))) return null;
  const to = key.remoteJid;
  if (to.endsWith("@g.us")) return null; // skip groups — we only track direct (1:1) messages
  const from = key.fromMe ? key.remoteJid : (key.participant || key.remoteJid)!;
  const message = msg.message;
  if (!message) return null;

  const stubType = msg.messageStubType;
  if (stubType !== undefined && stubType !== null) {
    // Skip non-message stubs (e.g. group join/leave)
    return null;
  }

  let body = "";
  let type: WhatsAppPayload["type"] = "text";
  let media: WhatsAppPayload["media"];

  if (message.conversation) {
    body = message.conversation;
  } else if (message.extendedTextMessage) {
    body = message.extendedTextMessage.text || "";
  } else if (message.imageMessage) {
    body = message.imageMessage.caption || "";
    type = "image";
    media = {
      caption: message.imageMessage.caption || undefined,
      mimetype: message.imageMessage.mimetype || undefined,
    };
  } else if (message.videoMessage) {
    body = message.videoMessage.caption || "";
    type = "video";
    media = {
      caption: message.videoMessage.caption || undefined,
      mimetype: message.videoMessage.mimetype || undefined,
    };
  } else if (message.audioMessage) {
    type = "audio";
    media = { mimetype: message.audioMessage.mimetype || undefined };
  } else if (message.documentMessage) {
    body = message.documentMessage.caption || message.documentMessage.fileName || "";
    type = "document";
    media = {
      caption: message.documentMessage.caption || undefined,
      filename: message.documentMessage.fileName || undefined,
      mimetype: message.documentMessage.mimetype || undefined,
    };
  } else if (message.stickerMessage) {
    type = "sticker";
    media = { mimetype: message.stickerMessage.mimetype || undefined };
  } else {
    type = "unknown";
  }

  const isGroup = to.endsWith("@g.us");
  const messageId = key.id || `msg_${Date.now()}`;

  return {
    from: jidToNumber(from),
    to: jidToNumber(to),
    body,
    messageId,
    type,
    media,
    timestamp: msg.messageTimestamp as number || Math.floor(Date.now() / 1000),
    isGroup,
    fromMe: key.fromMe ?? false,
    pushName: msg.pushName ?? undefined,
    participant: key.participant ?? undefined,
  };
}
