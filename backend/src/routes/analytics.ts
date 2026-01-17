/**
 * Analytics Routes
 *
 * API endpoints for the user-facing Analytics dashboard.
 * Provides metrics, cost tracking, and optimization controls.
 */

import { Router, Request, Response } from "express";
import * as analyticsService from "../services/analyticsService";

const router = Router();

// ============================================
// Overview & Metrics
// ============================================

/**
 * GET /analytics/overview
 * Get user's agent usage overview
 */
router.get("/overview", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const overview = await analyticsService.getUserOverview(userId);
    res.json(overview);
  } catch (error: any) {
    console.error("[Analytics] Error getting overview:", error);
    res.status(500).json({ error: "Failed to fetch analytics overview" });
  }
});

/**
 * GET /analytics/costs
 * Get cost breakdown by period
 */
router.get("/costs", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const period = (req.query.period as string) || "daily";
    const costs = await analyticsService.getCostBreakdown(userId, period);
    res.json(costs);
  } catch (error: any) {
    console.error("[Analytics] Error getting costs:", error);
    res.status(500).json({ error: "Failed to fetch cost breakdown" });
  }
});

/**
 * GET /analytics/quality
 * Get quality metrics over time
 */
router.get("/quality", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const metrics = await analyticsService.getQualityMetrics(userId);
    res.json(metrics);
  } catch (error: any) {
    console.error("[Analytics] Error getting quality metrics:", error);
    res.status(500).json({ error: "Failed to fetch quality metrics" });
  }
});

// ============================================
// Optimization
// ============================================

/**
 * GET /analytics/optimizations
 * Get prompt optimization suggestions
 */
router.get("/optimizations", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const suggestions = await analyticsService.getOptimizationSuggestions(userId);
    res.json(suggestions);
  } catch (error: any) {
    console.error("[Analytics] Error getting optimizations:", error);
    res.status(500).json({ error: "Failed to fetch optimization suggestions" });
  }
});

/**
 * POST /analytics/optimize
 * Trigger a new optimization run
 */
router.post("/optimize", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { promptType } = req.body;
    if (!promptType) {
      return res.status(400).json({ error: "promptType is required" });
    }

    const result = await analyticsService.triggerOptimization(userId, promptType);
    res.json(result);
  } catch (error: any) {
    console.error("[Analytics] Error running optimization:", error);
    res.status(500).json({ error: "Failed to run optimization" });
  }
});

// ============================================
// Activity
// ============================================

/**
 * GET /analytics/activity
 * Get recent agent activity
 */
router.get("/activity", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const activity = await analyticsService.getRecentActivity(userId, limit);
    res.json(activity);
  } catch (error: any) {
    console.error("[Analytics] Error getting activity:", error);
    res.status(500).json({ error: "Failed to fetch recent activity" });
  }
});

export default router;
