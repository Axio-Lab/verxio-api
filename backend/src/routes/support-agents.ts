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
