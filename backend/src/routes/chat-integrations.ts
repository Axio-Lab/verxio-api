import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { chatIntegrationAuthMiddleware } from "../middleware/chatIntegrationAuth";
import { AppError } from "../middleware/errorHandler";
import * as chatIntegrationService from "../services/chatIntegrationService";
import {
  startWhatsAppSession,
  getWhatsAppSessionStatus,
} from "../services/whatsappConnectorClient";
import { checkFeatureAccess } from "../services/subscriptionCheck";
import { SUBSCRIPTION_FEATURES } from "../config/subscription-features";
import { consumePremiumQuota } from "../services/subscriptionService";
import { QUOTA_COST } from "../config/rate-limits";

export const chatIntegrationRouter: Router = Router();

/** Return webhook URL for API responses; for Telegram, derive from integration id when not yet stored. */
function getEffectiveWebhookUrl(integration: {
  webhookUrl?: string | null;
  platform: string;
  id: string;
}) {
  if (integration.webhookUrl) return integration.webhookUrl;
  if (integration.platform === "TELEGRAM")
    return chatIntegrationService.getHostedTelegramWebhookUrl(integration.id);
  return null;
}

async function requireSingleIntegration(userId: string) {
  const integrations = await chatIntegrationService.listIntegrations(userId);
  if (integrations.length === 0) {
    throw new AppError("No chat integration found.", 404);
  }
  if (integrations.length > 1) {
    throw new AppError("Multiple integrations found. Please specify an integration ID.", 400);
  }
  return integrations[0];
}

// ============================================
// Integration Setup Routes (require Better Auth)
// ============================================

/**
 * GET /api/chat-integrations/integrations
 * List user's chat integrations
 */
