/**
 * GET /api/billing/status – current user subscription
 * POST /api/billing/update – internal, used by webhook handlers
 * POST /api/billing/sync-from-checkout – update DB from checkout_id or customer_session_token (when webhooks don’t run)
 */

import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "@/middleware/betterAuth";
import { AppError } from "@/middleware/errorHandler";
import {
  getUserSubscription,
  updateSubscription,
  calculateBetaTesterExpiration,
} from "@/services/subscriptionService";
import { polarClient } from "@/services/polarService";

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

/**
 * POST /api/billing/sync-from-checkout
 * When user lands with checkout_id or customer_session_token after Polar checkout,
 * update their subscription in DB (fallback when webhooks don’t run).
 */
billingStatusRouter.post(
  "/sync-from-checkout",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        throw new AppError("Authentication required", 401);
      }

      const checkoutId = req.body?.checkout_id as string | undefined;
      const token =
        (req.body?.customer_session_token as string) || (req.body?.customerSessionToken as string);
      const productId = process.env.POLAR_BETA_TESTER_PRODUCT_ID;

      if (!productId) {
        return res.status(200).json({ synced: false, reason: "product not configured" });
      }

      let synced = false;

      if (checkoutId && typeof checkoutId === "string") {
        try {
          const checkout = await polarClient.checkouts.get({ id: checkoutId });
          const status = (checkout as any)?.status;
          const externalCustomerId =
            (checkout as any)?.externalCustomerId ?? (checkout as any)?.external_customer_id;
          const product = (checkout as any)?.product;
          const productIdFromCheckout = product?.id;

          if (
            status === "succeeded" &&
            productIdFromCheckout === productId &&
            externalCustomerId === user.id
          ) {
            const expiresAt = calculateBetaTesterExpiration();
            const result = await updateSubscription({
              userId: user.id,
              status: "active",
              plan: "beta-tester",
              expiresAt,
            });
            if (result.success) {
              synced = true;
            }
          }
        } catch {
          // sync-from-checkout by checkout_id failed
        }
      }

      if (!synced && token && typeof token === "string") {
        try {
          const iter = await polarClient.customerPortal.orders.list(
            { customerSession: token },
            { limit: 20, sorting: ["-created_at"] }
          );
          for await (const pageResult of iter) {
            const items = (pageResult as any)?.result?.items ?? (pageResult as any)?.items ?? [];
            for (const order of Array.isArray(items) ? items : []) {
              const o = order as { paid?: boolean; productId?: string };
              if (o.paid && o.productId === productId) {
                const expiresAt = calculateBetaTesterExpiration();
                const result = await updateSubscription({
                  userId: user.id,
                  status: "active",
                  plan: "beta-tester",
                  expiresAt,
                });
                if (result.success) {
                  synced = true;
                }
                break;
              }
            }
            if (synced) break;
          }
        } catch {
          // sync-from-checkout by customer_session_token failed
        }
      }

      return res.status(200).json({ synced });
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }
      next(new AppError("Failed to sync from checkout", 500));
    }
  }
);

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
