import crypto from "crypto";
import { Router, Request, Response } from "express";
import { getTaskChannelInternal } from "@/services/taskChannelService";
import { handleIncomingSubmission } from "@/services/taskSubmissionService";
import { sendSlackMessage } from "@/services/chatIntegrationService";
import { deliverTaskWorkerFeedbackSlack } from "@/services/taskWorkerFeedbackDelivery";
import { downloadSlackFile } from "@/services/taskImageService";

const router = Router();

function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false;

  const base = `v0:${timestamp}:${body}`;
  const expected = "v0=" + crypto.createHmac("sha256", signingSecret).update(base).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * POST /api/internal/task-channels/slack/:channelId/events
 * Slack Events API receiver for task channels.
 */
router.post("/slack/:channelId/events", async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const channel = await getTaskChannelInternal(channelId);

  if (!channel || channel.platform !== "SLACK" || channel.status !== "connected") {
    return res.status(404).json({ error: "Task Slack channel not found" });
  }
  if (!channel.slackSigningSecret || !channel.slackBotToken) {
    return res.status(400).json({ error: "Slack credentials not configured" });
  }

  const slackTimestamp = req.headers["x-slack-request-timestamp"] as string;
  const slackSignature = req.headers["x-slack-signature"] as string;
  const rawBody = ((req as any).rawBody as string | undefined) || JSON.stringify(req.body);
  if (!slackTimestamp || !slackSignature) {
    return res.status(401).json({ error: "Missing Slack signature headers" });
  }
  if (!verifySlackSignature(channel.slackSigningSecret, slackTimestamp, rawBody, slackSignature)) {
    return res.status(401).json({ error: "Invalid Slack signature" });
  }

  const payload = req.body;
  if (payload?.type === "url_verification") {
    return res.status(200).json({ challenge: payload.challenge });
  }
  if (payload?.type !== "event_callback") {
    return res.status(200).json({ ok: true });
  }

  const event = payload.event;
  if (!event) {
    return res.status(200).json({ ok: true });
  }

  const isAppMention = event.type === "app_mention";
  const isDirectMessage = event.type === "message" && event.channel_type === "im" && !event.subtype;
  const isThreadReply =
    event.type === "message" && !event.subtype && event.thread_ts && event.ts !== event.thread_ts;
  if (!isAppMention && !isDirectMessage && !isThreadReply) {
    return res.status(200).json({ ok: true });
  }

  if (event.bot_id) {
    return res.status(200).json({ ok: true });
  }

  res.status(200).json({ ok: true });

  const sourceChannel = event.channel as string;
  const threadTs = (event.thread_ts || event.ts) as string;
  const senderId = (event.user || "unknown") as string;
  let text = (event.text || "") as string;
  text = text.replace(/<@[A-Z0-9]+>/g, "").trim();

  if (!text) return;

  void (async () => {
    try {
      let imageUrl: string | undefined;
      if (event.files?.length > 0 && channel.slackBotToken) {
        const imgFile = event.files.find(
          (f: any) => f.mimetype?.startsWith("image/") && (f.url_private_download || f.url_private)
        );
        if (imgFile) {
          const fileUrl = imgFile.url_private_download || imgFile.url_private;
          imageUrl = await downloadSlackFile(channel.slackBotToken, fileUrl);
        }
      }

      const result = await handleIncomingSubmission("SLACK", senderId, text, imageUrl, {
        taskChannelId: channel.id,
      });

      if (result.handled && result.feedback) {
        await deliverTaskWorkerFeedbackSlack(
          channel.slackBotToken!,
          sourceChannel,
          threadTs,
          result.feedback
        );
      } else if (!result.handled) {
        await sendSlackMessage(
          channel.slackBotToken!,
          sourceChannel,
          "Hi! This channel is used for task management. If you were added to a task, your manager will send you an onboarding message. Reply HELP for more info.",
          threadTs
        );
      }
    } catch (error) {
      console.error("[TaskChannel Slack] Error:", error);
      try {
        await sendSlackMessage(
          channel.slackBotToken!,
          sourceChannel,
          "Something went wrong. Please try again.",
          threadTs
        );
      } catch {}
    }
  })();
});

export const taskChannelSlackRouter = router;