chatIntegrationRouter.get(
  "/integrations",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integrations = await chatIntegrationService.listIntegrations(user.id);
      res.json({
        success: true,
        integrations: integrations.map((integration: any) => ({
          id: integration.id,
          label: integration.label,
          platform: integration.platform,
          scope: integration.scope,
          scopeWorkflowId: integration.scopeWorkflowId,
          allowedWorkflowIds: integration.allowedWorkflowIds,
          webhookUrl: getEffectiveWebhookUrl(integration),
          secretPreview: `${integration.sharedSecret.slice(0, 8)}...${integration.sharedSecret.slice(-4)}`,
          isActive: integration.isActive,
          defaultWorkflowId: integration.defaultWorkflowId,
          allowPlanMode: integration.allowPlanMode,
          allowWorkflowExecution: integration.allowWorkflowExecution,
          totalRequests: integration.totalRequests,
          lastUsedAt: integration.lastUsedAt,
          createdAt: integration.createdAt,
          telegramBotTokenSet: !!integration.telegramBotToken,
          telegramBotUsername: integration.telegramBotUsername,
          whatsappSessionId: integration.whatsappSessionId,
          whatsappOnlyOwnerCanChat: integration.whatsappOnlyOwnerCanChat ?? true,
          slackBotTokenSet: !!integration.slackBotToken,
          slackTeamId: integration.slackTeamId,
          discordBotTokenSet: !!integration.discordBotToken,
          discordBotUserId: integration.discordBotUserId,
          discordClientId: integration.discordClientId,
          // Agent personality
          hasSoulMd: !!integration.soulMd,
          soulMd: integration.soulMd || null,
          evolvePersonality: integration.evolvePersonality ?? false,
          // Skill access
          skillScope: integration.skillScope ?? "ALL_SKILLS",
          allowedSkillIds: integration.allowedSkillIds || [],
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/integrations
 * Create a new integration
 */
chatIntegrationRouter.post(
  "/integrations",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const {
        label,
        platform,
        scope,
        scopeWorkflowId,
        allowedWorkflowIds,
        isActive,
        allowPlanMode,
        allowWorkflowExecution,
        soulMd,
        evolvePersonality,
        skillScope,
        allowedSkillIds,
      } = req.body;

      if (!label || typeof label !== "string") {
        throw new AppError("Integration label is required", 400);
      }

      if (platform === "TELEGRAM") {
        try {
          await checkFeatureAccess(user.id, SUBSCRIPTION_FEATURES.TELEGRAM_CHAT_INTEGRATION);
        } catch {
          throw new AppError(
            "Telegram chat integration is a premium feature. Please upgrade your plan to connect Telegram and chat with Verxio.",
            403
          );
        }
      }
      if (platform === "WHATSAPP") {
        try {
          await checkFeatureAccess(user.id, SUBSCRIPTION_FEATURES.WHATSAPP_CHAT_INTEGRATION);
        } catch {
          throw new AppError(
            "WhatsApp chat integration is a premium feature. Please upgrade your plan to connect WhatsApp and chat with Verxio.",
            403
          );
        }
      }

      const integration = await chatIntegrationService.createIntegration(user.id, {
        label: label.trim(),
        platform,
        scope,
        scopeWorkflowId,
        allowedWorkflowIds,
        isActive,
        allowPlanMode,
        allowWorkflowExecution,
        soulMd,
        evolvePersonality,
        skillScope,
        allowedSkillIds,
      });

      res.json({
        success: true,
        integration: {
          id: integration.id,
          label: integration.label,
          platform: integration.platform,
          scope: integration.scope,
          scopeWorkflowId: integration.scopeWorkflowId,
          allowedWorkflowIds: integration.allowedWorkflowIds,
          webhookUrl: getEffectiveWebhookUrl(integration),
          secretPreview: `${integration.sharedSecret.slice(0, 8)}...${integration.sharedSecret.slice(-4)}`,
          isActive: integration.isActive,
          defaultWorkflowId: integration.defaultWorkflowId,
          allowPlanMode: integration.allowPlanMode,
          allowWorkflowExecution: integration.allowWorkflowExecution,
          telegramBotTokenSet: !!integration.telegramBotToken,
          hasSoulMd: !!integration.soulMd,
          evolvePersonality: integration.evolvePersonality ?? false,
          skillScope: integration.skillScope ?? "ALL_SKILLS",
          allowedSkillIds: integration.allowedSkillIds || [],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/chat-integrations/integrations/:id
 * Get integration details
 */
chatIntegrationRouter.get(
  "/integrations/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const integration = await chatIntegrationService.getIntegration(user.id, id);
      if (!integration) {
        throw new AppError("Integration not found", 404);
      }

      res.json({
        success: true,
        integration: {
          id: integration.id,
          label: integration.label,
          platform: integration.platform,
          scope: integration.scope,
          scopeWorkflowId: integration.scopeWorkflowId,
          allowedWorkflowIds: integration.allowedWorkflowIds,
          webhookUrl: getEffectiveWebhookUrl(integration),
          secretPreview: `${integration.sharedSecret.slice(0, 8)}...${integration.sharedSecret.slice(-4)}`,
          isActive: integration.isActive,
          defaultWorkflowId: integration.defaultWorkflowId,
          allowPlanMode: integration.allowPlanMode,
          allowWorkflowExecution: integration.allowWorkflowExecution,
          totalRequests: integration.totalRequests,
          lastUsedAt: integration.lastUsedAt,
          createdAt: integration.createdAt,
          telegramBotTokenSet: !!integration.telegramBotToken,
          whatsappSessionId: integration.whatsappSessionId,
          whatsappOnlyOwnerCanChat: integration.whatsappOnlyOwnerCanChat ?? true,
          slackBotTokenSet: !!integration.slackBotToken,
          slackTeamId: integration.slackTeamId,
          discordBotTokenSet: !!integration.discordBotToken,
          discordBotUserId: integration.discordBotUserId,
          hasSoulMd: !!integration.soulMd,
          soulMd: integration.soulMd || null,
          evolvePersonality: integration.evolvePersonality ?? false,
          skillScope: integration.skillScope ?? "ALL_SKILLS",
          allowedSkillIds: integration.allowedSkillIds || [],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/chat-integrations/integrations/:id/secret
 * Get the full shared secret (use sparingly)
 */
chatIntegrationRouter.get(
  "/integrations/:id/secret",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const integration = await chatIntegrationService.getIntegration(user.id, id);
      if (!integration) {
        throw new AppError("Integration not found", 404);
      }

      res.json({
        success: true,
        sharedSecret: integration.sharedSecret,
        webhookUrl: getEffectiveWebhookUrl(integration),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/chat-integrations/integrations/:id
 * Update integration settings
 */
chatIntegrationRouter.put(
  "/integrations/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const {
        label,
        platform,
        scope,
        scopeWorkflowId,
        allowedWorkflowIds,
        isActive,
        defaultWorkflowId,
        allowPlanMode,
        allowWorkflowExecution,
        telegramBotToken,
        whatsappOnlyOwnerCanChat,
        soulMd,
        evolvePersonality,
        skillScope,
        allowedSkillIds,
      } = req.body;

      if (platform === "TELEGRAM") {
        try {
          await checkFeatureAccess(user.id, SUBSCRIPTION_FEATURES.TELEGRAM_CHAT_INTEGRATION);
        } catch {
          throw new AppError(
            "Telegram chat integration is a premium feature. Please upgrade your plan to connect Telegram and chat with Verxio.",
            403
          );
        }
      }
      if (platform === "WHATSAPP") {
        try {
          await checkFeatureAccess(user.id, SUBSCRIPTION_FEATURES.WHATSAPP_CHAT_INTEGRATION);
        } catch {
          throw new AppError(
            "WhatsApp chat integration is a premium feature. Please upgrade your plan to connect WhatsApp and chat with Verxio.",
            403
          );
        }
      }

      const integration = await chatIntegrationService.updateIntegration(user.id, id, {
        label,
        platform,
        scope,
        scopeWorkflowId,
        allowedWorkflowIds,
        isActive,
        defaultWorkflowId,
        allowPlanMode,
        allowWorkflowExecution,
        telegramBotToken,
        whatsappOnlyOwnerCanChat,
        soulMd,
        evolvePersonality,
        skillScope,
        allowedSkillIds,
      });

      res.json({
        success: true,
        integration: {
          id: integration.id,
          label: integration.label,
          platform: integration.platform,
          scope: integration.scope,
          scopeWorkflowId: integration.scopeWorkflowId,
          allowedWorkflowIds: integration.allowedWorkflowIds,
          isActive: integration.isActive,
          defaultWorkflowId: integration.defaultWorkflowId,
          allowPlanMode: integration.allowPlanMode,
          allowWorkflowExecution: integration.allowWorkflowExecution,
          telegramBotTokenSet: !!integration.telegramBotToken,
          whatsappOnlyOwnerCanChat: integration.whatsappOnlyOwnerCanChat ?? true,
          hasSoulMd: !!integration.soulMd,
          evolvePersonality: integration.evolvePersonality ?? false,
          skillScope: integration.skillScope ?? "ALL_SKILLS",
          allowedSkillIds: integration.allowedSkillIds || [],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/integrations/:id/telegram/token
 * Save Telegram bot token and configure hosted webhook
 */
chatIntegrationRouter.post(
  "/integrations/:id/telegram/token",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { telegramBotToken } = req.body;

      if (!telegramBotToken || typeof telegramBotToken !== "string") {
        throw new AppError("Telegram bot token is required", 400);
      }

      const integration = await chatIntegrationService.saveTelegramBotToken(
        user.id,
        id,
        telegramBotToken.trim()
      );

      res.json({
        success: true,
        message: "Telegram bot token saved and webhook configured.",
        integration: {
          id: integration.id,
          telegramBotTokenSet: !!integration.telegramBotToken,
          webhookUrl: getEffectiveWebhookUrl(integration),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/integrations/:id/telegram/refresh-webhook
 * Refresh Telegram webhook using stored bot token
 */
chatIntegrationRouter.post(
  "/integrations/:id/telegram/refresh-webhook",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const integration = await chatIntegrationService.refreshTelegramWebhook(user.id, id);

      res.json({
        success: true,
        message: "Telegram webhook refreshed.",
        integration: {
          id: integration.id,
          telegramBotTokenSet: !!integration.telegramBotToken,
          webhookUrl: getEffectiveWebhookUrl(integration),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/integrations/:id/slack/token
 * Save Slack bot token and signing secret, verify via auth.test
 */
chatIntegrationRouter.post(
  "/integrations/:id/slack/token",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { slackBotToken, slackSigningSecret } = req.body;

      if (!slackBotToken || typeof slackBotToken !== "string") {
        throw new AppError("Slack bot token (xoxb-...) is required", 400);
      }
      if (!slackSigningSecret || typeof slackSigningSecret !== "string") {
        throw new AppError("Slack signing secret is required", 400);
      }

      const integration = await chatIntegrationService.saveSlackBotToken(
        user.id,
        id,
        slackBotToken.trim(),
        slackSigningSecret.trim()
      );

      res.json({
        success: true,
        message: "Slack bot token saved and verified.",
        integration: {
          id: integration.id,
          slackBotTokenSet: !!integration.slackBotToken,
          slackTeamId: integration.slackTeamId,
          webhookUrl: chatIntegrationService.getHostedSlackWebhookUrl(integration.id),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/integrations/:id/discord/token
 * Save Discord bot token, verify via /users/@me, generate invite URL
 */
chatIntegrationRouter.post(
  "/integrations/:id/discord/token",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { discordBotToken, discordClientId } = req.body;

      const integration = await chatIntegrationService.saveDiscordBotToken(
        user.id,
        id,
        typeof discordBotToken === "string" && discordBotToken.trim()
          ? discordBotToken.trim()
          : undefined,
        discordClientId?.trim() || undefined
      );

      const effectiveClientId = integration.discordClientId || discordClientId?.trim();
      const inviteUrl = effectiveClientId
        ? chatIntegrationService.getDiscordInviteUrl(effectiveClientId)
        : undefined;

      res.json({
        success: true,
        message: "Discord bot token saved and verified.",
        integration: {
          id: integration.id,
          discordBotTokenSet: !!integration.discordBotToken,
          discordBotUserId: integration.discordBotUserId,
          discordClientId: integration.discordClientId,
          inviteUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/integrations/:id/generate-soul
 * Generate a soul.md personality using Claude (costs 20 credits)
 */
chatIntegrationRouter.post(
  "/integrations/:id/generate-soul",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { name, description, tone, coreTruths, boundaries } = req.body as {
        name?: string;
        description?: string;
        tone?: string;
        coreTruths?: string;
        boundaries?: string;
      };

      if (!name || !description || !tone) {
        return res.status(400).json({
          success: false,
          error: "name, description, and tone are required.",
        });
      }

      // Verify integration ownership
      const integration = await chatIntegrationService.getIntegration(user.id, id);
      if (!integration) {
        throw new AppError("Integration not found", 404);
      }

      // Consume 20 credits
      await consumePremiumQuota(user.id, QUOTA_COST.GENERATE_SOUL_MD);

      // Generate soul.md via Claude
      const soulMd = await chatIntegrationService.generateSoulMd({
        name,
        description,
        tone,
        coreTruths,
        boundaries,
      });

      // Save to integration
      await chatIntegrationService.saveSoulMd(user.id, id, soulMd);

      res.json({
        success: true,
        soulMd,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/integrations/:id/save-soul
 * Save manually uploaded/pasted soul.md content (free)
 */
chatIntegrationRouter.post(
  "/integrations/:id/save-soul",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { soulMd } = req.body as { soulMd?: string };

      if (!soulMd || !soulMd.trim()) {
        return res.status(400).json({
          success: false,
          error: "soulMd content is required.",
        });
      }

      const integration = await chatIntegrationService.getIntegration(user.id, id);
      if (!integration) {
        throw new AppError("Integration not found", 404);
      }

      await chatIntegrationService.saveSoulMd(user.id, id, soulMd);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/integrations/:id/regenerate-secret
 * Regenerate the shared secret
 */
chatIntegrationRouter.post(
  "/integrations/:id/regenerate-secret",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const newSecret = await chatIntegrationService.regenerateSecret(user.id, id);

      res.json({
        success: true,
        message:
          "Shared secret regenerated successfully. Update your chat integration configuration.",
        sharedSecret: newSecret,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/integrations/:id/whatsapp/connect
 * Get or create WhatsApp session and start connector; returns QR if needed
 */
chatIntegrationRouter.post(
  "/integrations/:id/whatsapp/connect",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const integration = await chatIntegrationService.getIntegration(user.id, id);
      if (!integration) throw new AppError("Integration not found", 404);
      if (integration.platform !== "WHATSAPP")
        throw new AppError("This integration is not WhatsApp.", 400);
      const session = await chatIntegrationService.getOrCreateWhatsAppSession(id);
      if (!session) throw new AppError("Failed to get or create WhatsApp session.", 500);
      const result = await startWhatsAppSession(session.id);
      res.json({
        success: true,
        sessionId: session.id,
        status: result.status,
        qr: result.qr,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/chat-integrations/integrations/:id/whatsapp/status
 * Get WhatsApp session status and optional QR
 */
chatIntegrationRouter.get(
  "/integrations/:id/whatsapp/status",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const integration = await chatIntegrationService.getIntegration(user.id, id);
      if (!integration) throw new AppError("Integration not found", 404);
      if (integration.platform !== "WHATSAPP")
        throw new AppError("This integration is not WhatsApp.", 400);
      const session = integration.whatsappSessionId
        ? await chatIntegrationService.getOrCreateWhatsAppSession(id)
        : null;
      if (!session) {
        return res.json({ status: "disconnected", qr: null });
      }
      const status = await getWhatsAppSessionStatus(session.id);
      if (!status) return res.json({ status: "disconnected", qr: null });
      res.json({ status: status.status, qr: status.qr });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/chat-integrations/integrations/:id
 * Delete an integration and linked identities
 */
chatIntegrationRouter.delete(
  "/integrations/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      await chatIntegrationService.deleteIntegration(user.id, id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/integrations/:id/test
 * Test integration connection
 */
chatIntegrationRouter.post(
  "/integrations/:id/test",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const result = await chatIntegrationService.testConnection(user.id, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/chat-integrations/integration
 * Get the user's chat integration settings
 */
chatIntegrationRouter.get(
  "/integration",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integration = await requireSingleIntegration(user.id);

      // Don't expose the secret directly, show masked version
      res.json({
        success: true,
        integration: {
          id: integration.id,
          label: integration.label,
          platform: integration.platform,
          scope: integration.scope,
          scopeWorkflowId: integration.scopeWorkflowId,
          allowedWorkflowIds: integration.allowedWorkflowIds,
          webhookUrl: getEffectiveWebhookUrl(integration),
          secretPreview: `${integration.sharedSecret.slice(0, 8)}...${integration.sharedSecret.slice(-4)}`,
          isActive: integration.isActive,
          defaultWorkflowId: integration.defaultWorkflowId,
          allowPlanMode: integration.allowPlanMode,
          allowWorkflowExecution: integration.allowWorkflowExecution,
          totalRequests: integration.totalRequests,
          lastUsedAt: integration.lastUsedAt,
          createdAt: integration.createdAt,
          telegramBotTokenSet: !!integration.telegramBotToken,
          whatsappSessionId: integration.whatsappSessionId,
          whatsappOnlyOwnerCanChat: integration.whatsappOnlyOwnerCanChat ?? true,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/chat-integrations/integration/secret
 * Get the full shared secret (use sparingly, for initial setup)
 */
chatIntegrationRouter.get(
  "/integration/secret",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integration = await requireSingleIntegration(user.id);

      res.json({
        success: true,
        sharedSecret: integration.sharedSecret,
        webhookUrl: getEffectiveWebhookUrl(integration),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/chat-integrations/integration
 * Update integration settings
 */
chatIntegrationRouter.put(
  "/integration",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const {
        isActive,
        defaultWorkflowId,
        allowPlanMode,
        allowWorkflowExecution,
        telegramBotToken,
      } = req.body;

      const integrationToUpdate = await requireSingleIntegration(user.id);
      const integration = await chatIntegrationService.updateIntegration(
        user.id,
        integrationToUpdate.id,
        {
          isActive,
          defaultWorkflowId,
          allowPlanMode,
          allowWorkflowExecution,
          telegramBotToken,
        }
      );

      res.json({
        success: true,
        integration: {
          id: integration.id,
          label: integration.label,
          platform: integration.platform,
          scope: integration.scope,
          scopeWorkflowId: integration.scopeWorkflowId,
          allowedWorkflowIds: integration.allowedWorkflowIds,
          isActive: integration.isActive,
          defaultWorkflowId: integration.defaultWorkflowId,
          allowPlanMode: integration.allowPlanMode,
          allowWorkflowExecution: integration.allowWorkflowExecution,
          telegramBotTokenSet: !!integration.telegramBotToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/telegram/token
 * Save Telegram bot token and configure hosted webhook
 */
chatIntegrationRouter.post(
  "/telegram/token",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { telegramBotToken } = req.body;

      if (!telegramBotToken || typeof telegramBotToken !== "string") {
        throw new AppError("Telegram bot token is required", 400);
      }

      const integrationToUpdate = await requireSingleIntegration(user.id);
      const integration = await chatIntegrationService.saveTelegramBotToken(
        user.id,
        integrationToUpdate.id,
        telegramBotToken.trim()
      );

      res.json({
        success: true,
        message: "Telegram bot token saved and webhook configured.",
        integration: {
          id: integration.id,
          telegramBotTokenSet: !!integration.telegramBotToken,
          webhookUrl: getEffectiveWebhookUrl(integration),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/integration/regenerate-secret
 * Regenerate the shared secret
 */
chatIntegrationRouter.post(
  "/integration/regenerate-secret",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integrationToUpdate = await requireSingleIntegration(user.id);
      const newSecret = await chatIntegrationService.regenerateSecret(
        user.id,
        integrationToUpdate.id
      );

      res.json({
        success: true,
        message:
          "Shared secret regenerated successfully. Update your chat integration configuration.",
        sharedSecret: newSecret,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/chat-integrations/integration
 * Delete the integration and all linked identities
 */
chatIntegrationRouter.delete(
  "/integration",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integrationToDelete = await requireSingleIntegration(user.id);
      await chatIntegrationService.deleteIntegration(user.id, integrationToDelete.id);

      res.json({
        success: true,
        message: "chat integration deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/integration/test
 * Test the integration connection
 */
chatIntegrationRouter.post(
  "/integration/test",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integrationToTest = await requireSingleIntegration(user.id);
      const result = await chatIntegrationService.testConnection(user.id, integrationToTest.id);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// External Identity Routes (require Better Auth)
// ============================================

/**
 * GET /api/chat-integrations/identities
 * Get linked external identities for the user with pagination (page, limit)
 */
chatIntegrationRouter.get(
  "/identities",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integrationId = req.query.integrationId as string | undefined;
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
      const result = await chatIntegrationService.getExternalIdentities(user.id, integrationId, {
        page,
        limit,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/identities/link
 * Link a new external identity (for manual linking via dashboard)
 */
chatIntegrationRouter.post(
  "/identities/link",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { platform, externalId, externalName, metadata, integrationId } = req.body;

      if (!platform || !externalId) {
        throw new AppError("Platform and external ID are required", 400);
      }

      const identity = await chatIntegrationService.linkExternalIdentity(
        user.id,
        platform,
        externalId,
        integrationId,
        externalName,
        metadata
      );

      res.json({
        success: true,
        message: "External identity linked successfully.",
        identity,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/chat-integrations/identities/:platform/:externalId
 * Unlink an external identity
 */
chatIntegrationRouter.delete(
  "/identities/:platform/:externalId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { platform, externalId } = req.params;
      const integrationId = req.query.integrationId as string | undefined;

      await chatIntegrationService.unlinkExternalIdentity(
        user.id,
        platform,
        externalId,
        integrationId
      );

      res.json({
        success: true,
        message: "External identity unlinked successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Hosted Slack Events Webhook
// ============================================

/**
 * Verify Slack request signature (v0 HMAC-SHA256).
 */
function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false; // Replay attack protection
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature =
    "v0=" + crypto.createHmac("sha256", signingSecret).update(sigBasestring).digest("hex");
  if (mySignature.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
}

/**
 * POST /api/chat-integrations/slack/events/:integrationId
 * Receive Slack Events API payloads (url_verification, event_callback with app_mention / message).
 */
chatIntegrationRouter.post(
  "/slack/events/:integrationId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { integrationId } = req.params;
      if (!integrationId) {
        throw new AppError("Integration ID is required", 400);
      }

      // Immediately reject Slack retries to prevent duplicate processing
      const retryNum = req.headers["x-slack-retry-num"];
      if (retryNum) {
        return res.status(200).json({ ok: true, skipped: "retry" });
      }

      // Resolve integration
      const resolvedIntegration = await chatIntegrationService.getIntegrationById(integrationId);
      if (!resolvedIntegration || resolvedIntegration.platform !== "SLACK") {
        throw new AppError("Slack integration not found", 404);
      }
      if (!resolvedIntegration.isActive) {
        return res.status(200).json({ ok: true, message: "Integration is inactive." });
      }

      // Verify Slack signature
      const slackTimestamp = req.headers["x-slack-request-timestamp"] as string;
      const slackSignature = req.headers["x-slack-signature"] as string;
      if (!slackTimestamp || !slackSignature || !resolvedIntegration.slackSigningSecret) {
        throw new AppError("Missing Slack signature headers or signing secret", 401);
      }
      const rawBody = ((req as any).rawBody as string | undefined) || JSON.stringify(req.body);
      if (
        !verifySlackSignature(
          resolvedIntegration.slackSigningSecret,
          slackTimestamp,
          rawBody,
          slackSignature
        )
      ) {
        throw new AppError("Invalid Slack signature", 401);
      }

      const slackPayload = req.body;

      // Handle URL verification challenge
      if (slackPayload.type === "url_verification") {
        return res.status(200).json({ challenge: slackPayload.challenge });
      }

      // Handle event callbacks
      if (slackPayload.type !== "event_callback") {
        return res.status(200).json({ ok: true });
      }

      const event = slackPayload.event;
      if (!event) {
        return res.status(200).json({ ok: true });
      }

      // Handle: app_mention, direct messages, and thread replies (conversation continuity)
      const isAppMention = event.type === "app_mention";
      const isDirectMessage =
        event.type === "message" && event.channel_type === "im" && !event.subtype;
      // Thread continuity: messages in a thread (thread_ts set) are follow-ups — no @mention needed
      const isThreadReply =
        event.type === "message" &&
        !event.subtype &&
        event.thread_ts &&
        event.ts !== event.thread_ts;
      if (!isAppMention && !isDirectMessage && !isThreadReply) {
        return res.status(200).json({ ok: true });
      }

      // Ignore bot's own messages
      if (event.bot_id || event.user === resolvedIntegration.slackBotUserId) {
        return res.status(200).json({ ok: true });
      }

      if (!resolvedIntegration.slackBotToken) {
        throw new AppError("Slack bot token is not configured", 400);
      }

      // Respond to Slack immediately to prevent retries (Slack times out after 3s)
      res.status(200).json({ ok: true });

      // Everything below runs in background after 200 is sent
      const userId = resolvedIntegration.userId;
      let messageText = event.text || "";
      const channel = event.channel;
      const threadTs = event.thread_ts || event.ts; // Reply in thread
      const senderId = event.user || "unknown";

      // Strip bot mention from text (e.g. "<@U12345> check my calendar" -> "check my calendar")
      if (isAppMention && resolvedIntegration.slackBotUserId) {
        messageText = messageText
          .replace(new RegExp(`<@${resolvedIntegration.slackBotUserId}>`, "g"), "")
          .trim();
      }

      void (async () => {
        try {
          // Premium feature check
          try {
            await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.SLACK_CHAT_INTEGRATION);
          } catch {
            try {
              await chatIntegrationService.sendSlackMessage(
                resolvedIntegration.slackBotToken!,
                channel,
                "Slack chat with Verxio is a premium feature. Please upgrade your plan to use it.",
                threadTs
              );
            } catch (_) {}
            return;
          }

          // Consume credits
          try {
            await consumePremiumQuota(userId, QUOTA_COST.SLACK_CHAT_INTEGRATION);
          } catch (quotaError) {
            const msg = quotaError instanceof Error ? quotaError.message : "Rate limit exceeded.";
            try {
              await chatIntegrationService.sendSlackMessage(
                resolvedIntegration.slackBotToken!,
                channel,
                msg.includes("credits")
                  ? "You've used your daily chat credits. Limit resets at midnight."
                  : msg,
                threadTs
              );
            } catch (_) {}
            return;
          }

          // Auto-link external identity
          try {
            await chatIntegrationService.linkExternalIdentity(
              userId,
              "slack",
              senderId,
              integrationId,
              undefined,
              { channel, teamId: slackPayload.team_id }
            );
          } catch (_) {}

          const isChannel = event.channel_type !== "im";
          const chatIntegrationMessage = {
            platform: "SLACK" as const,
            externalId: senderId,
            message: messageText || "[non-text message]",
            metadata: {
              chatId: channel,
              threadTs,
              slackPayload,
            },
          };

          // Prefix for channel replies so it's clear who the reply is for (Slack @mention)
          const groupPrefix = isChannel && senderId ? `<@${senderId}> ` : "";

          const result = await chatIntegrationService.processMessage(
            userId,
            resolvedIntegration,
            chatIntegrationMessage
          );
          const replyText = result.message?.trim() || "";
          const withPrefix = replyText ? groupPrefix + replyText : "";
          const textToSend = withPrefix
            ? chatIntegrationService.formatSlackMessage(withPrefix)
            : "Done.";
          await chatIntegrationService.sendSlackMessage(
            resolvedIntegration.slackBotToken!,
            channel,
            textToSend,
            threadTs
          );
        } catch (err) {
          console.error("[Slack webhook] processMessage error:", err);
          try {
            await chatIntegrationService.sendSlackMessage(
              resolvedIntegration.slackBotToken!,
              channel,
              "Something went wrong. Please try again.",
              threadTs
            );
          } catch (_) {}
        }
      })().catch((err) => console.error("[Slack webhook] background error:", err));
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Hosted Telegram Webhook (no chat integration required)
// ============================================

/**
 * POST /api/chat-integrations/telegram/webhook/:integrationId
 * Receive Telegram updates directly and respond using hosted gateway mode.
 */
chatIntegrationRouter.post(
  "/telegram/webhook/:integrationId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { integrationId } = req.params;
      const telegramUpdate = req.body;

      const resolvedIntegration = await chatIntegrationService.getIntegrationById(integrationId);

      if (!resolvedIntegration) {
        throw new AppError("chat integration not found", 404);
      }
      if (resolvedIntegration.platform !== "TELEGRAM") {
        throw new AppError("This integration is not configured for Telegram.", 400);
      }

      // Verify Telegram webhook secret token
      const secretHeader = req.headers["x-telegram-bot-api-secret-token"] as string | undefined;
      if (!secretHeader) {
        throw new AppError("Missing Telegram secret token header", 401);
      }

      const secretBuffer = Buffer.from(secretHeader);
      const expectedBuffer = Buffer.from(resolvedIntegration.sharedSecret);
      if (secretBuffer.length !== expectedBuffer.length) {
        throw new AppError("Invalid Telegram secret token", 401);
      }
      const secretMatch = crypto.timingSafeEqual(secretBuffer, expectedBuffer);

      if (!secretMatch) {
        throw new AppError("Invalid Telegram secret token", 401);
      }

      if (!resolvedIntegration.telegramBotToken) {
        throw new AppError("Telegram bot token is not configured", 400);
      }

      // Extract Telegram message
      const message =
        telegramUpdate?.message ||
        telegramUpdate?.edited_message ||
        telegramUpdate?.callback_query?.message;

      if (!message) {
        return res.status(200).json({ success: true, message: "No message to process." });
      }

      let text = message.text || message.caption || "";
      const chatId = message.chat?.id;
      const sender = message.from || telegramUpdate?.callback_query?.from;
      const chatType = message.chat?.type as string | undefined; // "private" | "group" | "supergroup"
      const isGroupChat = chatType === "group" || chatType === "supergroup";
      const messageId = message.message_id; // for reply threading in groups

      if (!chatId) {
        throw new AppError("Missing chat ID in Telegram update", 400);
      }

      // In group chats, only respond when the bot is mentioned or the message is a reply to the bot
      if (isGroupChat) {
        const botInfo = await chatIntegrationService.ensureTelegramBotInfo(resolvedIntegration);
        const botUsername =
          botInfo?.telegramBotUsername ?? resolvedIntegration.telegramBotUsername ?? "";
        const botId = botInfo?.telegramBotId ?? resolvedIntegration.telegramBotId ?? "";
        const entities = message.entities || [];
        const replyTo = message.reply_to_message;

        // Telegram can send @mentions as "mention" or "text_link" (url: https://t.me/BotUsername)
        const mentionedInEntities = entities.some((e: any) => {
          const substring = text
            .substring(e.offset || 0, (e.offset || 0) + (e.length || 0))
            .toLowerCase();
          if (e.type === "mention" && botUsername) {
            return substring === `@${botUsername.toLowerCase()}`;
          }
          if (e.type === "text_link" && botUsername && e.url) {
            const tmeMatch = e.url.match(/^https?:\/\/t\.me\/([^/?]+)/i);
            return tmeMatch && tmeMatch[1].toLowerCase() === botUsername.toLowerCase();
          }
          return false;
        });
        const isReplyToBot = replyTo?.from?.id?.toString() === botId && botId !== "";

        if (!mentionedInEntities && !isReplyToBot) {
          return res.status(200).json({ success: true });
        }

        // Strip the @botusername mention from the text so the agent sees clean input
        if (mentionedInEntities && botUsername) {
          text = text.replace(new RegExp(`@${botUsername}`, "gi"), "").trim();
        }
      }

      const userId = resolvedIntegration.userId;

      // Telegram Chat Integration is a premium feature
      try {
        await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.TELEGRAM_CHAT_INTEGRATION);
      } catch {
        const premiumMessage =
          "Telegram chat with Verxio is a premium feature. Please upgrade your plan to use it.";
        try {
          const formatted = chatIntegrationService.formatTelegramMessage(premiumMessage);
          await fetch(
            `https://api.telegram.org/bot${resolvedIntegration.telegramBotToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: formatted,
                parse_mode: "HTML",
                ...(isGroupChat && messageId ? { reply_to_message_id: messageId } : {}),
              }),
            }
          );
        } catch (_) {}
        return res.status(200).json({ success: true, premiumRequired: true });
      }

      const senderId = sender?.id?.toString() || "unknown";
      const senderName =
        sender?.username ||
        [sender?.first_name, sender?.last_name].filter(Boolean).join(" ") ||
        undefined;

      // Consume credits for this chat message (beta-tester plan only)
      try {
        await consumePremiumQuota(userId, QUOTA_COST.TELEGRAM_CHAT_INTEGRATION);
      } catch (quotaError) {
        const msg = quotaError instanceof Error ? quotaError.message : "Rate limit exceeded.";
        try {
          const formatted = chatIntegrationService.formatTelegramMessage(
            msg.includes("credits")
              ? "You've used your daily chat credits. Limit resets at midnight."
              : msg
          );
          await fetch(
            `https://api.telegram.org/bot${resolvedIntegration.telegramBotToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: formatted,
                parse_mode: "HTML",
                ...(isGroupChat && messageId ? { reply_to_message_id: messageId } : {}),
              }),
            }
          );
        } catch (_) {}
        return res.status(200).json({ success: true, quotaExceeded: true });
      }

      // Auto-link external identity if not already linked
      try {
        await chatIntegrationService.linkExternalIdentity(
          userId,
          "telegram",
          senderId,
          integrationId,
          senderName,
          { chatId, username: sender?.username }
        );
      } catch (linkError) {
        // Ignore if already linked to same user
      }

      const chatIntegrationMessage = {
        platform: "telegram" as const,
        externalId: senderId,
        externalName: senderName,
        message: text || "[non-text message]",
        metadata: {
          chatId,
          updateId: telegramUpdate?.update_id,
          telegramPayload: telegramUpdate,
        },
      };

      // Process in background and send formatted result when done
      // No username prefix needed — reply_to_message_id already links the reply to the original message
      void (async () => {
        try {
          const result = await chatIntegrationService.processMessage(
            userId,
            resolvedIntegration,
            chatIntegrationMessage
          );
          const replyText = result.message?.trim() || "";
          const textToSend = replyText
            ? chatIntegrationService.formatTelegramMessage(replyText)
            : "Done.";
          await fetch(
            `https://api.telegram.org/bot${resolvedIntegration.telegramBotToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: textToSend,
                parse_mode: "HTML",
                ...(isGroupChat && messageId ? { reply_to_message_id: messageId } : {}),
              }),
            }
          );
        } catch (err) {
          console.error("[Telegram webhook] processMessage error:", err);
          try {
            await fetch(
              `https://api.telegram.org/bot${resolvedIntegration.telegramBotToken}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: "Something went wrong. Please try again.",
                  parse_mode: "HTML",
                  ...(isGroupChat && messageId ? { reply_to_message_id: messageId } : {}),
                }),
              }
            );
          } catch (_) {}
        }
      })().catch((err) => console.error("[Telegram webhook] background error:", err));

      return res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Telegram Message Routes (require Chat Integration Auth)
// ============================================

/**
 * POST /api/chat-integrations/telegram/message
 * Process incoming Telegram message from ChatIntegration
 *
 * This is the main endpoint that chat integration calls with user messages.
 * It uses the shared secret for authentication.
 */
chatIntegrationRouter.post(
  "/telegram/message",
  chatIntegrationAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integration = (req as any).chatIntegration;
      const { message, senderId, senderName, attachments, metadata } = req.body;

      if (!message || typeof message !== "string") {
        throw new AppError("Message is required", 400);
      }

      // Build the ChatIntegration message object
      const chatIntegrationMessage: chatIntegrationService.ChatIntegrationMessage = {
        platform: "telegram",
        externalId: senderId || (req as any).externalIdentity?.externalId || "unknown",
        externalName: senderName || (req as any).externalIdentity?.externalName,
        message,
        attachments,
        metadata,
      };

      // Process the message
      const result = await chatIntegrationService.processMessage(
        user.id,
        integration,
        chatIntegrationMessage
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/telegram/message/stream
 * Process incoming Telegram message with SSE streaming
 */
chatIntegrationRouter.post(
  "/telegram/message/stream",
  chatIntegrationAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integration = (req as any).chatIntegration;
      const { message, senderId, senderName, attachments, metadata } = req.body;

      if (!message || typeof message !== "string") {
        throw new AppError("Message is required", 400);
      }

      // Set up SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const chatIntegrationMessage: chatIntegrationService.ChatIntegrationMessage = {
        platform: "telegram",
        externalId: senderId || (req as any).externalIdentity?.externalId || "unknown",
        externalName: senderName || (req as any).externalIdentity?.externalName,
        message,
        attachments,
        metadata,
      };

      try {
        for await (const event of chatIntegrationService.processMessageStreaming(
          user.id,
          integration,
          chatIntegrationMessage
        )) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ type: "complete" })}\n\n`);
      } catch (error) {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : String(error),
          })}\n\n`
        );
      }

      res.end();
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/chat-integrations/telegram/link
 * Link a Telegram user to a Verxio account via ChatIntegration
 *
 * Called by chat integration when a user wants to link their Telegram account.
 * This creates an external identity mapping.
 */
chatIntegrationRouter.post(
  "/telegram/link",
  chatIntegrationAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { telegramId, telegramUsername, telegramFirstName, telegramLastName, metadata } =
        req.body;

      if (!telegramId) {
        throw new AppError("Telegram ID is required", 400);
      }

      const fullName = [telegramFirstName, telegramLastName].filter(Boolean).join(" ");

      const identity = await chatIntegrationService.linkExternalIdentity(
        user.id,
        "telegram",
        telegramId.toString(),
        telegramUsername || fullName || undefined,
        {
          username: telegramUsername,
          firstName: telegramFirstName,
          lastName: telegramLastName,
          ...metadata,
        }
      );

      res.json({
        success: true,
        message: `Telegram account linked successfully! You can now use Verxio from Telegram.`,
        identity: {
          id: identity.id,
          platform: identity.platform,
          externalId: identity.externalId,
          externalName: identity.externalName,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/chat-integrations/telegram/status
 * Check the link status for a Telegram user
 */
chatIntegrationRouter.get(
  "/telegram/status",
  chatIntegrationAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integration = (req as any).chatIntegration;
      const externalIdentity = (req as any).externalIdentity;

      res.json({
        success: true,
        linked: !!externalIdentity,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        integration: {
          isActive: integration.isActive,
          allowPlanMode: integration.allowPlanMode,
          allowWorkflowExecution: integration.allowWorkflowExecution,
        },
        identity: externalIdentity
          ? {
              platform: externalIdentity.platform,
              externalId: externalIdentity.externalId,
              externalName: externalIdentity.externalName,
              linkedAt: externalIdentity.linkedAt,
            }
          : null,
      });
    } catch (error) {
      next(error);
    }
  }
);
