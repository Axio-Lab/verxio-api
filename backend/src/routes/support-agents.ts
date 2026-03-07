import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { AppError } from "../middleware/errorHandler";
import {
  createSupportAgent,
  listSupportAgents,
  updateSupportAgent,
  deleteSupportAgent,
  getSupportAgent,
} from "../services/supportAgentService";
import {
  getSupportAgentInsights,
  getSupportAgentKBSuggestions,
} from "../services/supportInsightsService";

export const supportAgentsRouter: Router = Router();

supportAgentsRouter.get(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const agents = await listSupportAgents(userId);
      res.json({ agents });
    } catch (error) {
      next(error);
    }
  }
);

supportAgentsRouter.post(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const body = req.body || {};
      if (!body.name || typeof body.name !== "string") {
        throw new AppError("name is required", 400);
      }
      const agent = await createSupportAgent(userId, body);
      res.status(201).json(agent);
    } catch (error) {
      next(error);
    }
  }
);

supportAgentsRouter.put(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      if (!id) throw new AppError("id is required", 400);
      const agent = await updateSupportAgent(userId, id, req.body || {});
      res.json(agent);
    } catch (error) {
      next(error);
    }
  }
);

supportAgentsRouter.delete(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      if (!id) throw new AppError("id is required", 400);
      await deleteSupportAgent(userId, id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// Insights: CRM-style report for an agent (must be before /:id)
supportAgentsRouter.get(
  "/:id/insights/suggestions",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      if (!id) throw new AppError("id is required", 400);
      const result = await getSupportAgentKBSuggestions(id, userId);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

supportAgentsRouter.get(
  "/:id/insights",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      if (!id) throw new AppError("id is required", 400);
      const since = req.query.since as string | undefined;
      const options = since ? { since: new Date(since) } : undefined;
      const result = await getSupportAgentInsights(id, userId, options);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

// Optional: fetch a single agent for future detail pages
supportAgentsRouter.get(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      if (!id) throw new AppError("id is required", 400);
      const agent = await getSupportAgent(id);
      if (!agent || agent.userId !== userId) throw new AppError("Support agent not found", 404);
      res.json(agent);
    } catch (error) {
      next(error);
    }
  }
);
