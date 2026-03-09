import { Router, Request, Response } from "express";
import { prisma } from "@/lib/prisma";
import * as chatIntegrationService from "@/services/chatIntegrationService";
import { sendDiscordMessage } from "@/services/discordConnectorClient";
import { getSupportChannelByIdInternal } from "@/services/supportChannelService";
import { respondToChannelMessage } from "@/services/supportChannelChatService";
import { checkFeatureAccess } from "@/services/subscriptionCheck";
import { SUBSCRIPTION_FEATURES } from "@/config/subscription-features";
import { consumePremiumQuota } from "@/services/subscriptionService";
import { QUOTA_COST } from "@/config/rate-limits";

const router = Router();

const INCOMING_SECRET = process.env.DISCORD_INCOMING_SECRET || "";

function validateSecret(req: Request): boolean {
  if (!INCOMING_SECRET) return true;
  const header = req.headers["x-discord-secret"];
  return header === INCOMING_SECRET;
}

/**
 * POST /api/internal/discord/incoming
 * Called by the Discord Connector when a message with bot mention is received.
 * Body: { integrationId, message, authorId, authorName, channelId, guildId, threadId?, messageId? }
 */
router.post("/incoming", async (req: Request, res: Response) => {
  if (!validateSecret(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body as {
    integrationId?: string;
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

  if (!body?.message || !body?.channelId) {
    return res.status(400).json({ error: "message and channelId are required" });
  }

  const {
    integrationId,
    message: messageText,
    authorId,
    authorName,
    channelId,
    guildId,
    threadId,
  } = body;

  // Support-channel path: Discord connector uses integrationId as session key.
  // For support channels we pass supportChannelId as integrationId.
  if (integrationId) {
    const supportChannel = await getSupportChannelByIdInternal(integrationId);
    if (
      supportChannel &&
      supportChannel.platform === "DISCORD" &&
      supportChannel.status === "connected"
    ) {
      const replyChannelId = threadId || channelId;
      const replyToMessageId = body.messageId;
      const isServerChannel = !!guildId;
      const groupPrefix = isServerChannel && authorId ? `<@${authorId}> ` : "";

      void (async () => {
        try {
          const reply = await respondToChannelMessage({
            supportAgentId: supportChannel.supportAgentId,
            externalId: authorId || channelId,
            message: messageText,
          });
          if (!reply?.trim()) return;
          const withPrefix = groupPrefix + reply.trim();
          const formatted = chatIntegrationService.formatDiscordMessage(withPrefix);
          const chunks = chatIntegrationService.splitDiscordMessage(formatted);
          for (let i = 0; i < chunks.length; i++) {
            await sendDiscordMessage({
              integrationId: supportChannel.id,
              channelId: replyChannelId,
              text: chunks[i],
              replyToMessageId: i === 0 ? replyToMessageId : undefined,
            });
          }
        } catch (err) {
          console.error("[Discord incoming support] processMessage error:", err);
          try {
            await sendDiscordMessage({
              integrationId: supportChannel.id,
              channelId: replyChannelId,
              text: "Something went wrong. Please try again.",
            });
          } catch (_) {}
        }
      })();

      return res.json({ ok: true, support: true });
    }
  }

  if (!integrationId) {
    return res.status(400).json({ error: "integrationId is required" });
  }

  const integration = await (prisma as any).chatIntegration.findFirst({
    where: { id: integrationId, platform: "DISCORD", isActive: true },
  });
  if (!integration) {
    return res.status(404).json({ error: "Integration not found" });
  }

  // Premium feature check
  try {
    await checkFeatureAccess(integration.userId, SUBSCRIPTION_FEATURES.DISCORD_CHAT_INTEGRATION);
  } catch {
    try {
      await sendDiscordMessage({
        integrationId,
        channelId: threadId || channelId,
        text: "Discord chat with Verxio is a premium feature. Please upgrade your plan to use it.",
      });
    } catch (_) {}
    return res.json({ ok: true, premiumRequired: true });
  }

  // Consume credits
  try {
    await consumePremiumQuota(integration.userId, QUOTA_COST.DISCORD_CHAT_INTEGRATION);
  } catch (quotaError) {
    const msg = quotaError instanceof Error ? quotaError.message : "Rate limit exceeded.";
    try {
      await sendDiscordMessage({
        integrationId,
        channelId: threadId || channelId,
        text: msg.includes("credits")
          ? "You've used your daily chat credits. Limit resets at midnight."
          : msg,
      });
    } catch (_) {}
    return res.json({ ok: true, quotaExceeded: true });
  }

  // Auto-link external identity
  if (authorId) {
    try {
      await chatIntegrationService.linkExternalIdentity(
        integration.userId,
        "discord",
        authorId,
        integrationId,
        authorName,
        { channelId, guildId }
      );
    } catch (_) {}
  }

  const chatMessage: chatIntegrationService.ChatIntegrationMessage = {
    platform: "DISCORD",
    externalId: authorId || "unknown",
    externalName: authorName,
    message: messageText,
    attachments: body.attachments,
    metadata: {
      chatId: threadId || channelId,
      channelId,
      guildId,
      threadId,
      messageId: body.messageId,
    },
  };

  // Reply-to: attach reply to original message (Discord message reference)
  const replyToMessageId = body.messageId;

  // Prefix for server channels so it's clear who the reply is for (Discord @mention)
  const isServerChannel = !!guildId;
  const groupPrefix = isServerChannel && authorId ? `<@${authorId}> ` : "";

  // Process in background and send reply via Discord connector
  const replyChannelId = threadId || channelId;
  void (async () => {
    try {
      const result = await chatIntegrationService.processMessage(
        integration.userId,
        integration,
        chatMessage
      );
      const replyText = result.message?.trim() || "";
      if (replyText) {
        const withPrefix = groupPrefix + replyText;
        const formatted = chatIntegrationService.formatDiscordMessage(withPrefix);
        const chunks = chatIntegrationService.splitDiscordMessage(formatted);
        for (let i = 0; i < chunks.length; i++) {
          await sendDiscordMessage({
            integrationId,
            channelId: replyChannelId,
            text: chunks[i],
            replyToMessageId: i === 0 ? replyToMessageId : undefined,
          });
        }
      }
    } catch (err) {
      console.error("[Discord incoming] processMessage error:", err);
      try {
        await sendDiscordMessage({
          integrationId,
          channelId: replyChannelId,
          text: "Something went wrong. Please try again.",
        });
      } catch (_) {}
    }
  })();

  return res.json({ ok: true });
});

export const internalDiscordRouter = router;
