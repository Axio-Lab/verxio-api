import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { prisma } from '../lib/prisma';

/**
 * Better Auth Authentication Middleware
 * 
 * Validates user via X-User-Email header from Better Auth session.
 * This middleware is used for routes that use Better Auth instead of API keys.
 */
export const betterAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userEmail = req.headers['x-user-email'] as string;

    if (!userEmail) {
      throw new AppError('Authentication required. X-User-Email header is missing.', 401);
    }

    // Find the Better Auth user by email
    // Note: Prisma client uses lowercase model names
    const betterAuthUser = await (prisma as any).user.findFirst({
      where: { email: userEmail },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!betterAuthUser) {
      throw new AppError('User not found. Please ensure you are logged in.', 401);
    }

    // Attach user info to request for use in routes
    (req as any).user = betterAuthUser;
    (req as any).userEmail = userEmail;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('Authentication failed', 401));
  }
};

