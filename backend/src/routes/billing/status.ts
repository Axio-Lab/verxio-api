/**
 * GET /api/billing/status
 * Get current user's subscription status
 */

import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "@/middleware/betterAuth";
import { AppError } from "@/middleware/errorHandler";
import { getUserSubscription } from "@/services/subscriptionService";

export const billingStatusRouter = Router();

billingStatusRouter.use(betterAuthMiddleware);

/**
 * POST /api/billing/update
 * Update subscription (internal API for webhook handlers)
 */
billingStatusRouter.post("/update", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, status, plan, expiresAt, polarCustomerId } = req.body;

    if (!userId) {
      throw new AppError("userId is required", 400);
    }

    // Import subscription service
    const { updateSubscription } = await import("@/services/subscriptionService");

    const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined;

    const result = await updateSubscription({
      userId,
      status,
      plan,
      expiresAt: expiresAtDate,
      polarCustomerId,
    });

    if (!result.success) {
      throw new AppError(result.error || "Failed to update subscription", 500);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError("Failed to update subscription", 500));
  }
});

billingStatusRouter.get("/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    if (!user || !user.id) {
      throw new AppError("Authentication required", 401);
    }

    const subscription = await getUserSubscription(user.id);

    if (!subscription) {
      return res.status(200).json({
        subscriptionStatus: null,
        subscriptionPlan: null,
        subscriptionExpiresAt: null,
        rateLimitRemaining: 0,
        rateLimitTotal: 0,
        rateLimitResetAt: null,
        features: [],
        isSubscribed: false,
        planDisplayName: "Free",
      });
    }

    res.status(200).json(subscription);
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError("Failed to get subscription status", 500));
  }
});
