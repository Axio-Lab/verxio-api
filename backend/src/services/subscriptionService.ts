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
import { Prisma } from "../../node_modules/.prisma/client";
import { getPlanFeatures, type SubscriptionFeature } from "@/config/subscription-features";
import {
  getRateLimitConfig,
  calculateResetTime,
  BETA_TESTER_DAILY_CREDITS,
} from "@/config/rate-limits";

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

    // For beta-testers, use daily credits; for others use config
    const initialQuota =
      plan === "beta-tester" ? BETA_TESTER_DAILY_CREDITS : rateLimitConfig.requestsPerPeriod;

    // Update user subscription
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(status !== undefined && { subscriptionStatus: status }),
        ...(plan !== undefined && { subscriptionPlan: plan }),
        ...(expiresAt !== undefined && { subscriptionExpiresAt: expiresAt }),
        ...(polarCustomerId !== undefined && { polarCustomerId }),
        subscriptionFeatures: planFeatures,
        rateLimitRemaining: initialQuota,
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

    // Merge plan features with stored features to avoid missing new flags
    // (e.g., if subscriptionFeatures was set before a new feature existed)
    const planFeatures = getPlanFeatures(user.subscriptionPlan);
    const features = Array.from(
      new Set([...(planFeatures || []), ...(user.subscriptionFeatures || [])])
    );

    // For beta-testers, use the daily credits constant; for others use config
    const rateLimitTotal =
      user.subscriptionPlan === "beta-tester"
        ? BETA_TESTER_DAILY_CREDITS
        : rateLimitConfig.requestsPerPeriod;

    let rateLimitRemaining = user.rateLimitRemaining ?? 0;
    let rateLimitResetAt = user.rateLimitResetAt;

    // Beta-testers: if reset time is null or in the past, reset quota to full and persist
    if (
      user.subscriptionPlan === "beta-tester" &&
      isActive &&
      (!rateLimitResetAt || new Date(rateLimitResetAt) <= new Date())
    ) {
      const nextReset = calculateResetTime(
        getRateLimitConfig("beta-tester"),
        rateLimitResetAt ? new Date(rateLimitResetAt) : null
      );
      rateLimitRemaining = BETA_TESTER_DAILY_CREDITS;
      rateLimitResetAt = nextReset;
      await prisma.user.update({
        where: { id: userId },
        data: {
          rateLimitRemaining: BETA_TESTER_DAILY_CREDITS,
          rateLimitResetAt: nextReset,
        },
      });
    }

    return {
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      features: features,
      rateLimitRemaining,
      rateLimitTotal,
      rateLimitResetAt,
      isSubscribed: isActive,
      planDisplayName: getPlanDisplayName(user.subscriptionPlan) ?? "Free",
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
    case "free":
      return "Free";
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
 * Consume premium quota credits for beta-testers only
 * Throws error if quota exceeded or not enough credits
 */
export async function consumePremiumQuota(userId: string, cost: number): Promise<void> {
  try {
    // Get user subscription
    const subscription = await getUserSubscription(userId);

    if (!subscription || !subscription.isSubscribed) {
      // No subscription, no quota enforcement (will be blocked by feature check)
      return;
    }

    // Only enforce quota for beta-testers
    if (subscription.subscriptionPlan !== "beta-tester") {
      // Pro and other plans are not rate limited
      return;
    }

    // Get current user data to check reset time
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        rateLimitRemaining: true,
        rateLimitResetAt: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const now = new Date();

    // Use a transaction to ensure atomicity: check reset, check credits, and decrement all in one
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Re-read the current value within transaction to ensure consistency
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        select: {
          rateLimitRemaining: true,
          rateLimitResetAt: true,
        },
      });

      if (!currentUser) {
        throw new Error("User not found");
      }

      let currentRemaining = currentUser.rateLimitRemaining ?? 0;
      let currentResetAt = currentUser.rateLimitResetAt;

      // Check if we need to reset the quota (past reset time)
      if (!currentResetAt || new Date(currentResetAt) < now) {
        // Reset the quota to full daily credits
        currentResetAt = calculateResetTime(
          getRateLimitConfig("beta-tester"),
          currentResetAt ? new Date(currentResetAt) : null
        );
        currentRemaining = BETA_TESTER_DAILY_CREDITS;
      }

      // Check if user has enough credits
      if (currentRemaining < cost) {
        const resetTime = currentResetAt ? new Date(currentResetAt).toLocaleString() : "soon";
        throw new Error(
          `Rate limit exceeded. Not enough credits (need ${cost}, have ${currentRemaining}). Limit resets at ${resetTime}.`
        );
      }

      // Update: reset time (if needed) and decrement credits atomically
      const newRemaining = currentRemaining - cost;
      if (currentResetAt !== currentUser.rateLimitResetAt) {
        // If we reset, set the new values explicitly
        await tx.user.update({
          where: { id: userId },
          data: {
            rateLimitRemaining: newRemaining,
            rateLimitResetAt: currentResetAt,
          },
        });
      } else {
        // Otherwise, just decrement
        await tx.user.update({
          where: { id: userId },
          data: {
            rateLimitRemaining: {
              decrement: cost,
            },
          },
        });
      }
    });

    // Log credit spend for debugging / observability
    const updated = await prisma.user.findUnique({
      where: { id: userId },
      select: { rateLimitRemaining: true },
    });
    console.log(
      `[Credits] userId=${userId} spent ${cost} credits (remaining: ${updated?.rateLimitRemaining ?? "?"})`
    );
  } catch (error) {
    // Re-throw if it's already an Error with message
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to consume premium quota");
  }
}

/**
 * Reset rate limit for a user (e.g. for testing). Sets remaining to full daily credits and next reset to midnight.
 */
export async function resetRateLimitForUser(userId: string): Promise<{
  success: boolean;
  rateLimitRemaining: number;
  rateLimitResetAt: Date | null;
}> {
  const resetTime = calculateResetTime(getRateLimitConfig("beta-tester"), null);
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      rateLimitRemaining: BETA_TESTER_DAILY_CREDITS,
      rateLimitResetAt: resetTime,
    },
    select: { rateLimitRemaining: true, rateLimitResetAt: true },
  });
  console.log(
    `[Credits] userId=${userId} rate limit reset to ${user.rateLimitRemaining} credits (resets at ${user.rateLimitResetAt?.toISOString() ?? "n/a"})`
  );
  return {
    success: true,
    rateLimitRemaining: user.rateLimitRemaining,
    rateLimitResetAt: user.rateLimitResetAt,
  };
}

/**
 * Revoke subscription access (e.g. order refunded, subscription canceled/revoked).
 * Sets plan to "free", status to "canceled", and clears features/quota so the user row and UI show "Free".
 */
export async function revokeSubscription(userId: string): Promise<{ success: boolean }> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: "canceled",
        subscriptionPlan: "free",
        subscriptionExpiresAt: null,
        subscriptionFeatures: [],
        rateLimitRemaining: 0,
        rateLimitResetAt: null,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[SubscriptionService] Error revoking subscription:", error);
    return { success: false };
  }
}
