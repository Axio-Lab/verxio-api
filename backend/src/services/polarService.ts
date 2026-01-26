/**
 * Polar Service
 *
 * Handles integration with Polar.sh payment platform.
 * Provides functions for managing customers, orders, and subscriptions.
 */

import { Polar } from "@polar-sh/sdk";

// Initialize Polar client
const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN || "",
  server: (process.env.POLAR_SERVER as "sandbox" | "production") || "sandbox",
});

/**
 * Create a manual order in Polar for bank transfer payments
 *
 * Note: Polar may not have a direct API for creating orders.
 * For manual payments, you may need to:
 * 1. Create the order manually in Polar dashboard
 * 2. Or use Polar's API if available (check latest SDK docs)
 * 3. Or directly update the database and sync with Polar later
 *
 * This function is a placeholder - implement based on actual Polar API capabilities.
 */
export async function createManualOrder(params: {
  customerId: string;
  productId: string;
  amount: number;
  currency?: string;
  metadata?: Record<string, string>;
}): Promise<{ orderId: string; success: boolean; error?: string }> {
  try {
    // TODO: Implement based on actual Polar API
    // For now, return a placeholder order ID
    // In production, you may need to create the order via Polar dashboard
    // or use a different approach

    console.warn(
      "[PolarService] createManualOrder not fully implemented - manual order creation may need to be done via Polar dashboard"
    );

    return {
      orderId: `manual-${Date.now()}`, // Placeholder
      success: true,
    };
  } catch (error) {
    console.error("[PolarService] Error creating manual order:", error);
    return {
      orderId: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Mark an order as paid in Polar
 *
 * Note: This may not be available in Polar API.
 * For manual payments, consider directly updating the database
 * and letting the webhook system handle it, or create the order
 * in Polar dashboard and mark it as paid there.
 */
export async function markOrderAsPaid(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // TODO: Implement based on actual Polar API
    // For now, this is a placeholder
    // In production, you may need to mark the order as paid in Polar dashboard

    console.warn(
      "[PolarService] markOrderAsPaid not fully implemented - order marking may need to be done via Polar dashboard"
    );

    return { success: true };
  } catch (error) {
    console.error("[PolarService] Error marking order as paid:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a Polar customer for an existing user
 * Used to migrate existing users who signed up before Polar integration
 * Prevents duplication by catching errors if customer already exists
 */
export async function createCustomerForExistingUser(params: {
  userId: string;
  email: string;
  name?: string | null;
}): Promise<{ customerId: string | null; success: boolean; error?: string }> {
  try {
    // Create new customer with externalId matching user ID
    // If customer already exists, Polar will return an error which we'll catch
    const customer = await polarClient.customers.create({
      externalId: params.userId,
      email: params.email,
      ...(params.name && { name: params.name }),
    });

    return {
      customerId: customer.id,
      success: true,
    };
  } catch (error: any) {
    // If customer already exists (duplicate externalId or email),
    // the error will indicate this - we'll log it but not fail
    // The BetterAuth plugin should handle existing customers via webhooks
    if (
      error?.status === 409 ||
      error?.message?.includes("already exists") ||
      error?.message?.includes("duplicate") ||
      error?.message?.includes("unique constraint")
    ) {
      console.log(
        `[PolarService] Customer already exists for user ${params.userId} - this is expected for existing users`
      );
      // Return success but no customerId - the webhook will sync it later
      return {
        customerId: null,
        success: true,
      };
    }

    console.error("[PolarService] Error creating customer for existing user:", error);
    return {
      customerId: null,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export { polarClient };
