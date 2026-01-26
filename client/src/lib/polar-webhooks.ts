/**
 * Polar Webhook Handlers
 *
 * Handles Polar webhook events from BetterAuth Polar plugin.
 * These handlers are called by the BetterAuth webhook plugin.
 *
 * Note: These handlers update the database directly using Prisma.
 * The subscription service logic is duplicated here to avoid cross-package imports.
 */

import { prisma } from "./prisma";

// Helper functions (duplicated from backend config to avoid cross-package imports)
function getPlanFeatures(planType: string | null | undefined): string[] {
  if (!planType) {
    return [];
  }

  switch (planType) {
    case "beta-tester":
      // Beta testers get all features
      return [
        "generate-workflow-with-ai",
        "plan-node",
        "code-block-node",
        "remotion",
        "design-agent-pro",
        "veo",
        "elevenlabs",
        "firecrawl",
        "apify",
        "experimental-features",
        "early-access-updates",
      ];
    case "pro":
      return [
        "generate-workflow-with-ai",
        "plan-node",
        "code-block-node",
        "remotion",
        "design-agent-pro",
        "veo",
        "elevenlabs",
        "firecrawl",
        "apify",
      ];
    default:
      return [];
  }
}

function getRateLimitConfig(planType: string | null | undefined) {
  if (!planType) {
    return { requestsPerPeriod: 10, period: "day" as const, resetStrategy: "fixed" as const };
  }

  if (planType === "beta-tester") {
    return { requestsPerPeriod: 100, period: "day" as const, resetStrategy: "fixed" as const };
  }

  if (planType === "pro") {
    return { requestsPerPeriod: 1000, period: "day" as const, resetStrategy: "fixed" as const };
  }

  return { requestsPerPeriod: 10, period: "day" as const, resetStrategy: "fixed" as const };
}

function calculateResetTime(
  config: { period: string; resetStrategy: string },
  lastResetAt: Date | null
): Date {
  const now = new Date();

  if (config.resetStrategy === "fixed") {
    const reset = new Date(now);

    if (config.period === "day") {
      reset.setHours(0, 0, 0, 0);
      reset.setDate(reset.getDate() + 1);
    } else if (config.period === "hour") {
      reset.setMinutes(0, 0, 0);
      reset.setHours(reset.getHours() + 1);
    } else if (config.period === "month") {
      reset.setDate(1);
      reset.setMonth(reset.getMonth() + 1);
    }

    return reset;
  } else {
    if (!lastResetAt) {
      return calculateResetTime({ ...config, resetStrategy: "fixed" }, null);
    }

    const reset = new Date(lastResetAt);

    if (config.period === "day") {
      reset.setDate(reset.getDate() + 1);
    } else if (config.period === "hour") {
      reset.setHours(reset.getHours() + 1);
    } else if (config.period === "month") {
      reset.setMonth(reset.getMonth() + 1);
    }

    return reset;
  }
}

// Helper to calculate beta tester expiration (6 months)
function calculateBetaTesterExpiration(): Date {
  const expiration = new Date();
  expiration.setMonth(expiration.getMonth() + 6);
  return expiration;
}

// Helper to update subscription in database
async function updateSubscriptionInDB(params: {
  userId: string;
  status?: "active" | "expired" | "canceled" | "trial" | null;
  plan?: string | null;
  expiresAt?: Date | null;
  polarCustomerId?: string | null;
  subscriptionFeatures?: string[];
  rateLimitRemaining?: number;
}) {
  const {
    userId,
    status,
    plan,
    expiresAt,
    polarCustomerId,
    subscriptionFeatures,
    rateLimitRemaining,
  } = params;

  // Get features for the plan if not provided
  const planFeatures = subscriptionFeatures || getPlanFeatures(plan);

  // Get rate limit config for the plan
  const rateLimitConfig = getRateLimitConfig(plan);
  const resetTime = calculateResetTime(rateLimitConfig, null);
  const remaining =
    rateLimitRemaining !== undefined ? rateLimitRemaining : rateLimitConfig.requestsPerPeriod;

  // Update user subscription
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(status !== undefined && { subscriptionStatus: status }),
      ...(plan !== undefined && { subscriptionPlan: plan }),
      ...(expiresAt !== undefined && { subscriptionExpiresAt: expiresAt }),
      ...(polarCustomerId !== undefined && { polarCustomerId }),
      subscriptionFeatures: planFeatures,
      rateLimitRemaining: remaining,
      rateLimitResetAt: resetTime,
    },
  });
}

