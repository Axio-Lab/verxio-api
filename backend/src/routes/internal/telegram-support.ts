import { Router, Request, Response } from "express";
import {
  getSupportChannelByIdInternal,
  updateSupportChannelConfigInternal,
} from "@/services/supportChannelService";
import { respondToChannelMessage } from "@/services/supportChannelChatService";
import { upsertSupportContact } from "@/services/supportContactService";
import { formatTelegramMessage } from "@/services/chatIntegrationService";
import { handleIncomingSubmission } from "@/services/taskSubmissionService";
import { downloadTelegramFile } from "@/services/taskImageService";
import { getWorkerByExternalId } from "@/services/humanWorkerService";

const router = Router();

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const formatted = formatTelegramMessage(text);
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatted,
      parse_mode: "HTML",
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(
      `Telegram sendMessage failed: ${payload?.description || response.statusText || "Unknown error"}`
    );
  }
}

/**
 * POST /api/internal/telegram/support/:channelId
 * Telegram webhook receiver for support channels.
 */
router.post("/support/:channelId", async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const channel = await getSupportChannelByIdInternal(channelId);

  if (!channel || channel.platform !== "TELEGRAM" || channel.status !== "connected") {
    return res.status(404).json({ error: "Support Telegram channel not found" });
  }
  if (!channel.telegramBotToken) {
    return res.status(400).json({ error: "Telegram bot token not configured" });
  }

  const agentStatus = (channel as { supportAgent?: { status: string } }).supportAgent?.status;
  if (agentStatus === "disabled") {
    return res.status(200).json({ ok: true, skipped: "agent_disabled" });
  }

  const secretHeader = req.headers["x-telegram-bot-api-secret-token"] as string | undefined;
  if (secretHeader !== channel.id) {
    return res.status(401).json({ error: "Invalid Telegram webhook secret" });
  }

  const update = req.body;
  const message = update?.message || update?.edited_message || update?.callback_query?.message;
  const text = message?.text || update?.callback_query?.data || "";
  const chatId = message?.chat?.id ? String(message.chat.id) : "";
  const senderId = message?.from?.id ? String(message.from.id) : chatId;

  // Return quickly so Telegram does not retry on long model responses.
  res.status(200).json({ ok: true });

  if (!chatId || !text.trim()) {
    return;
  }

  void (async () => {
    try {
      if (!channel.telegramChatId || channel.telegramChatId !== chatId) {
        await updateSupportChannelConfigInternal(channel.id, { telegramChatId: chatId });
      }

      // Save contact when someone messages the support agent
      const from = message?.from || update?.callback_query?.from;
      if (from && senderId) {
        try {
          const externalName =
            [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || null;
          const metadata: Record<string, unknown> = { telegramChatId: chatId };
          if (from.username) metadata.username = from.username;
          await upsertSupportContact({
            supportAgentId: channel.supportAgentId,
            supportChannelId: channel.id,
            platform: "TELEGRAM",
            externalId: senderId,
            externalName: externalName || null,
            phone: null,
            metadata,
          });
        } catch (contactErr) {
          console.warn("[Support Telegram] upsert support contact failed:", contactErr);
        }
      }

      // Check if sender is a task worker before routing to support agent
      try {
        const worker = await getWorkerByExternalId("TELEGRAM", senderId || chatId);
        if (worker) {
          let imageUrl: string | undefined;
          const photos = message?.photo;
          if (photos && photos.length > 0 && channel.telegramBotToken) {
            const largestPhoto = photos[photos.length - 1];
            imageUrl = await downloadTelegramFile(channel.telegramBotToken, largestPhoto.file_id);
          }
          const result = await handleIncomingSubmission(
            "TELEGRAM",
            senderId || chatId,
            text,
            imageUrl
          );
          if (result.handled && result.feedback) {
            await sendTelegramMessage(channel.telegramBotToken!, chatId, result.feedback);
          }
          if (result.handled) return;
        }
      } catch (workerErr) {
        console.warn("[Support Telegram] Worker routing check failed:", workerErr);
      }

      const reply = await respondToChannelMessage({
        supportAgentId: channel.supportAgentId,
        externalId: senderId || chatId,
        message: text,
      });
      // SDR funnels can intentionally return empty text (silence mode); do not send empty Telegram messages.
      if (reply && reply.trim()) {
        await sendTelegramMessage(channel.telegramBotToken!, chatId, reply);
      }
    } catch (error) {
      console.error("[Support Telegram webhook] Error:", error);
      try {
        await sendTelegramMessage(channel.telegramBotToken!, chatId, "Something went wrong. Please try again.");
      } catch (_) {}
    }
  })();
});

export const internalTelegramSupportRouter = router;
