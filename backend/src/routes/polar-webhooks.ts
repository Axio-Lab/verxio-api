/**
 * POST /api/auth/polar/webhooks
 * Handle Polar webhook events
 *
 * This route is registered by BetterAuth Polar plugin at /api/auth/polar/webhooks
 * This file provides the webhook handler logic
 */

import { Router, Request, Response } from "express";
import {
  updateSubscription,
  calculateBetaTesterExpiration,
  revokeSubscription,
} from "@/services/subscriptionService";
import { prisma } from "@/lib/prisma";

export const polarWebhooksRouter = Router();

// Note: BetterAuth Polar plugin handles webhook signature verification
// This handler receives the verified webhook payload

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

    // Update subscription
    await updateSubscription({
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

    // Update subscription status
    await updateSubscription({
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

    // Revoke subscription
    await revokeSubscription(userId);

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

    // Update subscription status to expired
    await updateSubscription({
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
