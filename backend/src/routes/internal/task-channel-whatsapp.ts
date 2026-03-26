import { Router, Request, Response } from "express";
import { handleIncomingSubmission } from "@/services/taskSubmissionService";
import { deliverTaskWorkerFeedbackWhatsApp } from "@/services/taskWorkerFeedbackDelivery";
import { sendWhatsAppMessage } from "@/services/whatsappConnectorClient";
import { downloadAndSaveImage } from "@/services/taskImageService";

const router = Router();

const INCOMING_SECRET = process.env.WHATSAPP_INCOMING_SECRET || "";

function validateSecret(req: Request): boolean {
  if (!INCOMING_SECRET) return true;
  const header = req.headers["x-whatsapp-secret"];
  return header === INCOMING_SECRET;
}

/**
 * POST /api/internal/task-channels/whatsapp/incoming
 * Called by the WhatsApp Connector when a message is received on a task-channel session.
 * Body: { sessionId, payload: { from, body, remoteJid?, attachments?, pushName?, isGroup?, ... } }
 */
router.post("/whatsapp/incoming", async (req: Request, res: Response) => {
  if (!validateSecret(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body as {
    sessionId?: string;
    payload?: {
      from: string;
      body: string;
      remoteJid?: string;
      isGroup?: boolean;
      groupJid?: string;
      pushName?: string;
      mentionedJid?: string[];
      attachments?: Array<{
        type: "image" | "file" | "document";
        url?: string;
        mimeType?: string;
      }>;
    };
  };

  if (!body?.sessionId || !body?.payload?.from) {
    return res.status(400).json({ error: "sessionId and payload.from are required" });
  }

  const { sessionId, payload } = body;
  const fromJid = payload.from;
  const rawRemoteJid = payload.remoteJid;
  const replyToJid = rawRemoteJid || fromJid;
  const text = payload.body || "";

  const { basePrismaClient } = await import("@/lib/prisma");
  const prisma = basePrismaClient as any;
  const channel = await prisma.taskChannel.findFirst({
    where: { whatsappSessionId: sessionId },
  });

  if (!channel || channel.platform !== "WHATSAPP" || channel.status !== "connected") {
    return res.status(404).json({ error: "Task channel not found for this session" });
  }

  res.status(200).json({ ok: true });
  await processTaskChannelWhatsAppIncoming(channel, sessionId, fromJid, replyToJid, text, payload);
});

/**
 * Human task worker messages (READY, HELP, submissions) for Task Manager WhatsApp channels.
 * Used by POST /api/internal/task-channels/whatsapp/incoming and by /api/internal/whatsapp/incoming
 * (the connector always posts to the latter).
 */
export async function processTaskChannelWhatsAppIncoming(
  channel: any,
  sessionId: string,
  fromJid: string,
  replyToJid: string,
  text: string,
  payload: any
) {
  if (!text.trim() && !payload.attachments?.length) return;

  try {
    const rawRemote =
      typeof payload.remoteJid === "string" &&
      payload.remoteJid &&
      !payload.remoteJid.endsWith("@g.us")
        ? payload.remoteJid
        : "";
    const lidDigits = rawRemote.endsWith("@lid")
      ? rawRemote.replace(/@lid$/, "").replace(/\D/g, "")
      : "";
    const peerJidNorm = rawRemote ? rawRemote.replace(/:.*@/, "@") : "";
    const normalizedFromDigits = typeof fromJid === "string" ? fromJid.replace(/:.*@/, "@") : "";

    // Connector resolves LID→phone via Baileys contacts; prefer phone-based lookupId when available.
    const resolvedPhone =
      typeof payload.resolvedPhone === "string" && payload.resolvedPhone
        ? payload.resolvedPhone
        : "";
    const resolvedDigits = resolvedPhone.replace(/\D/g, "");
    // Guard against false mapping where Baileys LID digits are incorrectly converted to @s JID.
    const safeResolvedPhone = lidDigits && resolvedDigits === lidDigits ? "" : resolvedPhone;
    const lookupId = safeResolvedPhone || peerJidNorm || normalizedFromDigits || fromJid;
    const additionalExternalIds = [
      safeResolvedPhone,
      rawRemote,
      peerJidNorm,
      fromJid,
      normalizedFromDigits,
      typeof payload.participant === "string" ? payload.participant : "",
    ].filter(Boolean);

    let imageUrl: string | undefined;
    let imageSource: "camera" | "document" | undefined;
    if (payload.attachments?.length) {
      const imgAttachment = payload.attachments.find(
        (a: any) => (a.mimeType?.startsWith("image/") || a.mimetype?.startsWith("image/")) && a.url
      );
      if (imgAttachment?.url) {
        imageUrl = await downloadAndSaveImage(imgAttachment.url);
        const aType = (imgAttachment as any).type;
        imageSource = aType === "document" || aType === "file" ? "document" : "camera";
      }
    }

    const result = await handleIncomingSubmission("WHATSAPP", lookupId, text, imageUrl, {
      taskChannelId: channel.id,
      additionalExternalIds,
      senderName: typeof payload.pushName === "string" ? payload.pushName : "",
      imageSource,
    });

    if (result.handled && result.feedback) {
      await deliverTaskWorkerFeedbackWhatsApp(sessionId, replyToJid, result.feedback);
    } else if (!result.handled) {
      // Task channels are worker-only: if no worker matched, do not send generic help/public hints.
    }
  } catch (error) {
    console.error("[TaskChannel WhatsApp] Error:", error);
    try {
      await sendWhatsAppMessage({
        sessionRef: sessionId,
        toJid: replyToJid,
        text: "Something went wrong. Please try again.",
      });
    } catch {}
  }
}

export const taskChannelWhatsAppRouter = router;
