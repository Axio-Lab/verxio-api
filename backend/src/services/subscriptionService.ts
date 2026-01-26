/**
 * Subscription Service
 *
 * Handles subscription management logic including:
 * - Updating subscription status
 * - Calculating expiration dates
 * - Granting/revoking feature access
 * - Syncing with Polar customer state
 */

import { prisma } from "@/lib/prisma";
import { getPlanFeatures, type SubscriptionFeature } from "@/config/subscription-features";
import { getRateLimitConfig, calculateResetTime } from "@/config/rate-limits";

export interface SubscriptionUpdateParams {
  userId: string;
  status?: "active" | "expired" | "canceled" | "trial" | null;
  plan?: string | null;
  expiresAt?: Date | null;
  polarCustomerId?: string | null;
  features?: SubscriptionFeature[];
}

/**
 * Update user subscription status and grant appropriate features
 */
export async function updateSubscription(
  params: SubscriptionUpdateParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId, status, plan, expiresAt, polarCustomerId, features } = params;

    // Get features for the plan if not provided
    const planFeatures = features || getPlanFeatures(plan);

    // Get rate limit config for the plan
    const rateLimitConfig = getRateLimitConfig(plan);
    const resetTime = calculateResetTime(rateLimitConfig, null);

    // Update user subscription
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(status !== undefined && { subscriptionStatus: status }),
        ...(plan !== undefined && { subscriptionPlan: plan }),
        ...(expiresAt !== undefined && { subscriptionExpiresAt: expiresAt }),
        ...(polarCustomerId !== undefined && { polarCustomerId }),
        subscriptionFeatures: planFeatures,
        rateLimitRemaining: rateLimitConfig.requestsPerPeriod,
        rateLimitResetAt: resetTime,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[SubscriptionService] Error updating subscription:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Calculate expiration date for beta-tester plan (6 months from now)
 */
export function calculateBetaTesterExpiration(): Date {
  const expiration = new Date();
  expiration.setMonth(expiration.getMonth() + 6);
  return expiration;
}

/**
 * Check if subscription is active and not expired
 */
export async function isSubscriptionActive(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        subscriptionPlan: true,
      },
    });

    if (!user) {
      return false;
    }

    // If no subscription plan, user is on free plan
    if (!user.subscriptionPlan || user.subscriptionPlan.trim() === "") {
      return false;
    }

    // Check if status is active
    if (user.subscriptionStatus !== "active") {
      return false;
    }

    // Check if expired
    if (user.subscriptionExpiresAt && user.subscriptionExpiresAt < new Date()) {
      // Auto-update to expired status
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionStatus: "expired" },
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("[SubscriptionService] Error checking subscription:", error);
    return false;
  }
}

/**
 * Get user subscription details
 */
export async function getUserSubscription(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
        subscriptionFeatures: true,
        rateLimitRemaining: true,
        rateLimitResetAt: true,
        polarCustomerId: true,
      },
    });

    if (!user) {
      return null;
    }

    const isActive = await isSubscriptionActive(userId);
    const rateLimitConfig = getRateLimitConfig(user.subscriptionPlan);

    return {
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      features: user.subscriptionFeatures,
      rateLimitRemaining: user.rateLimitRemaining,
      rateLimitTotal: rateLimitConfig.requestsPerPeriod,
      rateLimitResetAt: user.rateLimitResetAt,
      isSubscribed: isActive,
      planDisplayName: getPlanDisplayName(user.subscriptionPlan),
    };
  } catch (error) {
    console.error("[SubscriptionService] Error getting subscription:", error);
    return null;
  }
}

/**
 * Get human-readable plan display name
 */
function getPlanDisplayName(plan: string | null | undefined): string {
  if (!plan) {
    return "Free";
  }

  switch (plan) {
    case "beta-tester":
      return "Beta Tester";
    case "pro":
      return "Pro";
    case "enterprise":
      return "Enterprise";
    default:
      return plan.charAt(0).toUpperCase() + plan.slice(1);
  }
}

/**
 * Revoke subscription access
 */
export async function revokeSubscription(userId: string): Promise<{ success: boolean }> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: "canceled",
        subscriptionFeatures: [],
        rateLimitRemaining: 0,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[SubscriptionService] Error revoking subscription:", error);
    return { success: false };
  }
}
