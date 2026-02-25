import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import * as widgetService from "../services/widgetService";

export const widgetRouter: Router = Router();

widgetRouter.post(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const agent = await widgetService.createWidgetAgent(userId, req.body);
      res.status(201).json(agent);
    } catch (error) {
      next(error);
    }
  }
);

widgetRouter.get(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const agents = await widgetService.listWidgetAgents(userId);
      res.json({ agents });
    } catch (error) {
      next(error);
    }
  }
);

widgetRouter.put(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const agent = await widgetService.updateWidgetAgent(userId, req.params.id, req.body);
      res.json(agent);
    } catch (error) {
      next(error);
    }
  }
);

widgetRouter.delete(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      await widgetService.deleteWidgetAgent(userId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// Public endpoints (no auth, CORS checked)
widgetRouter.get("/:id/config", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await widgetService.getWidgetConfig(req.params.id);
    if (!config) return res.status(404).json({ error: "Widget not found" });
    res.json(config);
  } catch (error) {
    next(error);
  }
});

widgetRouter.post("/:id/message", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || !sessionId)
      return res.status(400).json({ error: "message and sessionId required" });

    const agent = await widgetService.getWidgetAgent(req.params.id);
    if (!agent || agent.status !== "active")
      return res.status(404).json({ error: "Widget not found" });

    // CORS domain check
    const origin = req.headers.origin || req.headers.referer || "";
    if (agent.allowedDomains.length > 0) {
      const allowed = agent.allowedDomains.some((d: string) => origin.includes(d));
      if (!allowed) return res.status(403).json({ error: "Domain not allowed" });
    }

    const result = await widgetService.sendWidgetMessage(req.params.id, sessionId, message);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

widgetRouter.get("/:id/embed.js", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const backendUrl =
      process.env.PUBLIC_BACKEND_URL ||
      process.env.BACKEND_URL ||
      `${req.protocol}://${req.get("host")}`;
    const script = widgetService.generateEmbedScript(req.params.id, backendUrl);
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(script);
  } catch (error) {
    next(error);
  }
});
