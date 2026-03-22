import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import * as taskChannelService from "../services/taskChannelService";
import {
  startWhatsAppSession,
  getWhatsAppSessionStatus,
  getWhatsAppSessionQr,
} from "@/services/whatsappConnectorClient";

export const taskChannelsRouter: Router = Router();

/**
 * GET /api/task-channels
 */
taskChannelsRouter.get(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const channels = await taskChannelService.listTaskChannels(userId);
      res.json({ channels });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/task-channels
 * Body: { platform: "TELEGRAM" | "WHATSAPP" | "SLACK" | "DISCORD", label?: string }
 */
taskChannelsRouter.post(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { platform, label } = req.body;
      if (!platform) {
        return res.status(400).json({ success: false, message: "platform is required" });
      }
      const channel = await taskChannelService.createTaskChannel(userId, platform, label);
      res.json({ success: true, channel });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/task-channels/:id
 * Body: { label?: string, status?: string }
 */
taskChannelsRouter.patch(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { label, status } = req.body as { label?: string; status?: string };
      const channel = await taskChannelService.updateTaskChannel(userId, req.params.id, {
        label,
        status,
      });
      res.json({ success: true, channel });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/task-channels/:id
 */
taskChannelsRouter.delete(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      await taskChannelService.deleteTaskChannel(userId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/task-channels/:id/disconnect
 * Clear credentials / sessions so the user can connect again (channel row kept).
 */
taskChannelsRouter.post(
  "/:id/disconnect",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const channel = await taskChannelService.disconnectTaskChannel(userId, req.params.id);
      res.json({ success: true, channel });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/task-channels/:id/telegram/connect
 * Body: { botToken: string }
 */
taskChannelsRouter.post(
  "/:id/telegram/connect",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { botToken } = req.body;
      if (!botToken || typeof botToken !== "string") {
        return res.status(400).json({ success: false, message: "botToken is required" });
      }
      const channel = await taskChannelService.connectTelegram(
        userId,
        req.params.id,
        botToken.trim()
      );
      res.json({ success: true, channel });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/task-channels/:id/whatsapp/connect
 * Start a WhatsApp session for a task channel; returns QR/status.
 */
taskChannelsRouter.post(
  "/:id/whatsapp/connect",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { channel, session } = await taskChannelService.connectWhatsApp(userId, req.params.id);

      const result = await startWhatsAppSession(session.id);
      const statusAfterStart = await getWhatsAppSessionStatus(session.id).catch(() => null);
      const qrAfterStart =
        result.qr ?? statusAfterStart?.qr ?? (await getWhatsAppSessionQr(session.id));
      const displayStatus = result.status === "open" ? "connected" : result.status;

      res.json({
        success: true,
        channelId: channel.id,
        sessionId: session.id,
        status: displayStatus,
        qr: displayStatus === "connected" ? null : (qrAfterStart ?? null),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/task-channels/:id/whatsapp/status
 * Check WhatsApp session status for a task channel.
 */
taskChannelsRouter.get(
  "/:id/whatsapp/status",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const ch = await taskChannelService.getTaskChannel(userId, req.params.id);

      if (!ch.whatsappSessionId) {
        return res.json({ success: true, status: "disconnected", qr: null });
      }

      const status = await getWhatsAppSessionStatus(ch.whatsappSessionId);
      if (!status) {
        return res.json({ success: true, status: "disconnected", qr: null });
      }

      const displayStatus = status.status === "open" ? "connected" : status.status;

      if (displayStatus === "connected" && ch.status !== "connected") {
        await taskChannelService.updateTaskChannel(userId, ch.id, { status: "connected" });
      }

      res.json({
        success: true,
        status: displayStatus,
        qr: displayStatus === "connected" ? null : (status.qr ?? null),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/task-channels/:id/slack/connect
 * Body: { slackBotToken, slackSigningSecret }
 */
taskChannelsRouter.post(
  "/:id/slack/connect",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { slackBotToken, slackSigningSecret } = req.body;
      if (!slackBotToken || typeof slackBotToken !== "string") {
        return res.status(400).json({ success: false, message: "slackBotToken is required" });
      }
      if (!slackSigningSecret || typeof slackSigningSecret !== "string") {
        return res.status(400).json({ success: false, message: "slackSigningSecret is required" });
      }

      const result = await taskChannelService.connectSlack(
        userId,
        req.params.id,
        slackBotToken,
        slackSigningSecret
      );
      res.json({
        success: true,
        channel: result.channel,
        teamId: result.teamId,
        webhookUrl: result.webhookUrl,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/task-channels/:id/discord/connect
 * Body: { discordBotToken, discordGuildId?, discordChannelId? }
 */
taskChannelsRouter.post(
  "/:id/discord/connect",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { discordBotToken, discordGuildId, discordChannelId } = req.body;
      if (!discordBotToken || typeof discordBotToken !== "string") {
        return res.status(400).json({ success: false, message: "discordBotToken is required" });
      }

      const result = await taskChannelService.connectDiscord(
        userId,
        req.params.id,
        discordBotToken,
        discordGuildId,
        discordChannelId
      );
      res.json({
        success: true,
        channel: result.channel,
        botUserId: result.botUserId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/task-channels/active
 * Returns active task channels formatted for the task-creation channel dropdown.
 */
taskChannelsRouter.get(
  "/active",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const channels = await taskChannelService.listActiveTaskChannels(userId);
      res.json({ channels });
    } catch (error) {
      next(error);
    }
  }
);
