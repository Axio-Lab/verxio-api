import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import * as analyticsService from "../services/analyticsService";

export const analyticsRouter: Router = Router();

analyticsRouter.get(
  "/dashboard",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const hourlyRate = parseFloat(req.query.hourlyRate as string) || 50;
      const dashboard = await analyticsService.getAnalyticsDashboard(userId, hourlyRate);
      res.json(dashboard);
    } catch (error) {
      next(error);
    }
  }
);

analyticsRouter.get(
  "/insight",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const insight = await analyticsService.generateAIInsight(userId);
      res.json({ insight });
    } catch (error) {
      next(error);
    }
  }
);
