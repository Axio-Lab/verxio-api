import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { AppError } from "../middleware/errorHandler";
import {
  getOrCreateWorkflowPlan,
  getWorkflowPlan,
  sendPlanningMessage,
  generatePromptFromConversation,
  clearConversation,
  processUploadedFiles,
} from "../services/planningService";
import { prisma as prismaClient } from "../lib/prisma";

export const planningRouter: Router = Router();

// Apply Better Auth middleware to all routes
planningRouter.use(betterAuthMiddleware);

/**
 * GET /planning/workflow/:workflowId
 * Get existing plan for workflow
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
 * Send message in planning conversation
 */
planningRouter.post("/message", async (req: Request, res: Response, next: NextFunction) => {
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
      message: message.trim(),
      attachments,
      model,
    });

    res.json({
      response: result.response,
      conversationHistory: result.conversationHistory,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /planning/generate-prompt
 * Generate prompt from conversation
 */
planningRouter.post("/generate-prompt", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { workflowId, model } = req.body;

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

    const result = await generatePromptFromConversation({
      workflowId,
      model,
    });

    res.json({
      prompt: result.prompt,
      workflowStructure: result.workflowStructure,
      credentials: result.credentials,
    });
  } catch (error) {
    next(error);
  }
});

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

    const processedFiles = await processUploadedFiles(files);

    res.json({
      files: processedFiles,
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

      await clearConversation(workflowId);

      res.json({
        success: true,
        message: "Conversation cleared successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);
