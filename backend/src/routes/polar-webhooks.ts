/**
 * Polar webhook event handlers
 *
 * Polar sends: { type: "event.name", timestamp: "ISO", data: { ... } }
 * Use payload.data when present; customer id is data.customer.external_id (snake_case).
 *
 * Webhook URL to set in Polar Dashboard:
 *   Production: https://<YOUR_BACKEND_HOST>/api/auth/polar/webhooks
 *   Example:    https://api.verxio.xyz/api/auth/polar/webhooks
 */

import {
  updateSubscription,
  calculateBetaTesterExpiration,
  revokeSubscription,
} from "@/services/subscriptionService";
import { prisma } from "@/lib/prisma";
import { getPlanFromProductId } from "@/config/subscription-features";

/** Normalize payload: Polar sends { type, timestamp, data }; use data for event body */
function getData(payload: any): any {
  return payload?.data ?? payload;
}

/** Get user id from event data (customer.external_id or data.external_id for customer.* events) */
function getUserId(data: any): string | null {
  const customer = data?.customer ?? data;
  if (!customer) return null;
  const id = customer.external_id ?? customer.externalId;
  return id ?? null;
}

/**
 * Map Polar product_id to plan and optional expiresAt (for one-time purchases)
 */
function getPlanAndExpiry(data: any): { plan: string; expiresAt?: Date } {
  const productId = data?.product?.id ?? data?.product_id;
  const plan = getPlanFromProductId(productId);
  const isRecurring = data?.product?.is_recurring === true;
  const expiresAt =
    plan === "beta-tester" && !isRecurring ? calculateBetaTesterExpiration() : undefined;
  return { plan, expiresAt };
}

/**
 * Handle order.paid – grant subscription from one-time or first subscription payment
 */
