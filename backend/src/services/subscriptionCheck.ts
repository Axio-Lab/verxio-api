/**
 * Subscription Check Helper
 *
 * Utility functions for checking subscription access in node executors
 * (which run in Inngest, not Express middleware)
 */

import { isSubscriptionActive, getUserSubscription } from "./subscriptionService";
import {
  hasFeatureAccess,
  NODE_TYPE_TO_FEATURE,
  type SubscriptionFeature,
} from "@/config/subscription-features";

/**
 * Check if user has access to a specific feature.
 * Throws on denied access. If the DB is transiently unreachable,
 * this fails open so running agent workflows aren't interrupted.
 */
export async function checkFeatureAccess(
  userId: string,
  requiredFeature: SubscriptionFeature
): Promise<void> {
  let isActive: boolean;
  try {
    isActive = await isSubscriptionActive(userId);
  } catch {
    console.warn(`[SubscriptionCheck] DB error checking subscription for ${userId} — failing open`);
    return;
  }

  if (!isActive) {
    throw new Error(
      "Active subscription required. Please upgrade your plan to access this feature."
    );
  }

  let subscription: Awaited<ReturnType<typeof getUserSubscription>>;
  try {
    subscription = await getUserSubscription(userId);
  } catch {
    console.warn(`[SubscriptionCheck] DB error fetching subscription for ${userId} — failing open`);
    return;
  }

  if (!subscription || !subscription.isSubscribed) {
    throw new Error(
      "Active subscription required. Please upgrade your plan to access this feature."
    );
  }

  if (!hasFeatureAccess(subscription.features, requiredFeature)) {
    throw new Error(
      `This feature requires a subscription. Please upgrade your plan to access ${requiredFeature}.`
    );
  }
}

/**
 * Check if user has access to a specific node type
 */
export async function checkNodeAccess(userId: string, nodeType: string): Promise<void> {
  const requiredFeature = NODE_TYPE_TO_FEATURE[nodeType];

  if (!requiredFeature) {
    // Node doesn't require subscription, allow access
    return;
  }

  return checkFeatureAccess(userId, requiredFeature);
}

/**
 * Check rate limit for user
 * Returns true if within limit, throws error if exceeded
 */
export async function checkRateLimit(userId: string): Promise<void> {
  const subscription = await getUserSubscription(userId);

  if (!subscription || !subscription.isSubscribed) {
    // No subscription, no rate limiting (will be blocked by subscription check)
    return;
  }

  if (subscription.rateLimitRemaining <= 0) {
    const resetTime = subscription.rateLimitResetAt
      ? new Date(subscription.rateLimitResetAt).toLocaleString()
      : "soon";
    throw new Error(
      `Rate limit exceeded. You have used all ${subscription.rateLimitTotal} requests. Limit resets ${resetTime}.`
    );
  }

  // Decrement remaining (this should be done in middleware, but for executors we'll track it)
  // Note: In production, you might want to update the database here
}
