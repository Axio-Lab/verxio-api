/**
 * Manual Payment Routes
 *
 * Allows users to submit manual payment requests (bank transfers, etc.)
 * for admin verification and manual order creation in Polar.
 */

import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "@/middleware/betterAuth";
import { AppError } from "@/middleware/errorHandler";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const manualPaymentRouter = Router();

manualPaymentRouter.use(betterAuthMiddleware);

const createManualPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  paymentMethod: z.string(), // "bank_transfer", "wire", "check", etc.
  paymentProof: z.string().optional(), // URL or reference to proof document
  notes: z.string().optional(),
});

/**
 * POST /api/manual-payment
 * Submit a manual payment request
 */
manualPaymentRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    if (!user || !user.id) {
      throw new AppError("Authentication required", 401);
    }

    const validated = createManualPaymentSchema.parse(req.body);

    // Create manual payment request
    const manualPayment = await prisma.manualPayment.create({
      data: {
        userId: user.id,
        amount: validated.amount,
        currency: validated.currency,
        paymentMethod: validated.paymentMethod,
        paymentProof: validated.paymentProof,
        notes: validated.notes,
        status: "pending",
      },
    });

    res.status(201).json({
      success: true,
      payment: {
        id: manualPayment.id,
        status: manualPayment.status,
        message: "Payment request submitted. An admin will review and verify your payment.",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError("Invalid request data", 400));
    }
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError("Failed to submit payment request", 500));
  }
});

/**
 * GET /api/manual-payment
 * Get user's manual payment requests
 */
manualPaymentRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    if (!user || !user.id) {
      throw new AppError("Authentication required", 401);
    }

    const payments = await prisma.manualPayment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        paymentMethod: true,
        status: true,
        verifiedAt: true,
        createdAt: true,
        notes: true,
      },
    });

    res.status(200).json({ success: true, payments });
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError("Failed to get payment requests", 500));
  }
});
