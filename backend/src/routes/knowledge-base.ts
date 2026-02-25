import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import * as kbService from "../services/knowledgeBaseService";

export const knowledgeBaseRouter: Router = Router();

knowledgeBaseRouter.post(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const kb = await kbService.createKnowledgeBase(userId, name, description);
      res.status(201).json(kb);
    } catch (error) {
      next(error);
    }
  }
);

knowledgeBaseRouter.get(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const knowledgeBases = await kbService.listKnowledgeBases(userId);
      res.json({ knowledgeBases });
    } catch (error) {
      next(error);
    }
  }
);

knowledgeBaseRouter.get(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const kb = await kbService.getKnowledgeBase(req.params.id, userId);
      res.json(kb);
    } catch (error) {
      next(error);
    }
  }
);

knowledgeBaseRouter.delete(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      await kbService.deleteKnowledgeBase(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

knowledgeBaseRouter.post(
  "/:id/documents",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { title, sourceType, sourceUrl, content } = req.body;
      if (!title || !content)
        return res.status(400).json({ error: "title and content are required" });
      const doc = await kbService.addDocument(req.params.id, userId, {
        title,
        sourceType: sourceType || "text",
        sourceUrl,
        content,
      });
      res.status(201).json(doc);
    } catch (error) {
      next(error);
    }
  }
);

knowledgeBaseRouter.delete(
  "/documents/:docId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      await kbService.deleteDocument(req.params.docId, userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

knowledgeBaseRouter.post(
  "/:id/search",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query, topK } = req.body;
      if (!query) return res.status(400).json({ error: "query is required" });
      const results = await kbService.searchKnowledge(req.params.id, query, topK || 5);
      res.json({ results });
    } catch (error) {
      next(error);
    }
  }
);
