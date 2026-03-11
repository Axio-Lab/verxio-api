import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "@/middleware/betterAuth";
import { basePrismaClient } from "@/lib/prisma";
import {
  createSupportChannel,
  listSupportChannelsForAgent,
  attachWhatsAppSessionToChannel,
  getOrCreateWhatsAppSessionForSupportChannel,
  getSupportChannelById,
  updateSupportChannelConfig,
} from "@/services/supportChannelService";
import {
  startWhatsAppSession,
  getWhatsAppSessionStatus,
  getWhatsAppSessionQr,
  stopWhatsAppSession,
} from "@/services/whatsappConnectorClient";
import { connectDiscordBot, disconnectDiscordBot } from "@/services/discordConnectorClient";

export const supportChannelsRouter = Router();
const prisma = basePrismaClient as any;

function getApiBaseUrl() {
  const base = process.env.API_URL?.trim();
  if (!base) {
    throw new Error("API_URL is required for support channel webhooks.");
  }
  return base.replace(/\/$/, "");
}

async function getOrCreatePlatformChannel(
  userId: string,
  supportAgentId: string,
  platform: "WHATSAPP" | "TELEGRAM" | "SLACK" | "DISCORD"
) {
  const channels = await listSupportChannelsForAgent(userId, supportAgentId);
  const existing = channels.find((channel) => channel.platform === platform);
  if (existing) {
    return existing;
  }
  return createSupportChannel({
    userId,
    supportAgentId,
    platform,
    status: "pending",
  });
}

/**
 * GET /api/support/agents/:agentId/channels
 * List support channels for a given agent (owned by the current user)
 */
