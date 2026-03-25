import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import * as subagentService from "../services/customSubagentService";

export const customSubagentsRouter: Router = Router();

const BUILTIN_SUBAGENTS = [
  {
    slug: "ops-researcher",
    name: "Ops Researcher",
    description:
      "Research specialist for business operations, industry data, APIs, integrations, and documentation.",
    isBuiltin: true,
  },
  {
    slug: "content-writer",
    name: "Content Writer",
    description:
      "Content creation specialist for producing documents, reports, emails, marketing copy, SOPs, and proposals.",
    isBuiltin: true,
  },
  {
    slug: "data-analyst",
    name: "Data Analyst",
    description:
      "Data analysis and processing specialist for generating insights, comparing options, and producing analytical output.",
    isBuiltin: true,
  },
  {
    slug: "task-executor",
    name: "Task Executor",
    description:
      "Action-oriented executor for creating documents, sending communications, running integrations, and executing code.",
    isBuiltin: true,
  },
];

customSubagentsRouter.get(
  "/available",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const customSubagents = await subagentService.listSubagents(user.id);
      res.json({
        builtinSubagents: BUILTIN_SUBAGENTS,
        customSubagents: customSubagents.map((s: any) => ({ ...s, isBuiltin: false })),
      });
    } catch (err) {
      next(err);
    }
  }
);

customSubagentsRouter.get(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const subagents = await subagentService.listSubagents(user.id);
      res.json({ subagents });
    } catch (err) {
      next(err);
    }
  }
);

customSubagentsRouter.get(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const subagent = await subagentService.getSubagent(user.id, req.params.id as string);
      if (!subagent) return res.status(404).json({ error: "Subagent not found" });
      res.json(subagent);
    } catch (err) {
      next(err);
    }
  }
);

customSubagentsRouter.post(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { name, description, prompt, skillIds, tools, model, maxTurns } = req.body;

      if (!name || !description || !prompt) {
        return res.status(400).json({ error: "name, description, and prompt are required" });
      }

      const subagent = await subagentService.createSubagent(user.id, {
        name,
        description,
        prompt,
        skillIds,
        tools,
        model,
        maxTurns,
      });
      res.status(201).json(subagent);
    } catch (err) {
      next(err);
    }
  }
);

customSubagentsRouter.put(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const subagent = await subagentService.updateSubagent(
        user.id,
        req.params.id as string,
        req.body
      );
      res.json(subagent);
    } catch (err) {
      next(err);
    }
  }
);

customSubagentsRouter.delete(
  "/:id",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      await subagentService.deleteSubagent(user.id, req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);
