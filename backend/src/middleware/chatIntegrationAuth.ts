import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "./errorHandler";
import crypto from "crypto";

/**
 * ChatIntegration Authentication Middleware
 *
 * Validates incoming requests from ChatIntegration using shared secret authentication.
 * The shared secret is sent via the X-ChatIntegration-Secret header and must match
 * the user's configured secret in the ChatIntegration record.
 *
 * Headers required:
 * - X-ChatIntegration-Secret: The shared secret for authentication
 * - X-ChatIntegration-User-Id: The Verxio user ID (for lookup)
 * - X-ChatIntegration-Integration-Id: The Chat Integration integration ID (recommended)
 *
 * Or alternatively:
 * - X-ChatIntegration-Secret: The shared secret for authentication
 * - X-ChatIntegration-Platform: Platform identifier (e.g., "telegram")
 * - X-ChatIntegration-External-Id: External platform user ID
 */
export const chatIntegrationAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const secret = req.headers["x-chat-integration-secret"] as string;
    const userId = req.headers["x-chat-integration-user-id"] as string;
    const integrationId = req.headers["x-chat-integration-integration-id"] as string;

    if (!secret) {
      throw new AppError(
        "ChatIntegration authentication required. X-ChatIntegration-Secret header is missing.",
        401
      );
    }

    // If userId is provided directly, use it for lookup
    if (userId) {
      if (!integrationId) {
        const count = await (prisma as any).chatIntegration.count({ where: { userId } });
        if (count > 1) {
          throw new AppError(
            "Multiple Chat Integration integrations found. Provide X-Chat Integration-Integration-Id.",
            400
          );
        }
      }

      const where = integrationId ? { id: integrationId, userId } : { userId };
      const integration = await (prisma as any).chatIntegration.findFirst({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              subscriptionPlan: true,
            },
          },
        },
      });

      if (!integration) {
        throw new AppError(
          "Chat Integration integration not found for this user. Provide X-ChatIntegration-Integration-Id.",
          404
        );
      }

      if (!integration.isActive) {
        throw new AppError("Chat Integration integration is disabled.", 403);
      }

      // Use timing-safe comparison to prevent timing attacks
      const secretMatch = crypto.timingSafeEqual(
        Buffer.from(secret),
        Buffer.from(integration.sharedSecret)
      );

      if (!secretMatch) {
        throw new AppError("Invalid ChatIntegration secret.", 401);
      }

      // Update last used timestamp and increment request count
      await (prisma as any).chatIntegration.update({
        where: { id: integration.id },
        data: {
          lastUsedAt: new Date(),
          totalRequests: { increment: 1 },
        },
      });

      // Attach user and integration info to request
      (req as any).user = integration.user;
      (req as any).chatIntegration = integration;

      return next();
    }

    // Fallback: Look up by external identity if platform info is provided
    const platform = req.headers["x-chat-integration-platform"] as string;
    const externalId = req.headers["x-chat-integration-external-id"] as string;

    if (platform && externalId) {
      const externalIdentity = await (prisma as any).externalIdentity.findUnique({
        where: {
          platform_externalId_integrationId: {
            platform,
            externalId,
            integrationId: integrationId || null,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              subscriptionPlan: true,
            },
          },
        },
      });

      if (externalIdentity && externalIdentity.isActive) {
        const integration = await (prisma as any).chatIntegration.findFirst({
          where: {
            id: integrationId || externalIdentity.integrationId,
            userId: externalIdentity.userId,
          },
        });

        if (integration && integration.isActive) {
          // Verify secret
          const secretMatch = crypto.timingSafeEqual(
            Buffer.from(secret),
            Buffer.from(integration.sharedSecret)
          );

          if (secretMatch) {
            // Update timestamps
            await Promise.all([
              (prisma as any).chatIntegration.update({
                where: { id: integration.id },
                data: {
                  lastUsedAt: new Date(),
                  totalRequests: { increment: 1 },
                },
              }),
              (prisma as any).externalIdentity.update({
                where: { id: externalIdentity.id },
                data: { lastActiveAt: new Date() },
              }),
            ]);

            // Attach user and integration info to request
            (req as any).user = externalIdentity.user;
            (req as any).chatIntegration = integration;
            (req as any).externalIdentity = externalIdentity;

            return next();
          }
        }
      }
    }

    throw new AppError(
      "ChatIntegration authentication failed. Provide X-ChatIntegration-User-Id or valid platform/external ID.",
      401
    );
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    console.error("[ChatIntegration Auth] Error:", error);
    next(new AppError("ChatIntegration authentication failed", 401));
  }
};

/**
 * Generate a cryptographically secure shared secret
 */
export function generateSharedSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a shared secret for storage (optional, if you want extra security)
 */
export function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}
