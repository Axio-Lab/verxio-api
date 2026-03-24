import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import * as kbService from "../services/knowledgeBaseService";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import path from "path";

export const knowledgeBaseRouter: Router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function inferSourceType(filename: string): string {
  const ext = path.extname(filename || "").toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  if (ext === ".md" || ext === ".markdown") return "markdown";
  return "text";
}

async function extractUploadedDocumentText(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (ext === ".pdf") {
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      return (result.text || "").trim();
    } finally {
      await parser.destroy();
    }
  }

  if (ext === ".docx") {
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    return (parsed.value || "").trim();
  }

  if (ext === ".txt" || ext === ".md" || ext === ".markdown") {
    return file.buffer.toString("utf8").trim();
  }

  throw new Error("Unsupported file type. Allowed: .pdf, .docx, .txt, .md, .markdown");
}

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
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const title = String(req.body?.title || "").trim();
      const sourceUrl = typeof req.body?.sourceUrl === "string" ? req.body.sourceUrl : undefined;
      const pastedContent = String(req.body?.content || "").trim();
      const file = req.file;

      if (!title) {
        return res.status(400).json({ error: "title is required" });
      }

      const hasPastedContent = pastedContent.length > 0;
      const hasUploadedFile = !!file;

      if (hasPastedContent === hasUploadedFile) {
        return res.status(400).json({
          error: "Provide either pasted content or an uploaded document (not both).",
        });
      }

      let content = pastedContent;
      let sourceType = "text";

      if (file) {
        try {
          content = await extractUploadedDocumentText(file);
          sourceType = inferSourceType(file.originalname);
        } catch (parseError) {
          return res.status(400).json({
            error:
              parseError instanceof Error
                ? parseError.message
                : "Failed to parse uploaded document.",
          });
        }
      }

      if (!content.trim()) {
        return res.status(400).json({ error: "Document content is empty after parsing." });
      }

      const doc = await kbService.addDocument(req.params.id, userId, {
        title,
        sourceType,
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
