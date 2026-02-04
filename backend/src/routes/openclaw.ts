import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { openclawAuthMiddleware } from "../middleware/openclawAuth";
import { AppError } from "../middleware/errorHandler";
import * as openclawService from "../services/openclawService";

export const openclawRouter: Router = Router();

async function requireSingleIntegration(userId: string) {
  const integrations = await openclawService.listIntegrations(userId);
  if (integrations.length === 0) {
    throw new AppError("No OpenClaw integration found.", 404);
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
 * GET /api/openclaw/integrations
 * List user's OpenClaw integrations
 */
openclawRouter.get(
  "/integrations",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integrations = await openclawService.listIntegrations(user.id);
      res.json({
        success: true,
        integrations: integrations.map((integration: any) => ({
          id: integration.id,
          label: integration.label,
          platform: integration.platform,
          scope: integration.scope,
          scopeWorkflowId: integration.scopeWorkflowId,
          allowedWorkflowIds: integration.allowedWorkflowIds,
          webhookUrl: integration.webhookUrl,
          secretPreview: `${integration.sharedSecret.slice(0, 8)}...${integration.sharedSecret.slice(-4)}`,
          isActive: integration.isActive,
          defaultWorkflowId: integration.defaultWorkflowId,
          allowPlanMode: integration.allowPlanMode,
          allowWorkflowExecution: integration.allowWorkflowExecution,
          totalRequests: integration.totalRequests,
          lastUsedAt: integration.lastUsedAt,
          createdAt: integration.createdAt,
          telegramBotTokenSet: !!integration.telegramBotToken,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/openclaw/integrations
 * Create a new integration
 */
openclawRouter.post(
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
      } = req.body;

      if (!label || typeof label !== "string") {
        throw new AppError("Integration label is required", 400);
      }

      const integration = await openclawService.createIntegration(user.id, {
        label: label.trim(),
        platform,
        scope,
        scopeWorkflowId,
        allowedWorkflowIds,
        isActive,
        allowPlanMode,
        allowWorkflowExecution,
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
          webhookUrl: integration.webhookUrl,
          secretPreview: `${integration.sharedSecret.slice(0, 8)}...${integration.sharedSecret.slice(-4)}`,
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
 * GET /api/openclaw/integrations/:id
 * Get integration details
 */
openclawRouter.get(
  "/integrations/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const integration = await openclawService.getIntegration(user.id, id);
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
          webhookUrl: integration.webhookUrl,
          secretPreview: `${integration.sharedSecret.slice(0, 8)}...${integration.sharedSecret.slice(-4)}`,
          isActive: integration.isActive,
          defaultWorkflowId: integration.defaultWorkflowId,
          allowPlanMode: integration.allowPlanMode,
          allowWorkflowExecution: integration.allowWorkflowExecution,
          totalRequests: integration.totalRequests,
          lastUsedAt: integration.lastUsedAt,
          createdAt: integration.createdAt,
          telegramBotTokenSet: !!integration.telegramBotToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/openclaw/integrations/:id/secret
 * Get the full shared secret (use sparingly)
 */
openclawRouter.get(
  "/integrations/:id/secret",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const integration = await openclawService.getIntegration(user.id, id);
      if (!integration) {
        throw new AppError("Integration not found", 404);
      }

      res.json({
        success: true,
        sharedSecret: integration.sharedSecret,
        webhookUrl: integration.webhookUrl,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/openclaw/integrations/:id
 * Update integration settings
 */
openclawRouter.put(
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
      } = req.body;

      const integration = await openclawService.updateIntegration(user.id, id, {
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
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/openclaw/integrations/:id/telegram/token
 * Save Telegram bot token and configure hosted webhook
 */
openclawRouter.post(
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

      const integration = await openclawService.saveTelegramBotToken(
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
          webhookUrl: integration.webhookUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/openclaw/integrations/:id/regenerate-secret
 * Regenerate the shared secret
 */
openclawRouter.post(
  "/integrations/:id/regenerate-secret",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const newSecret = await openclawService.regenerateSecret(user.id, id);

      res.json({
        success: true,
        message: "Shared secret regenerated successfully. Update your OpenClaw configuration.",
        sharedSecret: newSecret,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/openclaw/integrations/:id
 * Delete an integration and linked identities
 */
openclawRouter.delete(
  "/integrations/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      await openclawService.deleteIntegration(user.id, id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/openclaw/integrations/:id/test
 * Test integration connection
 */
openclawRouter.post(
  "/integrations/:id/test",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const result = await openclawService.testConnection(user.id, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/openclaw/integration
 * Get the user's OpenClaw integration settings
 */
openclawRouter.get(
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
          webhookUrl: integration.webhookUrl,
          secretPreview: `${integration.sharedSecret.slice(0, 8)}...${integration.sharedSecret.slice(-4)}`,
          isActive: integration.isActive,
          defaultWorkflowId: integration.defaultWorkflowId,
          allowPlanMode: integration.allowPlanMode,
          allowWorkflowExecution: integration.allowWorkflowExecution,
          totalRequests: integration.totalRequests,
          lastUsedAt: integration.lastUsedAt,
          createdAt: integration.createdAt,
          telegramBotTokenSet: !!integration.telegramBotToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/openclaw/integration/secret
 * Get the full shared secret (use sparingly, for initial setup)
 */
openclawRouter.get(
  "/integration/secret",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integration = await requireSingleIntegration(user.id);

      res.json({
        success: true,
        sharedSecret: integration.sharedSecret,
        webhookUrl: integration.webhookUrl,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/openclaw/integration
 * Update integration settings
 */
openclawRouter.put(
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
      const integration = await openclawService.updateIntegration(user.id, integrationToUpdate.id, {
        isActive,
        defaultWorkflowId,
        allowPlanMode,
        allowWorkflowExecution,
        telegramBotToken,
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
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/openclaw/telegram/token
 * Save Telegram bot token and configure hosted webhook
 */
openclawRouter.post(
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
      const integration = await openclawService.saveTelegramBotToken(
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
          webhookUrl: integration.webhookUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/openclaw/integration/regenerate-secret
 * Regenerate the shared secret
 */
openclawRouter.post(
  "/integration/regenerate-secret",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integrationToUpdate = await requireSingleIntegration(user.id);
      const newSecret = await openclawService.regenerateSecret(user.id, integrationToUpdate.id);

      res.json({
        success: true,
        message: "Shared secret regenerated successfully. Update your OpenClaw configuration.",
        sharedSecret: newSecret,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/openclaw/integration
 * Delete the integration and all linked identities
 */
openclawRouter.delete(
  "/integration",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integrationToDelete = await requireSingleIntegration(user.id);
      await openclawService.deleteIntegration(user.id, integrationToDelete.id);

      res.json({
        success: true,
        message: "OpenClaw integration deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/openclaw/integration/test
 * Test the integration connection
 */
openclawRouter.post(
  "/integration/test",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integrationToTest = await requireSingleIntegration(user.id);
      const result = await openclawService.testConnection(user.id, integrationToTest.id);

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
 * GET /api/openclaw/identities
 * Get all linked external identities for the user
 */
openclawRouter.get(
  "/identities",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integrationId = req.query.integrationId as string | undefined;
      const identities = await openclawService.getExternalIdentities(user.id, integrationId);

      res.json({
        success: true,
        identities,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/openclaw/identities/link
 * Link a new external identity (for manual linking via dashboard)
 */
openclawRouter.post(
  "/identities/link",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { platform, externalId, externalName, metadata, integrationId } = req.body;

      if (!platform || !externalId) {
        throw new AppError("Platform and external ID are required", 400);
      }

      const identity = await openclawService.linkExternalIdentity(
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
 * DELETE /api/openclaw/identities/:platform/:externalId
 * Unlink an external identity
 */
openclawRouter.delete(
  "/identities/:platform/:externalId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { platform, externalId } = req.params;
      const integrationId = req.query.integrationId as string | undefined;

      await openclawService.unlinkExternalIdentity(user.id, platform, externalId, integrationId);

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
// Hosted Telegram Webhook (no OpenClaw required)
// ============================================

/**
 * POST /api/openclaw/telegram/webhook/:integrationId
 * Receive Telegram updates directly and respond using hosted gateway mode.
 */
openclawRouter.post(
  "/telegram/webhook/:integrationId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { integrationId } = req.params;
      const telegramUpdate = req.body;

      const resolvedIntegration = await openclawService.getIntegrationById(integrationId);

      if (!resolvedIntegration) {
        throw new AppError("OpenClaw integration not found", 404);
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

      const text = message.text || message.caption || "";
      const chatId = message.chat?.id;
      const sender = message.from || telegramUpdate?.callback_query?.from;

      if (!chatId) {
        throw new AppError("Missing chat ID in Telegram update", 400);
      }

      const userId = resolvedIntegration.userId;
      const senderId = sender?.id?.toString() || "unknown";
      const senderName =
        sender?.username ||
        [sender?.first_name, sender?.last_name].filter(Boolean).join(" ") ||
        undefined;

      // Auto-link external identity if not already linked
      try {
        await openclawService.linkExternalIdentity(
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

      // Process message through OpenClaw logic
      const result = await openclawService.processMessage(userId, resolvedIntegration, {
        platform: "telegram",
        externalId: senderId,
        externalName: senderName,
        message: text || "[non-text message]",
        metadata: {
          chatId,
          updateId: telegramUpdate?.update_id,
          telegramPayload: telegramUpdate,
        },
      });

      // Send response back to Telegram
      if (result?.message) {
        const formatted = openclawService.formatTelegramMessage(result.message);
        await fetch(
          `https://api.telegram.org/bot${resolvedIntegration.telegramBotToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: formatted,
              parse_mode: "HTML",
            }),
          }
        );
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Telegram Message Routes (require OpenClaw Auth)
// ============================================

/**
 * POST /api/openclaw/telegram/message
 * Process incoming Telegram message from OpenClaw
 *
 * This is the main endpoint that OpenClaw calls with user messages.
 * It uses the shared secret for authentication.
 */
openclawRouter.post(
  "/telegram/message",
  openclawAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integration = (req as any).openclawIntegration;
      const { message, senderId, senderName, attachments, metadata } = req.body;

      if (!message || typeof message !== "string") {
        throw new AppError("Message is required", 400);
      }

      // Build the OpenClaw message object
      const openclawMessage: openclawService.OpenClawMessage = {
        platform: "telegram",
        externalId: senderId || (req as any).externalIdentity?.externalId || "unknown",
        externalName: senderName || (req as any).externalIdentity?.externalName,
        message,
        attachments,
        metadata,
      };

      // Process the message
      const result = await openclawService.processMessage(user.id, integration, openclawMessage);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/openclaw/telegram/message/stream
 * Process incoming Telegram message with SSE streaming
 */
openclawRouter.post(
  "/telegram/message/stream",
  openclawAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integration = (req as any).openclawIntegration;
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

      const openclawMessage: openclawService.OpenClawMessage = {
        platform: "telegram",
        externalId: senderId || (req as any).externalIdentity?.externalId || "unknown",
        externalName: senderName || (req as any).externalIdentity?.externalName,
        message,
        attachments,
        metadata,
      };

      try {
        for await (const event of openclawService.processMessageStreaming(
          user.id,
          integration,
          openclawMessage
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
 * POST /api/openclaw/telegram/link
 * Link a Telegram user to a Verxio account via OpenClaw
 *
 * Called by OpenClaw when a user wants to link their Telegram account.
 * This creates an external identity mapping.
 */
openclawRouter.post(
  "/telegram/link",
  openclawAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { telegramId, telegramUsername, telegramFirstName, telegramLastName, metadata } =
        req.body;

      if (!telegramId) {
        throw new AppError("Telegram ID is required", 400);
      }

      const fullName = [telegramFirstName, telegramLastName].filter(Boolean).join(" ");

      const identity = await openclawService.linkExternalIdentity(
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
 * GET /api/openclaw/telegram/status
 * Check the link status for a Telegram user
 */
openclawRouter.get(
  "/telegram/status",
  openclawAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const integration = (req as any).openclawIntegration;
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
