/**
 * Admin Manual Payment Routes
 *
 * Allows admins to verify manual payments and create Polar orders.
 */

import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "@/middleware/betterAuth";
import { AppError } from "@/middleware/errorHandler";
import { prisma } from "@/lib/prisma";
import { createManualOrder, markOrderAsPaid } from "@/services/polarService";
import { updateSubscription, calculateBetaTesterExpiration } from "@/services/subscriptionService";
import { z } from "zod";

export const adminManualPaymentsRouter = Router();

adminManualPaymentsRouter.use(betterAuthMiddleware);

// TODO: Add admin authorization middleware
// For now, this is a placeholder - you should add proper admin role checking

const verifyPaymentSchema = z.object({
  paymentId: z.string(),
  action: z.enum(["verify", "reject"]),
  polarOrderId: z.string().optional(), // If creating order via Polar API
  notes: z.string().optional(),
});

/**
 * GET /api/admin/manual-payments
 * List all pending manual payment requests
 */
adminManualPaymentsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    // TODO: Check if user is admin
    // if (!isAdmin(user)) {
    //   throw new AppError("Admin access required", 403);
    // }

    const status = (req.query.status as string) || "pending";

    const payments = await prisma.manualPayment.findMany({
      where: { status },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ success: true, payments });
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError("Failed to get payment requests", 500));
  }
});

/**
 * POST /api/admin/manual-payments/verify
 * Verify a manual payment and grant access
 */
adminManualPaymentsRouter.post(
  "/verify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      // TODO: Check if user is admin
      // if (!isAdmin(user)) {
      //   throw new AppError("Admin access required", 403);
      // }

      const validated = verifyPaymentSchema.parse(req.body);
      const { paymentId, action, polarOrderId, notes } = validated;

      const payment = await prisma.manualPayment.findUnique({
        where: { id: paymentId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              polarCustomerId: true,
            },
          },
        },
      });

      if (!payment) {
        throw new AppError("Payment request not found", 404);
      }

      if (action === "reject") {
        // Reject payment
        await prisma.manualPayment.update({
          where: { id: paymentId },
          data: {
            status: "rejected",
            verifiedBy: user.id,
            verifiedAt: new Date(),
            notes,
          },
        });

        return res.status(200).json({
          success: true,
          message: "Payment request rejected",
        });
      }

      // Verify payment
      let orderId = polarOrderId;

      // For manual payments, we can either:
      // 1. Create order in Polar dashboard and provide orderId
      // 2. Directly grant access and sync with Polar later
      // 3. Use Polar API if available (see polarService.ts for implementation)

      // If no Polar order ID provided, try to create one (may not be fully implemented)
      if (!orderId && payment.user.polarCustomerId) {
        const productId = process.env.POLAR_BETA_TESTER_PRODUCT_ID;
        if (productId) {
          const orderResult = await createManualOrder({
            customerId: payment.user.polarCustomerId,
            productId,
            amount: payment.amount,
            currency: payment.currency,
            metadata: {
              manualPaymentId: payment.id,
              userId: payment.userId,
            },
          });

          if (orderResult.success && orderResult.orderId) {
            orderId = orderResult.orderId;

            // Try to mark order as paid (may not be fully implemented)
            const markPaidResult = await markOrderAsPaid(orderId);
            if (!markPaidResult.success) {
              console.warn(
                "[Admin] Failed to mark order as paid in Polar - access will be granted directly"
              );
            }
          } else {
            console.warn("[Admin] Could not create Polar order - granting access directly");
          }
        } else {
          console.warn(
            "[Admin] POLAR_BETA_TESTER_PRODUCT_ID not configured - granting access directly"
          );
        }
      }

      // Update payment status
      await prisma.manualPayment.update({
        where: { id: paymentId },
        data: {
          status: "completed",
          polarOrderId: orderId,
          verifiedBy: user.id,
          verifiedAt: new Date(),
          notes,
        },
      });

      // Grant subscription access
      const expiresAt = calculateBetaTesterExpiration();
      await updateSubscription({
        userId: payment.userId,
        status: "active",
        plan: "beta-tester",
        expiresAt,
        polarCustomerId: payment.user.polarCustomerId || undefined,
      });

      res.status(200).json({
        success: true,
        message: "Payment verified and subscription granted",
        orderId,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError("Invalid request data", 400));
      }
      if (error instanceof AppError) {
        return next(error);
      }
      next(new AppError("Failed to verify payment", 500));
    }
  }
);
