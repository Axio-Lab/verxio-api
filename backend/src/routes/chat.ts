import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { AppError } from "../middleware/errorHandler";
import { sendPlanningMessageStreaming } from "../services/planningService";
import { prisma } from "../lib/prisma";
import { parseConversationHistory } from "../lib/chatEncryption";
import * as workflowService from "../services/workflowService";

export const chatRouter: Router = Router();

const prismaClient = prisma as any;
const WEB_CHAT_INTEGRATION_ID = "web-chat";

chatRouter.use(betterAuthMiddleware);

async function getOrCreateDefaultWorkflow(userId: string): Promise<string> {
  const existing = await prismaClient.workflow.findFirst({
    where: { userId, name: "Verxio Chat Workspace" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const wf = await workflowService.createWorkflow({
    name: "Verxio Chat Workspace",
    userId,
  });
  return wf.id;
}

/**
 * POST /api/chat/upload
 * Upload files (images, documents) as base64 for use in the next chat message.
 * Mirrors the /planning/upload pattern.
 */
chatRouter.post("/upload", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.body.files || [];
    if (!Array.isArray(files) || files.length === 0) {
      throw new AppError("Files are required", 400);
    }

    res.json({
      files: files.map((file: any) => ({
        fileId: file.fileId || file.id || crypto.randomUUID(),
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
 * POST /api/chat/message/stream
 * Send a message to the Verxio agent with SSE streaming.
 */
chatRouter.post("/message/stream", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { message, attachments } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      throw new AppError("Message is required", 400);
    }

    const workflowId = await getOrCreateDefaultWorkflow(user.id);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    try {
      for await (const event of sendPlanningMessageStreaming({
        workflowId,
        userId: user.id,
        message: message.trim(),
        chatIntegrationId: WEB_CHAT_INTEGRATION_ID,
        externalId: user.id,
        attachments,
        isGeneralChat: true,
      })) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: "complete" })}\n\n`);
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        })}\n\n`
      );
    }

    res.end();
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/history
 * Return conversation history for the authenticated user.
 */
chatRouter.get("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    const convo = await prismaClient.chatConversation.findUnique({
      where: {
        chatIntegrationId_externalId: {
          chatIntegrationId: WEB_CHAT_INTEGRATION_ID,
          externalId: user.id,
        },
      },
    });

    if (!convo) {
      return res.json({ messages: [] });
    }

    const messages = parseConversationHistory(convo.conversationHistory);
    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/chat/history
 * Clear conversation history (start fresh).
 */
chatRouter.delete("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    await prismaClient.chatConversation.deleteMany({
      where: {
        chatIntegrationId: WEB_CHAT_INTEGRATION_ID,
        externalId: user.id,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
