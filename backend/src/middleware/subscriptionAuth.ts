/**
 * Subscription Authentication Middleware
 *
 * Checks if user has active subscription and required feature access.
 * Used to protect premium routes and features.
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";
import { isSubscriptionActive, getUserSubscription } from "@/services/subscriptionService";
import {
  hasFeatureAccess,
  NODE_TYPE_TO_FEATURE,
  type SubscriptionFeature,
} from "@/config/subscription-features";
export { checkRateLimit } from "./subscriptionRateLimit";

/**
 * Middleware to check if user has active subscription
 */
export const requireSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    if (!user || !user.id) {
      throw new AppError("Authentication required", 401);
    }

    const isActive = await isSubscriptionActive(user.id);

    if (!isActive) {
      throw new AppError(
        "Active subscription required. Please upgrade your plan to access this feature.",
        403
      );
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError("Subscription check failed", 500));
  }
};

/**
 * Middleware to check if user has access to a specific feature
 */
export const requireFeature = (requiredFeature: SubscriptionFeature) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user || !user.id) {
        throw new AppError("Authentication required", 401);
      }

      // Check if subscription is active
      const isActive = await isSubscriptionActive(user.id);
      if (!isActive) {
        throw new AppError(
          "Active subscription required. Please upgrade your plan to access this feature.",
          403
        );
      }

      // Get user subscription to check features
      const subscription = await getUserSubscription(user.id);
      if (!subscription || !subscription.isSubscribed) {
        throw new AppError(
          "Active subscription required. Please upgrade your plan to access this feature.",
          403
        );
      }

      // Check feature access
      if (!hasFeatureAccess(subscription.features, requiredFeature)) {
        throw new AppError(
          `This feature requires a subscription. Please upgrade your plan to access ${requiredFeature}.`,
          403
        );
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }
      next(new AppError("Feature access check failed", 500));
    }
  };
};

/**
 * Middleware to check if user has access to a specific node type
 */
export const requireNodeAccess = (nodeType: string) => {
  const requiredFeature = NODE_TYPE_TO_FEATURE[nodeType];

  if (!requiredFeature) {
    // Node doesn't require subscription, allow access
    return async (req: Request, res: Response, next: NextFunction) => {
      next();
    };
  }

  return requireFeature(requiredFeature);
};