export async function handleOrderPaid(payload: any) {
  try {
    const data = getData(payload);
    const userId = getUserId(data);
    if (!userId) {
      console.error("[PolarWebhook] Order paid: No customer external_id");
      return;
    }
    const customer = data.customer;
    const { plan, expiresAt } = getPlanAndExpiry(data);

    await updateSubscription({
      userId,
      status: "active",
      plan,
      expiresAt,
      polarCustomerId: customer.id,
    });

    console.log(`[PolarWebhook] Order paid: Granted ${plan} to user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling order paid:", error);
  }
}

/**
 * Handle order.refunded – revoke access when order is refunded
 */
export async function handleOrderRefunded(payload: any) {
  try {
    const data = getData(payload);
    const userId = getUserId(data);
    if (!userId) return;
    await revokeSubscription(userId);
    console.log(`[PolarWebhook] Order refunded: Revoked subscription for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling order refunded:", error);
  }
}

/**
 * Handle subscription.created – set subscription as active with plan from product
 */
export async function handleSubscriptionCreated(payload: any) {
  try {
    const data = getData(payload);
    const userId = getUserId(data);
    if (!userId) return;
    const customer = data.customer;
    const { plan, expiresAt } = getPlanAndExpiry(data);

    await updateSubscription({
      userId,
      status: "active",
      plan,
      expiresAt,
      polarCustomerId: customer.id,
    });
    console.log(`[PolarWebhook] Subscription created: Activated ${plan} for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling subscription created:", error);
  }
}

/**
 * Handle subscription.active – ensure subscription is active
 */
export async function handleSubscriptionActive(payload: any) {
  try {
    const data = getData(payload);
    const userId = getUserId(data);
    if (!userId) return;
    const customer = data.customer;
    const { plan } = getPlanAndExpiry(data);

    await updateSubscription({
      userId,
      status: "active",
      plan,
      polarCustomerId: customer.id,
    });
    console.log(`[PolarWebhook] Subscription active: Activated subscription for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling subscription active:", error);
  }
}

/**
 * Handle subscription.updated – sync status and plan (active, canceled, past_due, etc.)
 */
export async function handleSubscriptionUpdated(payload: any) {
  try {
    const data = getData(payload);
    const userId = getUserId(data);
    if (!userId) return;
    const sub = data;
    const status = sub?.status ?? data?.subscription?.status;
    const customer = data.customer;

    if (status === "active") {
      const { plan, expiresAt } = getPlanAndExpiry(data);
      await updateSubscription({
        userId,
        status: "active",
        plan,
        expiresAt,
        polarCustomerId: customer?.id,
      });
      console.log(`[PolarWebhook] Subscription updated: Synced active ${plan} for user ${userId}`);
    } else if (status === "canceled" || status === "cancelled") {
      await revokeSubscription(userId);
      console.log(`[PolarWebhook] Subscription updated: Revoked (canceled) for user ${userId}`);
    } else if (status === "past_due" || status === "incomplete") {
      await updateSubscription({ userId, status: "expired" });
      console.log(
        `[PolarWebhook] Subscription updated: Marked expired (${status}) for user ${userId}`
      );
    } else if (customer?.id) {
      await prisma.user.update({
        where: { id: userId },
        data: { polarCustomerId: customer.id },
      });
    }
  } catch (error) {
    console.error("[PolarWebhook] Error handling subscription updated:", error);
  }
}

/**
 * Handle subscription.canceled – revoke access
 */
export async function handleSubscriptionCanceled(payload: any) {
  try {
    const data = getData(payload);
    const userId = getUserId(data);
    if (!userId) return;
    await revokeSubscription(userId);
    console.log(`[PolarWebhook] Subscription canceled: Revoked subscription for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling subscription canceled:", error);
  }
}

/**
 * Handle subscription.uncanceled – reactivate subscription
 */
export async function handleSubscriptionUncanceled(payload: any) {
  try {
    const data = getData(payload);
    const userId = getUserId(data);
    if (!userId) return;
    const customer = data.customer;
    const { plan, expiresAt } = getPlanAndExpiry(data);

    await updateSubscription({
      userId,
      status: "active",
      plan,
      expiresAt,
      polarCustomerId: customer?.id,
    });
    console.log(`[PolarWebhook] Subscription uncanceled: Reactivated for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling subscription uncanceled:", error);
  }
}

/**
 * Handle subscription.revoked – revoke access
 */
export async function handleSubscriptionRevoked(payload: any) {
  try {
    const data = getData(payload);
    const userId = getUserId(data);
    if (!userId) return;
    await revokeSubscription(userId);
    console.log(`[PolarWebhook] Subscription revoked: Revoked subscription for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling subscription revoked:", error);
  }
}

/**
 * Handle subscription.past_due – mark as expired / restrict access
 */
export async function handleSubscriptionPastDue(payload: any) {
  try {
    const data = getData(payload);
    const userId = getUserId(data);
    if (!userId) return;
    await updateSubscription({ userId, status: "expired" });
    console.log(`[PolarWebhook] Subscription past_due: Marked expired for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling subscription past_due:", error);
  }
}

/**
 * Handle subscription expired (if Polar sends it; otherwise subscription.updated with ended_at)
 */
export async function handleSubscriptionExpired(payload: any) {
  try {
    const data = getData(payload);
    const userId = getUserId(data);
    if (!userId) return;
    await updateSubscription({ userId, status: "expired" });
    console.log(`[PolarWebhook] Subscription expired: Marked expired for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling subscription expired:", error);
  }
}

/**
 * Handle customer.created / customer.updated – sync polarCustomerId
 */
export async function handleCustomerCreated(payload: any) {
  try {
    const data = getData(payload);
    const userId = getUserId(data);
    if (!userId) return;
    const customer = data.customer ?? data;
    await prisma.user.update({
      where: { id: userId },
      data: { polarCustomerId: customer.id },
    });
    console.log(`[PolarWebhook] Customer created: Synced polarCustomerId for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling customer created:", error);
  }
}

/**
 * Handle customer.updated – sync polarCustomerId
 */
export async function handleCustomerUpdated(payload: any) {
  try {
    const data = getData(payload);
    const userId = getUserId(data);
    if (!userId) return;
    const customer = data.customer ?? data;
    await prisma.user.update({
      where: { id: userId },
      data: { polarCustomerId: customer.id },
    });
    console.log(`[PolarWebhook] Customer updated: Synced polarCustomerId for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling customer updated:", error);
  }
}

/**
 * Handle customer.deleted – clear polarCustomerId (optional: do not revoke plan, only unlink)
 */
export async function handleCustomerDeleted(payload: any) {
  try {
    const data = getData(payload);
    const userId = getUserId(data);
    if (!userId) return;
    await prisma.user.update({
      where: { id: userId },
      data: { polarCustomerId: null },
    });
    console.log(`[PolarWebhook] Customer deleted: Cleared polarCustomerId for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling customer deleted:", error);
  }
}

/**
 * Handle customer.state_changed – sync polarCustomerId (and optionally re-fetch subscription state)
 */
export async function handleCustomerStateChanged(payload: any) {
  try {
    const data = getData(payload);
    const userId = getUserId(data);
    if (!userId) return;
    const customer = data.customer ?? data;
    await prisma.user.update({
      where: { id: userId },
      data: { polarCustomerId: customer.id },
    });
    console.log(`[PolarWebhook] Customer state_changed: Synced for user ${userId}`);
  } catch (error) {
    console.error("[PolarWebhook] Error handling customer state changed:", error);
  }
}
