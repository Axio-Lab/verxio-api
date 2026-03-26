import { Router, Request, Response } from "express";
import { getTaskChannelInternal } from "@/services/taskChannelService";
import { handleIncomingSubmission } from "@/services/taskSubmissionService";
import { downloadTelegramFile } from "@/services/taskImageService";
import { formatTelegramMessage } from "@/services/chatIntegrationService";
import { deliverTaskWorkerFeedbackTelegram } from "@/services/taskWorkerFeedbackDelivery";

const router = Router();

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const formatted = formatTelegramMessage(text);
  const payload: Record<string, unknown> = {
    chat_id: /^\d+$/.test(String(chatId).trim()) ? Number(String(chatId).trim()) : chatId,
    text: formatted,
    parse_mode: "HTML",
  };
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data as { ok?: boolean }).ok === false) {
    const desc = (data as { description?: string }).description || response.statusText;
    if (String(desc).includes("parse") || String(desc).includes("entities")) {
      const plain = text.replace(/\*\*/g, "").replace(/^#{1,6}\s+/gm, "");
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: payload.chat_id, text: plain.slice(0, 4000) }),
      });
      return;
    }
    console.error(`[TaskChannel Telegram] sendMessage failed: ${desc}`);
  }
}

/**
 * POST /api/internal/task-channels/telegram/:channelId
 * Dedicated Telegram webhook for task management channels.
 * Only handles human task worker messages (READY, HELP, submissions).
 */
router.post("/telegram/:channelId", async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const channel = await getTaskChannelInternal(channelId);

  if (!channel || channel.platform !== "TELEGRAM" || channel.status !== "connected") {
    return res.status(404).json({ error: "Task channel not found" });
  }
  if (!channel.telegramBotToken) {
    return res.status(400).json({ error: "Telegram bot token not configured" });
  }

  const secretHeader = req.headers["x-telegram-bot-api-secret-token"] as string | undefined;
  if (secretHeader !== channel.sharedSecret) {
    return res.status(401).json({ error: "Invalid webhook secret" });
  }

  const update = req.body;
  const message = update?.message || update?.edited_message || update?.callback_query?.message;
  const text = message?.text || message?.caption || update?.callback_query?.data || "";
  const chatId = message?.chat?.id ? String(message.chat.id) : "";
  const senderId = message?.from?.id ? String(message.from.id) : chatId;
  const hasPhoto = !!(message?.photo && message.photo.length > 0);
  const hasImageDocument = !!(
    message?.document?.file_id &&
    typeof message?.document?.mime_type === "string" &&
    message.document.mime_type.startsWith("image/")
  );
  const isForwarded = !!(message?.forward_date || message?.forward_from || message?.forward_origin);

  console.log(
    `[TaskChannel Telegram] Incoming update channelId=${channelId} chatId=${chatId} senderId=${senderId} hasPhoto=${hasPhoto} hasImageDocument=${hasImageDocument} isForwarded=${isForwarded} text=${text.slice(0, 50)}`
  );

  res.status(200).json({ ok: true });

  if (!chatId || (!text.trim() && !hasPhoto && !hasImageDocument)) {
    console.log(`[TaskChannel Telegram] Skipping: no content to process`);
    return;
  }

  void (async () => {
    try {
      const lookupId = senderId || chatId;
      const extras = [senderId, chatId].filter(Boolean);
      console.log(
        `[TaskChannel Telegram] Processing: lookupId=${lookupId} extras=${JSON.stringify(extras)}`
      );

      let imageUrl: string | undefined;
      let imageSource: "camera" | "document" | undefined;
      if (hasPhoto && channel.telegramBotToken) {
        const photos = message.photo;
        const largest = photos[photos.length - 1];
        imageUrl = await downloadTelegramFile(channel.telegramBotToken, largest.file_id);
        imageSource = isForwarded ? "document" : "camera";
        console.log(
          `[TaskChannel Telegram] Downloaded photo: imageUrl=${imageUrl} imageSource=${imageSource}`
        );
      } else if (hasImageDocument && channel.telegramBotToken) {
        imageUrl = await downloadTelegramFile(channel.telegramBotToken, message.document.file_id);
        imageSource = "document";
        console.log(`[TaskChannel Telegram] Downloaded image document: imageUrl=${imageUrl}`);
      }

      const result = await handleIncomingSubmission("TELEGRAM", lookupId, text, imageUrl, {
        taskChannelId: channel.id,
        additionalExternalIds: extras,
        imageSource,
      });
      console.log(
        `[TaskChannel Telegram] Submission result: handled=${result.handled} hasFeedback=${!!result.feedback} feedback=${(result.feedback || "").slice(0, 100)}`
      );

      if (result.handled && result.feedback) {
        await deliverTaskWorkerFeedbackTelegram(channel.telegramBotToken!, chatId, result.feedback);
      } else if (!result.handled) {
        await sendTelegramMessage(
          channel.telegramBotToken!,
          chatId,
          "Hi! This channel is used for task management. If you were added to a task, your manager will send you an onboarding message. Reply HELP for more info."
        );
      }
    } catch (error) {
      console.error("[TaskChannel Telegram] Error:", error);
      try {
        await sendTelegramMessage(
          channel.telegramBotToken!,
          chatId,
          "Something went wrong. Please try again."
        );
      } catch {}
    }
  })();
});

export const taskChannelTelegramRouter = router;
