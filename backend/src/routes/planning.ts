import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { AppError } from "../middleware/errorHandler";
import {
  getWorkflowPlan,
  sendPlanningMessage,
  sendPlanningMessageStreaming,
  generateWorkflowPrompt,
  clearPlanningConversation,
  recordSuccessfulGeneration,
  getUserInsights,
} from "../services/planningService";
import { prisma as prismaClient } from "../lib/prisma";
import { requireFeature } from "../middleware/subscriptionAuth";
import { checkQuota } from "../middleware/subscriptionRateLimit";
import { SUBSCRIPTION_FEATURES } from "../config/subscription-features";
import { QUOTA_COST } from "../config/rate-limits";

export const planningRouter: Router = Router();

// Apply Better Auth middleware to all routes
planningRouter.use(betterAuthMiddleware);
// Require plan feature for all planning routes (no debit for read-only)
planningRouter.use(requireFeature(SUBSCRIPTION_FEATURES.PLAN_NODE));

/**
 * GET /planning/workflow/:workflowId
 * Get existing plan for workflow (read-only, no credit debit)
 */
planningRouter.get(
  "/workflow/:workflowId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { workflowId } = req.params;

      // Verify workflow belongs to user
      const workflow = await prismaClient.workflow.findFirst({
        where: {
          id: workflowId,
          userId: user.id,
        },
      });

      if (!workflow) {
        throw new AppError("Workflow not found", 404);
      }

      const plan = await getWorkflowPlan(workflowId);

      if (!plan) {
        return res.json({ plan: null, conversationHistory: [] });
      }

      res.json({
        plan: {
          id: workflowId,
          status: plan.status,
          generatedPrompt: plan.generatedPrompt,
          workflowStructure: plan.workflowStructure,
          approvedAt: plan.approvedAt,
        },
        conversationHistory: plan.conversationHistory,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /planning/message
 * Send message in planning conversation (debit once per message)
 */
planningRouter.post(
  "/message",
  checkQuota(QUOTA_COST.PLAN_NODE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { workflowId, message, attachments, model } = req.body;

      if (!workflowId) {
        throw new AppError("Workflow ID is required", 400);
      }

      if (!message || typeof message !== "string" || message.trim().length === 0) {
        throw new AppError("Message is required", 400);
      }

      // Verify workflow belongs to user
      const workflow = await prismaClient.workflow.findFirst({
        where: {
          id: workflowId,
          userId: user.id,
        },
      });

      if (!workflow) {
        throw new AppError("Workflow not found", 404);
      }

      const result = await sendPlanningMessage({
        workflowId,
        userId: user.id,
        message: message.trim(),
        attachments,
        model,
      });

      res.json({
        response: result.response,
        conversationHistory: result.conversationHistory,
        workflowModified: result.workflowModified,
        toolsUsed: result.toolsUsed,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /planning/message/stream
 * Send message in planning conversation with SSE streaming (debit once per call)
 */
planningRouter.post(
  "/message/stream",
  checkQuota(QUOTA_COST.PLAN_NODE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { workflowId, message, attachments, model } = req.body;

      if (!workflowId) {
        throw new AppError("Workflow ID is required", 400);
      }

      if (!message || typeof message !== "string" || message.trim().length === 0) {
        throw new AppError("Message is required", 400);
      }

      // Verify workflow belongs to user
      const workflow = await prismaClient.workflow.findFirst({
        where: {
          id: workflowId,
          userId: user.id,
        },
      });

      if (!workflow) {
        throw new AppError("Workflow not found", 404);
      }

      // Set up SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      try {
        // Stream events from agent
        for await (const event of sendPlanningMessageStreaming({
          workflowId,
          userId: user.id,
          message: message.trim(),
          attachments,
          model,
        })) {
          // Send event to client
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        // Send completion event
        res.write(`data: ${JSON.stringify({ type: "complete" })}\n\n`);
      } catch (error) {
        // Send error event
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : String(error),
          })}\n\n`
        );
      }

      // End the stream
      res.end();
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /planning/generate-prompt
 * Generate prompt from conversation using AI analysis (debit once per call)
 */
planningRouter.post(
  "/generate-prompt",
  checkQuota(QUOTA_COST.PLAN_NODE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { workflowId } = req.body;

      if (!workflowId) {
        throw new AppError("Workflow ID is required", 400);
      }

      // Verify workflow belongs to user
      const workflow = await prismaClient.workflow.findFirst({
        where: {
          id: workflowId,
          userId: user.id,
        },
      });

      if (!workflow) {
        throw new AppError("Workflow not found", 404);
      }

      const result = await generateWorkflowPrompt(workflowId, user.id);

      res.json({
        prompt: result.generatedPrompt,
        summary: result.summary,
        suggestedNodes: result.suggestedNodes,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /planning/upload
 * Upload files (API docs, images, documents)
 * Note: This is a simplified version. In production, you'd want to use multer or similar
 * for proper file handling, and store files in cloud storage (S3, etc.)
 */
planningRouter.post("/upload", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { workflowId } = req.body;

    if (!workflowId) {
      throw new AppError("Workflow ID is required", 400);
    }

    // Verify workflow belongs to user
    const workflow = await prismaClient.workflow.findFirst({
      where: {
        id: workflowId,
        userId: user.id,
      },
    });

    if (!workflow) {
      throw new AppError("Workflow not found", 404);
    }

    // For now, accept file metadata in request body
    // In production, use multer to handle multipart/form-data
    const files = req.body.files || [];

    if (!Array.isArray(files) || files.length === 0) {
      throw new AppError("Files are required", 400);
    }

    // Process files as attachments
    res.json({
      files: files.map((file: any) => ({
        fileId: file.fileId || file.id,
        fileName: file.fileName || file.name,
        fileType: file.fileType || file.type,
        url: file.url,
        extractedText: file.extractedText || file.content,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /planning/workflow/:workflowId/clear
 * Clear conversation history
 */
planningRouter.delete(
  "/workflow/:workflowId/clear",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { workflowId } = req.params;

      // Verify workflow belongs to user
      const workflow = await prismaClient.workflow.findFirst({
        where: {
          id: workflowId,
          userId: user.id,
        },
      });

      if (!workflow) {
        throw new AppError("Workflow not found", 404);
      }

      await clearPlanningConversation(workflowId);

      res.json({
        success: true,
        message: "Conversation cleared successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /planning/record-success
 * Record a successful workflow generation for learning
 */
planningRouter.post("/record-success", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { workflowId, description } = req.body;

    if (!workflowId) {
      throw new AppError("Workflow ID is required", 400);
    }

    // Verify workflow belongs to user
    const workflow = await prismaClient.workflow.findFirst({
      where: {
        id: workflowId,
        userId: user.id,
      },
    });

    if (!workflow) {
      throw new AppError("Workflow not found", 404);
    }

    await recordSuccessfulGeneration(
      workflowId,
      user.id,
      description || workflow.name || "Unnamed workflow"
    );

    res.json({
      success: true,
      message: "Workflow pattern recorded for learning",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /planning/insights
 * Get user's workflow insights based on their history
 */
planningRouter.get("/insights", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const insights = await getUserInsights(user.id);

    res.json({
      insights,
    });
  } catch (error) {
    next(error);
  }
});
