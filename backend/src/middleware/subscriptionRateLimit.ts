/**
 * Subscription Rate Limiting Middleware
 *
 * Enforces rate limits for beta-testers only using credit-based quota system.
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";
import { consumePremiumQuota, getUserSubscription } from "@/services/subscriptionService";
import { BETA_TESTER_DAILY_CREDITS } from "@/config/rate-limits";

/**
 * Middleware factory to check and enforce rate limits with a specific cost
 * @param cost - Number of credits to consume for this action
 */
export const checkQuota = (cost: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user || !user.id) {
        throw new AppError("Authentication required", 401);
      }

      // Consume quota (only enforces for beta-testers, no-op for others)
      try {
        await consumePremiumQuota(user.id, cost);
      } catch (error) {
        // If it's a quota exceeded error, return 429
        if (error instanceof Error && error.message.includes("Rate limit exceeded")) {
          throw new AppError(error.message, 429);
        }
        // Re-throw other errors
        throw error;
      }

      // Get updated subscription to set headers
      const subscription = await getUserSubscription(user.id);
      if (subscription && subscription.subscriptionPlan === "beta-tester") {
        const resetTime = subscription.rateLimitResetAt
          ? new Date(subscription.rateLimitResetAt).getTime()
          : Date.now() + 24 * 60 * 60 * 1000; // Fallback: 24h from now

        // Add rate limit headers to response
        res.setHeader("X-RateLimit-Limit", BETA_TESTER_DAILY_CREDITS.toString());
        res.setHeader("X-RateLimit-Remaining", (subscription.rateLimitRemaining ?? 0).toString());
        res.setHeader("X-RateLimit-Reset", resetTime.toString());
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }
      next(new AppError("Rate limit check failed", 500));
    }
  };
};

/**
 * Legacy middleware for backward compatibility
 * Uses cost of 1 (for routes that haven't been updated yet)
 * @deprecated Use checkQuota(cost) instead
 */
export const checkRateLimit = checkQuota(1);
