import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import * as humanTaskService from "../services/humanTaskService";
import * as humanWorkerService from "../services/humanWorkerService";
import * as taskSubmissionService from "../services/taskSubmissionService";
import * as taskReportService from "../services/taskReportService";
import { listAllActiveChannels } from "../services/supportChannelService";
import { generateTextWithSystemPrompt } from "../services/agent/agentService";

export const humanTasksRouter: Router = Router();

humanTasksRouter.get(
  "/channels",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const channels = await listAllActiveChannels(userId);
      res.json({ channels });
    } catch (error) {
      next(error);
    }
  }
);

humanTasksRouter.post(
  "/ai-fill",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "prompt is required" });
      }

      const systemPrompt = `You are an AI manager that converts a natural language task description into structured form fields for creating a human compliance task.

Given a user's description, extract and return a JSON object with these fields:
- name (string, required): Short task name
- description (string): Detailed description
- evidenceType (string): One of "PHOTO", "TEXT", "PHOTO_AND_TEXT", "DOCUMENT". DOCUMENT is for PDFs, reports, memos, or file uploads. Default "PHOTO"
- recurrenceType (string): One of "ONCE", "INTERVAL", "DAILY", "WEEKLY". Default "DAILY"
- recurrenceInterval (number or null): Minutes between tasks for INTERVAL type
- scheduledTimes (string[]): Times of day in HH:MM format, e.g. ["09:00", "14:00"]
- timezone (string): IANA timezone, default "UTC"
- acceptanceRules (string[]): Specific rules the AI will use to vet evidence submissions
- scoringEnabled (boolean): Default true
- passingScore (number): 0-100, default 70
- graceMinutes (number): Default 15
- resubmissionAllowed (boolean): Default true
- reportTime (string): Time in HH:MM for daily report, default "18:00"

Respond ONLY with a valid JSON object. No markdown, no explanation, no code fences. Just the raw JSON.

Be smart about inferring fields:
- If they mention "every 2 hours", set recurrenceType to "INTERVAL" and recurrenceInterval to 120
- If they mention "clean", "mop", "sweep", infer PHOTO evidence and generate relevant acceptance rules
- If they mention "report", "memo", "document", "PDF", "end of day report", infer DOCUMENT evidence
- If they mention specific times, parse them into scheduledTimes
- Generate 2-4 clear, specific acceptance rules based on the task description
- Infer a reasonable passing score based on task criticality`;

      const result = await generateTextWithSystemPrompt({
        systemPrompt,
        userPrompt: prompt,
      });

      let parsed;
      try {
        const cleaned = result.text.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
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

// Task CRUD
humanTasksRouter.get(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const tasks = await humanTaskService.listHumanTasks(userId);
      res.json({ tasks });
    } catch (error) {
      next(error);
    }
  }
);

humanTasksRouter.post(
  "/",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const task = await humanTaskService.createHumanTask(userId, req.body);
      res.status(201).json({ task });
    } catch (error) {
      next(error);
    }
  }
);

humanTasksRouter.get(
  "/:taskId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const task = await humanTaskService.getHumanTask(userId, req.params.taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json({ task });
    } catch (error) {
      next(error);
    }
  }
);

humanTasksRouter.put(
  "/:taskId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      await humanTaskService.updateHumanTask(userId, req.params.taskId, req.body);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

humanTasksRouter.delete(
  "/:taskId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      await humanTaskService.deleteHumanTask(userId, req.params.taskId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

humanTasksRouter.post(
  "/:taskId/pause",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      await humanTaskService.pauseHumanTask(userId, req.params.taskId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

humanTasksRouter.post(
  "/:taskId/resume",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      await humanTaskService.resumeHumanTask(userId, req.params.taskId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// Workers
humanTasksRouter.get(
  "/:taskId/workers",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workers = await humanWorkerService.listWorkers(req.params.taskId);
      res.json({ workers });
    } catch (error) {
      next(error);
    }
  }
);

humanTasksRouter.post(
  "/:taskId/workers",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      const worker = await humanWorkerService.addWorker(userId, req.params.taskId, req.body);
      res.status(201).json({ worker });
    } catch (error) {
      next(error);
    }
  }
);

humanTasksRouter.delete(
  "/:taskId/workers/:workerId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId as string;
      await humanWorkerService.removeWorker(userId, req.params.taskId, req.params.workerId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// Submissions
humanTasksRouter.get(
  "/:taskId/submissions",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = {
        workerId: req.query.workerId as string | undefined,
        status: req.query.status as string | undefined,
        date: req.query.date as string | undefined,
      };
      const submissions = await taskSubmissionService.listSubmissions(
        req.params.taskId,
        filters
      );
      res.json({ submissions });
    } catch (error) {
      next(error);
    }
  }
);

humanTasksRouter.get(
  "/:taskId/submissions/:submissionId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const submission = await taskSubmissionService.getSubmission(req.params.submissionId);
      if (!submission) return res.status(404).json({ error: "Submission not found" });
      res.json({ submission });
    } catch (error) {
      next(error);
    }
  }
);

// Reports
humanTasksRouter.get(
  "/:taskId/reports",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reports = await taskReportService.listReports(req.params.taskId);
      res.json({ reports });
    } catch (error) {
      next(error);
    }
  }
);

humanTasksRouter.get(
  "/:taskId/reports/:reportId",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await taskReportService.getReport(req.params.reportId);
      if (!report) return res.status(404).json({ error: "Report not found" });
      res.json({ report });
    } catch (error) {
      next(error);
    }
  }
);

humanTasksRouter.post(
  "/:taskId/reports/generate",
  betterAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await taskReportService.generateDailyReport(req.params.taskId);
      res.json({ report });
    } catch (error) {
      next(error);
    }
  }
);
