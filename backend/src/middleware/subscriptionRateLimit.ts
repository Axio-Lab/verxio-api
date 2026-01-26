/**
 * Subscription Rate Limiting Middleware
 *
 * Enforces rate limits for promotional plans and tracks usage.
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";
import { prisma } from "@/lib/prisma";
import { getRateLimitConfig, calculateResetTime } from "@/config/rate-limits";
import { getUserSubscription } from "@/services/subscriptionService";

/**
 * Middleware to check and enforce rate limits
 */
export const checkRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    if (!user || !user.id) {
      throw new AppError("Authentication required", 401);
    }

    // Get user subscription
    const subscription = await getUserSubscription(user.id);

    if (!subscription || !subscription.isSubscribed) {
      // No subscription, no rate limiting (will be blocked by subscription middleware)
      return next();
    }

    // Get rate limit config for the plan
    const rateLimitConfig = getRateLimitConfig(subscription.subscriptionPlan);

    // Check if we need to reset the limit
    const now = new Date();
    let rateLimitRemaining = subscription.rateLimitRemaining;
    let rateLimitResetAt = subscription.rateLimitResetAt;

    if (!rateLimitResetAt || rateLimitResetAt < now) {
      // Reset the limit
      rateLimitResetAt = calculateResetTime(
        rateLimitConfig,
        subscription.rateLimitResetAt ? new Date(subscription.rateLimitResetAt) : null
      );
      rateLimitRemaining = rateLimitConfig.requestsPerPeriod;
    }

    // Check if user has remaining requests
    if (rateLimitRemaining <= 0) {
      const resetTime = rateLimitResetAt.toISOString();
      throw new AppError(
        `Rate limit exceeded. You have used all ${rateLimitConfig.requestsPerPeriod} requests for this ${rateLimitConfig.period}. Limit resets at ${new Date(resetTime).toLocaleString()}.`,
        429
      );
    }

    // Decrement remaining requests
    const newRemaining = rateLimitRemaining - 1;

    // Update database (async, don't wait)
    prisma.user
      .update({
        where: { id: user.id },
        data: {
          rateLimitRemaining: newRemaining,
          rateLimitResetAt,
        },
      })
      .catch((error) => {
        console.error("[RateLimit] Error updating rate limit:", error);
      });

    // Add rate limit headers to response
    res.setHeader("X-RateLimit-Limit", rateLimitConfig.requestsPerPeriod.toString());
    res.setHeader("X-RateLimit-Remaining", newRemaining.toString());
    res.setHeader("X-RateLimit-Reset", rateLimitResetAt.getTime().toString());

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError("Rate limit check failed", 500));
  }
};
