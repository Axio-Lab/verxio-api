/**
 * Public chat routes for shareable workflow links.
 * No auth required. Used by /chat/[workflowId] page.
 */

import path from "path";
import fs from "fs";
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { createId } from "@paralleldrive/cuid2";
import { inngest } from "../inngest";
import { prisma } from "@/lib/prisma";

export const publicChatRouter = Router();

const CHAT_UPLOADS_DIR = path.join(process.cwd(), "public", "chat-uploads");
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB per file
const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
];

const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    if (!fs.existsSync(CHAT_UPLOADS_DIR)) {
      fs.mkdirSync(CHAT_UPLOADS_DIR, { recursive: true });
    }
    cb(null, CHAT_UPLOADS_DIR);
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const ext = path.extname(file.originalname) || getExtFromMime(file.mimetype);
    cb(null, `${createId()}${ext}`);
  },
});

function getExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "audio/webm": ".weba",
    "audio/ogg": ".ogg",
  };
  return map[mime] || "";
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, accept?: boolean) => void
  ) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: image, video, audio.`));
    }
  },
});

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_WAIT_MS = 90_000; // 90 seconds

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find first WEBHOOK node for a workflow (for public chat trigger).
 */
async function findWebhookNode(workflowId: string): Promise<{ id: string } | null> {
  const node = await prisma.node.findFirst({
    where: { workflowId, type: "WEBHOOK" },
    select: { id: true },
  });
  return node;
}

/**
 * GET /api/public/chat/:workflowId/info
 * Returns whether the workflow has a webhook trigger (shareable chat compatible).
 */
publicChatRouter.get(
  "/:workflowId/info",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId } = req.params;
      if (!workflowId) {
        return res.status(400).json({ success: false, message: "workflowId is required" });
      }

      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        select: { id: true, name: true },
      });
      if (!workflow) {
        return res.status(404).json({ success: false, message: "Workflow not found" });
      }

      const webhookNode = await findWebhookNode(workflowId);
      const hasWebhookTrigger = !!webhookNode;

      return res.status(200).json({
        success: true,
        hasWebhookTrigger,
        workflowName: workflow.name,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/public/chat/upload
 * Upload a single file (image, video, or audio) for use in public chat. Returns a public URL.
 * Multipart form field: "file"
 */
publicChatRouter.post(
  "/upload",
  upload.single("file"),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }
      const baseUrl = process.env.API_PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
      const url = `${baseUrl}/chat-uploads/${req.file.filename}`;
      return res.status(200).json({ success: true, url });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/public/chat/:workflowId
 * Send a chat message (and optional image/video/audio URLs) to trigger the workflow.
 * Body: { message: string, image?: string, video?: string, audio?: string }
 */
publicChatRouter.post("/:workflowId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflowId } = req.params;
    if (!workflowId) {
      return res.status(400).json({ success: false, message: "workflowId is required" });
    }

    const body = req.body || {};
    const message = typeof body.message === "string" ? body.message : "";
    const image = typeof body.image === "string" ? body.image : undefined;
    const video = typeof body.video === "string" ? body.video : undefined;
    const audio = typeof body.audio === "string" ? body.audio : undefined;
    const input = {
      message,
      ...(image !== undefined && { image }),
      ...(video !== undefined && { video }),
      ...(audio !== undefined && { audio }),
    };

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true, userId: true },
    });
    if (!workflow) {
      return res.status(404).json({ success: false, message: "Workflow not found" });
    }

    const webhookNode = await findWebhookNode(workflowId);
    if (!webhookNode) {
      return res.status(400).json({
        success: false,
        message: "Workflow must have a Webhook trigger to use shareable chat.",
      });
    }

    const run = await prisma.publicChatRun.create({
      data: {
        workflowId,
        status: "PENDING",
        input: input as object,
      },
    });

    await inngest.send({
      name: "workflow/trigger",
      data: {
        workflowId,
        userId: workflow.userId,
        webhookNodeId: webhookNode.id,
        publicChatRunId: run.id,
        initialData: {
          webhookPayload: input,
          webhookHeaders: {},
        },
      },
    });

    const deadline = Date.now() + POLL_MAX_WAIT_MS;
    let last: typeof run | null = null;

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const updated = await prisma.publicChatRun.findUnique({
        where: { id: run.id },
      });
      if (!updated) break;
      last = updated;
      if (updated.status === "COMPLETED") {
        return res.status(200).json({
          success: true,
          output: updated.output ?? {},
        });
      }
      if (updated.status === "FAILED") {
        return res.status(200).json({
          success: false,
          error: updated.error ?? "Workflow failed",
        });
      }
    }

    return res.status(504).json({
      success: false,
      message: "Workflow did not complete in time",
      runId: run.id,
    });
  } catch (error) {
    next(error);
  }
});
