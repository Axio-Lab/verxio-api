import crypto from "crypto";
import { Router, Request, Response } from "express";
import { sendSlackMessage } from "@/services/chatIntegrationService";
import {
  getSupportChannelByIdInternal,
  updateSupportChannelConfigInternal,
} from "@/services/supportChannelService";
import { respondToChannelMessage } from "@/services/supportChannelChatService";
import { handleIncomingSubmission } from "@/services/taskSubmissionService";
import { downloadSlackFile } from "@/services/taskImageService";
import { getWorkerByExternalId } from "@/services/humanWorkerService";

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
 * POST /api/internal/slack/support/:channelId/events
 * Slack Events API receiver for support channels.
 */
router.post("/support/:channelId/events", async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const channel = await getSupportChannelByIdInternal(channelId);

  if (!channel || channel.platform !== "SLACK" || channel.status !== "connected") {
    return res.status(404).json({ error: "Support Slack channel not found" });
  }
  if (!channel.slackSigningSecret || !channel.slackBotToken) {
    return res.status(400).json({ error: "Slack credentials not configured" });
  }

  const agentStatus = (channel as { supportAgent?: { status: string } }).supportAgent?.status;
  if (agentStatus === "disabled") {
    return res.status(200).json({ ok: true, skipped: "agent_disabled" });
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
  if (!text.trim()) {
    return;
  }

  // Remove any @mentions so the support agent receives clean user text.
  text = text.replace(/<@[A-Z0-9]+>/g, "").trim();

  void (async () => {
    try {
      if (!channel.slackChannelId || channel.slackChannelId !== sourceChannel) {
        await updateSupportChannelConfigInternal(channel.id, {
          slackChannelId: sourceChannel,
          slackTeamId: payload?.team_id || channel.slackTeamId || null,
        });
      }
      // Check if sender is a task worker before routing to support agent
      try {
        const worker = await getWorkerByExternalId("SLACK", senderId);
        if (worker) {
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
          const result = await handleIncomingSubmission("SLACK", senderId, text, imageUrl);
          if (result.handled && result.feedback) {
            await sendSlackMessage(channel.slackBotToken!, sourceChannel, result.feedback, threadTs);
          }
          if (result.handled) return;
        }
      } catch (workerErr) {
        console.warn("[Support Slack] Worker routing check failed:", workerErr);
      }

      const reply = await respondToChannelMessage({
        supportAgentId: channel.supportAgentId,
        externalId: senderId,
        message: text,
      });
      await sendSlackMessage(channel.slackBotToken!, sourceChannel, reply, threadTs);
    } catch (error) {
      console.error("[Support Slack webhook] Error:", error);
      try {
        await sendSlackMessage(
          channel.slackBotToken!,
          sourceChannel,
          "Something went wrong. Please try again.",
          threadTs
        );
      } catch (_) {}
    }
  })();
});

export const internalSlackSupportRouter = router;
