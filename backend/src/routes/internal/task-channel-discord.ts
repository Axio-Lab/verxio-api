import { Router, Request, Response } from "express";
import { getTaskChannelInternal } from "@/services/taskChannelService";
import { handleIncomingSubmission } from "@/services/taskSubmissionService";
import { deliverTaskWorkerFeedbackDiscord } from "@/services/taskWorkerFeedbackDelivery";
import { sendDiscordMessage } from "@/services/discordConnectorClient";
import { downloadDiscordAttachment } from "@/services/taskImageService";

const router = Router();

const INCOMING_SECRET = process.env.DISCORD_INCOMING_SECRET || "";

function validateSecret(req: Request): boolean {
  if (!INCOMING_SECRET) return true;
  const header = req.headers["x-discord-secret"];
  return header === INCOMING_SECRET;
}

/**
 * POST /api/internal/task-channels/discord/:channelId
 * Called by the Discord Connector when a message is received on a task channel bot.
 * Body: { message, authorId, authorName, channelId, guildId?, threadId?, messageId?, attachments? }
 */
router.post("/discord/:channelId", async (req: Request, res: Response) => {
  if (!validateSecret(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { channelId: taskChannelId } = req.params;
  const channel = await getTaskChannelInternal(taskChannelId);

  if (!channel || channel.platform !== "DISCORD" || channel.status !== "connected") {
    return res.status(404).json({ error: "Task channel not found" });
  }

  const body = req.body as {
    message?: string;
    authorId?: string;
    authorName?: string;
    channelId?: string;
    guildId?: string;
    threadId?: string;
    messageId?: string;
    attachments?: Array<{
      type: "image" | "file" | "document";
      url?: string;
      mimeType?: string;
      fileName?: string;
    }>;
  };

  if (!body?.message || !body?.authorId) {
    return res.status(400).json({ error: "message and authorId are required" });
  }

  const { message: messageText, authorId, channelId: discordChannelId, threadId } = body;
  const replyChannelId = threadId || discordChannelId || "";

  res.status(200).json({ ok: true });

  void (async () => {
    try {
      let imageUrl: string | undefined;
      if (body.attachments?.length) {
        const imgAttachment = body.attachments.find((a) => a.type === "image" && a.url);
        if (imgAttachment?.url) {
          imageUrl = await downloadDiscordAttachment(imgAttachment.url);
        }
      }

      const result = await handleIncomingSubmission("DISCORD", authorId, messageText, imageUrl, {
        taskChannelId: channel.id,
      });

      if (result.handled && result.feedback) {
        await deliverTaskWorkerFeedbackDiscord({
          integrationId: channel.id,
          channelId: replyChannelId,
          markdownBody: result.feedback,
        });
      } else if (!result.handled) {
        await sendDiscordMessage({
          integrationId: channel.id,
          channelId: replyChannelId,
          text: "Hi! This channel is used for task management. If you were added to a task, your manager will send you an onboarding message. Reply HELP for more info.",
        });
      }
    } catch (error) {
      console.error("[TaskChannel Discord] Error:", error);
      try {
        await sendDiscordMessage({
          integrationId: channel.id,
          channelId: replyChannelId,
          text: "Something went wrong. Please try again.",
        });
      } catch {}
    }
  })();
});

export const taskChannelDiscordRouter = router;