supportChannelsRouter.get(
  "/agents/:agentId/channels",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { agentId } = req.params;

      const channels = await listSupportChannelsForAgent(user.id, agentId);
      res.json({ success: true, channels });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/support/agents/:agentId/channels/whatsapp/connect
 * Create a WhatsApp support channel and start a WhatsApp session; returns QR/status.
 *
 * NOTE: This reuses the existing WhatsAppSession infrastructure, similar to chat integrations,
 * but the session is owned by the support channel (no credential required).
 */
supportChannelsRouter.post(
  "/agents/:agentId/channels/whatsapp/connect",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { agentId } = req.params;

      const channel = await getOrCreatePlatformChannel(user.id, agentId, "WHATSAPP");
      if (channel.status === "disabled") {
        await updateSupportChannelConfig(user.id, channel.id, { status: "pending" });
      }

      // Create or reuse a WhatsAppSession owned by this support channel (no credential needed)
      const session = await getOrCreateWhatsAppSessionForSupportChannel(channel.id);
      if (!session) {
        return res.status(500).json({
          success: false,
          message: "Failed to get or create WhatsApp session.",
        });
      }

      await attachWhatsAppSessionToChannel({
        userId: user.id,
        supportChannelId: channel.id,
        whatsappSessionId: session.id,
      });

      const result = await startWhatsAppSession(session.id);
      const statusAfterStart = await getWhatsAppSessionStatus(session.id).catch(() => null);
      const qrAfterStart =
        result.qr ?? statusAfterStart?.qr ?? (await getWhatsAppSessionQr(session.id));
      const displayStatus = result.status === "open" ? "connected" : result.status;

      await updateSupportChannelConfig(user.id, channel.id, {
        status: displayStatus === "connected" ? "connected" : "pending",
      });

      res.json({
        success: true,
        channelId: channel.id,
        sessionId: session.id,
        status: displayStatus,
        // If already connected, don't return a QR.
        qr: displayStatus === "connected" ? null : (qrAfterStart ?? null),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/support/agents/:agentId/channels/whatsapp/status
 * Get WhatsApp session status for the first WhatsApp channel for this agent.
 */
supportChannelsRouter.get(
  "/agents/:agentId/channels/whatsapp/status",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { agentId } = req.params;

      const channels = await listSupportChannelsForAgent(user.id, agentId);
      const waChannel = channels.find(
        (c) => c.platform === "WHATSAPP" && c.status !== "disabled" && c.whatsappSessionId
      );

      if (!waChannel || !waChannel.whatsappSessionId) {
        return res.json({ success: true, status: "disconnected", qr: null });
      }

      const status = await getWhatsAppSessionStatus(waChannel.whatsappSessionId);
      if (!status) {
        return res.json({ success: true, status: "disconnected", qr: null });
      }

      const displayStatus = status.status === "open" ? "connected" : status.status;
      if (displayStatus === "connected" && waChannel.status !== "connected") {
        await updateSupportChannelConfig(user.id, waChannel.id, { status: "connected" });
      }

      res.json({
        success: true,
        status: displayStatus,
        // Never return a QR once connected; otherwise UI can keep showing a stale QR.
        qr: displayStatus === "connected" ? null : (status.qr ?? null),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/support/agents/:agentId/channels/telegram/connect
 * Save Telegram bot token, configure webhook, and mark channel connected.
 */
supportChannelsRouter.post(
  "/agents/:agentId/channels/telegram/connect",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { agentId } = req.params;
      const { telegramBotToken } = req.body as { telegramBotToken?: string };

      if (!telegramBotToken || typeof telegramBotToken !== "string") {
        return res.status(400).json({ success: false, message: "telegramBotToken is required." });
      }

      const channel = await getOrCreatePlatformChannel(user.id, agentId, "TELEGRAM");
      const botToken = telegramBotToken.trim();

      const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const me = await meRes.json().catch(() => ({}));
      if (!meRes.ok || !me?.ok) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Telegram bot token.", details: me });
      }

      const webhookUrl = `${getApiBaseUrl()}/api/internal/telegram/support/${channel.id}`;
      if (!webhookUrl.startsWith("https://")) {
        return res.status(400).json({
          success: false,
          message: "Telegram requires an HTTPS webhook URL. Set API_URL to a public HTTPS URL.",
        });
      }

      const setWebhookRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: channel.id,
        }),
      });
      const setWebhook = await setWebhookRes.json().catch(() => ({}));
      if (!setWebhookRes.ok || !setWebhook?.ok) {
        return res.status(400).json({
          success: false,
          message: "Telegram webhook configuration failed.",
          details: setWebhook,
        });
      }

      await updateSupportChannelConfig(user.id, channel.id, {
        telegramBotToken: botToken,
        status: "connected",
      });

      res.json({
        success: true,
        channelId: channel.id,
        status: "connected",
        webhookUrl,
        botUsername: me?.result?.username ?? null,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/support/agents/:agentId/channels/slack/connect
 * Save Slack bot token/signing secret and mark channel connected.
 */
supportChannelsRouter.post(
  "/agents/:agentId/channels/slack/connect",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { agentId } = req.params;
      const { slackBotToken, slackSigningSecret } = req.body as {
        slackBotToken?: string;
        slackSigningSecret?: string;
      };

      if (!slackBotToken || typeof slackBotToken !== "string") {
        return res.status(400).json({ success: false, message: "slackBotToken is required." });
      }
      if (!slackSigningSecret || typeof slackSigningSecret !== "string") {
        return res.status(400).json({ success: false, message: "slackSigningSecret is required." });
      }

      const authTestRes = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${slackBotToken.trim()}`,
        },
      });
      const authTest = await authTestRes.json().catch(() => ({}));
      if (!authTestRes.ok || !authTest?.ok) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Slack bot token.", details: authTest });
      }

      const channel = await getOrCreatePlatformChannel(user.id, agentId, "SLACK");
      const eventsWebhookUrl = `${getApiBaseUrl()}/api/internal/slack/support/${channel.id}/events`;

      await updateSupportChannelConfig(user.id, channel.id, {
        slackBotToken: slackBotToken.trim(),
        slackSigningSecret: slackSigningSecret.trim(),
        slackTeamId: authTest.team_id || null,
        status: "connected",
      });

      res.json({
        success: true,
        channelId: channel.id,
        status: "connected",
        teamId: authTest.team_id || null,
        webhookUrl: eventsWebhookUrl,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/support/agents/:agentId/channels/discord/connect
 * Save Discord bot token and connect via Discord connector.
 */
supportChannelsRouter.post(
  "/agents/:agentId/channels/discord/connect",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { agentId } = req.params;
      const { discordBotToken, discordGuildId, discordChannelId } = req.body as {
        discordBotToken?: string;
        discordGuildId?: string;
        discordChannelId?: string;
      };

      if (!discordBotToken || typeof discordBotToken !== "string") {
        return res.status(400).json({ success: false, message: "discordBotToken is required." });
      }

      const token = discordBotToken.trim();
      const meRes = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bot ${token}` },
      });
      const me = await meRes.json().catch(() => ({}));
      if (!meRes.ok || !me?.id) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Discord bot token.", details: me });
      }

      const channel = await getOrCreatePlatformChannel(user.id, agentId, "DISCORD");
      const connector = await connectDiscordBot(channel.id, token);
      if (!connector.success) {
        return res.status(400).json({
          success: false,
          message: connector.error || "Failed to connect Discord bot.",
        });
      }

      await updateSupportChannelConfig(user.id, channel.id, {
        discordBotToken: token,
        discordGuildId: discordGuildId?.trim() || null,
        discordChannelId: discordChannelId?.trim() || null,
        status: "connected",
      });

      res.json({
        success: true,
        channelId: channel.id,
        status: "connected",
        botUserId: me.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/support/channels/:channelId
 * Disconnect and disable a support channel.
 */
supportChannelsRouter.delete(
  "/channels/:channelId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { channelId } = req.params;

      const channel = await getSupportChannelById(user.id, channelId);
      if (channel.platform === "DISCORD") {
        await disconnectDiscordBot(channel.id).catch(() => undefined);
      }
      if (channel.platform === "WHATSAPP" && channel.whatsappSessionId) {
        // Stop connector socket, clear auth, and detach session so a new QR can be generated next time.
        await stopWhatsAppSession(channel.whatsappSessionId).catch(() => undefined);
        await prisma.whatsAppSession
          .update({
            where: { id: channel.whatsappSessionId },
            data: {
              status: "disconnected",
              authState: null,
              phoneNumber: null,
              workerId: null,
            },
          })
          .catch(() => undefined);
        await updateSupportChannelConfig(user.id, channel.id, { whatsappSessionId: null });
      }

      await updateSupportChannelConfig(user.id, channel.id, { status: "disabled" });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);
