import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "./errorHandler";

/**
 * Better Auth Authentication Middleware
 *
 * Validates user via X-User-Email header from Better Auth session.
 * This middleware is used for routes that use Better Auth instead of API keys.
 */
export const betterAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userEmail = req.headers["x-user-email"] as string;

    if (!userEmail) {
      throw new AppError("Authentication required. X-User-Email header is missing.", 401);
    }

    // Find the Better Auth user by email
    // Note: Prisma client uses lowercase model names
    const betterAuthUser = await (prisma as any).user.findFirst({
      where: { email: userEmail },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        polarCustomerId: true,
      },
    });

    if (!betterAuthUser) {
      throw new AppError("User not found. Please ensure you are logged in.", 401);
    }

    // Check if email is verified
    if (!betterAuthUser.emailVerified) {
      throw new AppError(
        "Email verification required. Please verify your email address before accessing this resource.",
        403
      );
    }

    // Create Polar customer for existing users who don't have one
    // This handles users who signed up before Polar integration
    if (!betterAuthUser.polarCustomerId && process.env.POLAR_ACCESS_TOKEN) {
      try {
        const { createCustomerForExistingUser } = await import("@/services/polarService");
        const result = await createCustomerForExistingUser({
          userId: betterAuthUser.id,
          email: betterAuthUser.email,
          name: betterAuthUser.name,
        });

        if (result.success && result.customerId) {
          // Update user with Polar customer ID
          await (prisma as any).user.update({
            where: { id: betterAuthUser.id },
            data: { polarCustomerId: result.customerId },
          });
          betterAuthUser.polarCustomerId = result.customerId;
        }
      } catch (error) {
        // Don't block authentication if Polar customer creation fails
        console.error("[BetterAuth] Failed to create Polar customer for existing user:", error);
      }
    }

    // Attach user info to request for use in routes
    (req as any).user = betterAuthUser;
    (req as any).userEmail = userEmail;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError("Authentication failed", 401));
  }
};
