import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import * as goalService from "../services/goalService";
import * as taskService from "../services/agentTaskService";
import * as memoryService from "../services/agentMemoryService";
import * as watchService from "../services/agentWatchService";
import { generateProgressReport, deliverReport } from "../services/goalReportService";
import { getAvailableDeliveryActions } from "../services/composioReportDeliveryService";
import { generateTextWithSystemPrompt } from "../services/agent/agentService";
import { inngest } from "../inngest";

export const agentGoalsRouter: Router = Router();

agentGoalsRouter.post(
  "/ai-fill",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "prompt is required" });
      }

      const systemPrompt = `You are an AI assistant that converts a natural language goal description into structured form fields for creating an AI-managed goal.

Given a user's description, extract and return a JSON object with these fields:
- name (string, required): Short, descriptive goal name (3-8 words)
- objective (string, required): Detailed description of what the goal should achieve, including success criteria and scope

Respond ONLY with a valid JSON object. No markdown, no explanation, no code fences. Just the raw JSON.

Be thorough in the objective field. Include:
- What needs to be accomplished
- Key milestones or deliverables
- Success criteria
- Any constraints or requirements mentioned`;

      const result = await generateTextWithSystemPrompt({
        systemPrompt,
        userPrompt: prompt,
      });

      let parsed;
      try {
        const cleaned = result.text
          .replace(/```json?\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        return res.status(422).json({ error: "Failed to parse AI response", raw: result.text });
      }

      res.json({ fields: parsed });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.get(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const goals = await goalService.listGoals(userId);
      res.json({ goals });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.post(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const goal = await goalService.createGoal(userId, req.body);
      res.status(201).json({ goal });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.get(
  "/watches",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const watches = await watchService.listWatches(userId);
      res.json({ watches });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.post(
  "/watches",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const watch = await watchService.createWatch(userId, req.body);
      res.status(201).json({ watch });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.delete(
  "/watches/:watchId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      await watchService.deleteWatch(userId, req.params.watchId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.post(
  "/watches/:watchId/pause",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      await watchService.pauseWatch(userId, req.params.watchId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.post(
  "/watches/:watchId/resume",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      await watchService.resumeWatch(userId, req.params.watchId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.get(
  "/delivery-actions/available",
  betterAuthMiddleware,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const actions = getAvailableDeliveryActions();
      res.json({ actions });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.get(
  "/:goalId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const goal = await goalService.getGoal(userId, req.params.goalId);
      if (!goal) return res.status(404).json({ error: "Goal not found" });
      res.json({ goal });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.delete(
  "/:goalId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      await goalService.deleteGoal(userId, req.params.goalId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.get(
  "/:goalId/tasks",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await goalService.repairStuckInProgressTasksForPausedOrStoppedGoals(req.params.goalId);
      const tasks = await taskService.getGoalTasks(req.params.goalId);
      res.json({ tasks });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.put(
  "/:goalId/tasks/:taskId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, output, blockerReason } = req.body;
      const task = await taskService.updateTaskStatus(
        req.params.taskId,
        status,
        output,
        blockerReason
      );
      res.json({ task });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.get(
  "/:goalId/memories",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const memories = await memoryService.recallFacts(userId, undefined, req.params.goalId);
      res.json({ memories });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.delete(
  "/:goalId/memories/:memoryId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      await memoryService.deleteMemory(userId, req.params.memoryId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.post(
  "/:goalId/pause",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const goal = await goalService.getGoal(userId, req.params.goalId);
      if (!goal) return res.status(404).json({ error: "Goal not found" });
      if (!["EXECUTING", "PLANNING"].includes(goal.status)) {
        return res.status(400).json({ error: `Cannot pause a goal in ${goal.status} status` });
      }
      await goalService.pauseGoal(req.params.goalId);
      await inngest.send({
        name: "verxio/goal.paused",
        data: { goalId: req.params.goalId },
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.post(
  "/:goalId/resume",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const goal = await goalService.getGoal(userId, req.params.goalId);
      if (!goal) return res.status(404).json({ error: "Goal not found" });
      if (!["PAUSED", "STOPPED"].includes(goal.status)) {
        return res.status(400).json({ error: `Cannot resume a goal in ${goal.status} status` });
      }
      await goalService.resumeGoal(req.params.goalId, userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.post(
  "/:goalId/approve",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await inngest.send({
        name: "verxio/goal.approval-responded",
        data: {
          goalId: req.params.goalId,
          decision: "approve",
        },
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

agentGoalsRouter.post(
  "/:goalId/reject",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await inngest.send({
        name: "verxio/goal.approval-responded",
        data: {
          goalId: req.params.goalId,
          decision: "reject",
        },
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);