/**
 * Handle order paid event - grant subscription access
 */
export async function handleOrderPaid(payload: any) {
  try {
    const { customer, order, product } = payload;

    if (!customer || !customer.externalId) {
      console.error("[PolarWebhook] Order paid: No customer externalId");
      return;
    }

    const userId = customer.externalId;
    const productId = product?.id;

    // Determine plan type from product
    let planType = "beta-tester"; // Default
    if (productId === process.env.POLAR_BETA_TESTER_PRODUCT_ID) {
      planType = "beta-tester";
    }
    // Add more product mappings as needed

    // Calculate expiration (6 months for beta-tester)
    const expiresAt = calculateBetaTesterExpiration();

    // Update subscription in database
    await updateSubscriptionInDB({
      userId,
      status: "active",
      plan: planType,
      expiresAt,
      polarCustomerId: customer.id,
    });

    console.log(`[PolarWebhook] Order paid: Granted ${planType} subscription to user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling order paid:", error);
  }
}

/**
 * Handle subscription active event
 */
export async function handleSubscriptionActive(payload: any) {
  try {
    const { customer, subscription } = payload;

    if (!customer || !customer.externalId) {
      console.error("[PolarWebhook] Subscription active: No customer externalId");
      return;
    }

    const userId = customer.externalId;

    // Update subscription status in database
    await updateSubscriptionInDB({
      userId,
      status: "active",
      polarCustomerId: customer.id,
    });

    console.log(`[PolarWebhook] Subscription active: Activated subscription for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling subscription active:", error);
  }
}

/**
 * Handle subscription canceled event
 */
export async function handleSubscriptionCanceled(payload: any) {
  try {
    const { customer } = payload;

    if (!customer || !customer.externalId) {
      console.error("[PolarWebhook] Subscription canceled: No customer externalId");
      return;
    }

    const userId = customer.externalId;

    // Revoke subscription in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: "canceled",
        subscriptionFeatures: [],
        rateLimitRemaining: 0,
      },
    });

    console.log(`[PolarWebhook] Subscription canceled: Revoked subscription for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling subscription canceled:", error);
  }
}

/**
 * Handle subscription expired event
 */
export async function handleSubscriptionExpired(payload: any) {
  try {
    const { customer } = payload;

    if (!customer || !customer.externalId) {
      console.error("[PolarWebhook] Subscription expired: No customer externalId");
      return;
    }

    const userId = customer.externalId;

    // Update subscription status to expired in database
    await updateSubscriptionInDB({
      userId,
      status: "expired",
    });

    console.log(
      `[PolarWebhook] Subscription expired: Marked subscription as expired for user ${userId}`
    );
  } catch (error) {
    console.error("[PolarWebhook] Error handling subscription expired:", error);
  }
}

/**
 * Handle customer state changed event
 */
export async function handleCustomerStateChanged(payload: any) {
  try {
    const { customer } = payload;

    if (!customer || !customer.externalId) {
      console.error("[PolarWebhook] Customer state changed: No customer externalId");
      return;
    }

    const userId = customer.externalId;

    // Sync customer state with database
    // This is a catch-all for any customer-related changes
    await prisma.user.update({
      where: { id: userId },
      data: {
        polarCustomerId: customer.id,
      },
    });

    console.log(`[PolarWebhook] Customer state changed: Synced customer state for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling customer state changed:", error);
  }
}
