import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { importWorkflow } from "../services/migrationService";

export const migrationRouter: Router = Router();

migrationRouter.post(
  "/import",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const exportJson = req.body;

      if (!exportJson || typeof exportJson !== "object") {
        return res.status(400).json({ error: "Invalid JSON export data" });
      }

      const result = await importWorkflow(userId, exportJson);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
