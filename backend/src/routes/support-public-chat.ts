import path from "path";
import fs from "fs";
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { createId } from "@paralleldrive/cuid2";
import { getSupportAgentByPublicId } from "@/services/supportAgentService";
import {
  getOrCreateSupportChatSession,
  getSupportChatMessages,
  appendSupportChatMessages,
  updateSessionFeedback,
  getSessionFeedback,
  updateSessionSuggestRating,
} from "@/services/supportChatSessionService";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { extractPdfTextFromUrl } from "@/services/supportChatPdf";

export const supportPublicChatRouter = Router();

const SUPPORT_UPLOADS_DIR = path.join(process.cwd(), "public", "support-uploads");
const MAX_SUPPORT_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORT_ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

const supportStorage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    if (!fs.existsSync(SUPPORT_UPLOADS_DIR)) {
      fs.mkdirSync(SUPPORT_UPLOADS_DIR, { recursive: true });
    }
    cb(null, SUPPORT_UPLOADS_DIR);
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const ext =
      path.extname(file.originalname) || (file.mimetype === "application/pdf" ? ".pdf" : ".jpg");
    cb(null, `${createId()}${ext}`);
  },
});

const supportUpload = multer({
  storage: supportStorage,
  limits: { fileSize: MAX_SUPPORT_FILE_SIZE },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, accept?: boolean) => void
  ) => {
    if (SUPPORT_ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Allowed: image (jpeg, png, gif, webp), PDF.`
        )
      );
    }
  },
});

async function buildKnowledgeContext(
  userId: string,
  knowledgeBaseIds: string[] | null | undefined,
  query: string
): Promise<string> {
  if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) return "";

  try {
    const { searchKnowledge } = await import("../services/knowledgeBaseService");
    const chunks: Array<{ content: string }> = [];

    for (const kbId of knowledgeBaseIds) {
      const kbChunks = await searchKnowledge(kbId, query, 3).catch(() => []);
      if (Array.isArray(kbChunks)) {
        chunks.push(...kbChunks.slice(0, 3));
      }
    }

    if (!chunks.length) return "";

    const combined = chunks.map((c, i) => `Snippet ${i + 1}:\n${c.content}`).join("\n\n---\n\n");

    return `\n\n[Support Knowledge Base]\n${combined}\n\n[End of Knowledge Base]\n`;
  } catch {
    return "";
  }
}

/**
 * POST /api/public/support-chat/upload
 * Upload a single file (image or PDF) for support chat. Returns public URL.
 * Must be defined before /:publicId routes.
 */
supportPublicChatRouter.post(
  "/upload",
  supportUpload.single("file"),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }
      const baseUrl = process.env.API_PUBLIC_URL || process.env.API_URL || "";
      const url = baseUrl
        ? `${baseUrl.replace(/\/+$/, "")}/support-uploads/${req.file.filename}`
        : `/support-uploads/${req.file.filename}`;
      return res.status(200).json({
        success: true,
        url,
        type: req.file.mimetype.startsWith("image/") ? "image" : "pdf",
      });
    } catch (error) {
      next(error);
    }
  }
);

supportPublicChatRouter.get(
  "/:publicId/info",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { publicId } = req.params;
      if (!publicId) {
        return res.status(400).json({ success: false, message: "publicId is required" });
      }
      const agent = await getSupportAgentByPublicId(publicId);
      if (!agent || agent.status !== "active") {
        return res.status(404).json({ success: false, message: "Support agent not found" });
      }
      return res.status(200).json({
        success: true,
        name: agent.name,
        description: agent.description ?? null,
        greeting: agent.greeting,
        brandColor: agent.brandColor,
        position: agent.position,
      });
    } catch (error) {
      next(error);
    }
  }
);

supportPublicChatRouter.get(
  "/:publicId/session",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { publicId } = req.params;
      const sessionId = (req.query.sessionId as string) || (req.body?.sessionId as string);

      if (!publicId) {
        return res.status(400).json({ success: false, message: "publicId is required" });
      }
      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({ success: false, message: "sessionId is required" });
      }

      const agent = await getSupportAgentByPublicId(publicId);
      if (!agent || agent.status !== "active") {
        return res.status(404).json({ success: false, message: "Support agent not found" });
      }

      const [messages, feedback] = await Promise.all([
        getSupportChatMessages(agent.id, sessionId),
        getSessionFeedback(agent.id, sessionId),
      ]);

      const formatted = messages.map((m) => ({
        role: m.role,
        content: m.content,
        attachmentUrls: m.attachmentUrls ?? undefined,
        timestamp: m.createdAt.toISOString(),
      }));

      return res.status(200).json({
        success: true,
        messages: formatted,
        rating: feedback.rating ?? undefined,
        feedback: feedback.feedback ?? undefined,
        suggestShowRating: feedback.suggestRating,
      });
    } catch (error) {
      next(error);
    }
  }
);

function isFallbackReply(reply: string, fallbackEmail: string | null): boolean {
  if (!fallbackEmail) return false;
  const lower = reply.toLowerCase();
  return (
    lower.includes("i'm not certain") ||
    lower.includes("i am not certain") ||
    (lower.includes("email") && lower.includes(fallbackEmail.toLowerCase()))
  );
}

supportPublicChatRouter.post(
  "/:publicId/feedback",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { publicId } = req.params;
      const { sessionId, rating, feedback } = req.body || {};

      if (!publicId) {
        return res.status(400).json({ success: false, message: "publicId is required" });
      }
      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({ success: false, message: "sessionId is required" });
      }
      if (rating === undefined || rating === null) {
        return res.status(400).json({ success: false, message: "rating is required (1-5)" });
      }
      const ratingNum = Number(rating);
      if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ success: false, message: "rating must be 1-5" });
      }

      const agent = await getSupportAgentByPublicId(publicId);
      if (!agent || agent.status !== "active") {
        return res.status(404).json({ success: false, message: "Support agent not found" });
      }

      const result = await updateSessionFeedback(
        agent.id,
        sessionId,
        ratingNum,
        typeof feedback === "string" ? feedback : undefined
      );
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

supportPublicChatRouter.post(
  "/:publicId/messages",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { publicId } = req.params;
      const { message, sessionId, attachments } = req.body || {};

      if (!publicId) {
        return res.status(400).json({ success: false, message: "publicId is required" });
      }
      if (!message || typeof message !== "string") {
        return res.status(400).json({ success: false, message: "message is required" });
      }
      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({ success: false, message: "sessionId is required" });
      }

      const agent = await getSupportAgentByPublicId(publicId);
      if (!agent || agent.status !== "active") {
        return res.status(404).json({ success: false, message: "Support agent not found" });
      }

      const { id: supportChatSessionId } = await getOrCreateSupportChatSession(agent.id, sessionId);
      const dbMessages = await getSupportChatMessages(agent.id, sessionId, 30);
      const history = dbMessages.map((m) => ({ role: m.role, content: m.content }));

      const attachmentList = Array.isArray(attachments)
        ? (attachments as Array<{ type?: string; url?: string }>).filter(
            (a) => a && typeof a.type === "string" && typeof a.url === "string"
          )
        : [];
      let pdfText = "";
      for (const a of attachmentList) {
        if (a.type === "pdf" || (a.url && a.url.toLowerCase().endsWith(".pdf"))) {
          const text = a.url ? await extractPdfTextFromUrl(a.url) : "";
          if (text) pdfText += (pdfText ? "\n\n" : "") + text;
        }
      }
      const fullUserText = message + (pdfText ? `\n\n[Attached PDF content]:\n${pdfText}` : "");

      // Build KB context
      const kbContext = await buildKnowledgeContext(
        agent.userId,
        agent.knowledgeBaseIds,
        fullUserText
      );

      const fallbackEmail = agent.fallbackEmail;

      const personaParts = [
        agent.name ? `Your name is "${agent.name}".` : "",
        agent.description
          ? `Your role and personality: ${agent.description}.`
          : "You should sound like a warm, friendly human support agent.",
      ].filter(Boolean);

      const systemPrompt = [
        personaParts.join(" "),
        "You are a dedicated customer support agent for a business using Verxio.",
        "You must answer ONLY using the provided support knowledge base context when available.",
        "Do NOT introduce yourself, do NOT say hello, and do NOT repeat your name in replies. Start directly with the answer UNLESS the user asks you to introduce yourself.",
        "If the knowledge base does not contain a clear answer, you MUST say you are not sure and ask the user to contact support via email.",
        fallbackEmail
          ? `When you cannot answer confidently, say something like: "I'm not certain about that. Please email us at ${fallbackEmail} and our team will get back to you."`
          : "When you cannot answer confidently, ask the user to contact support via email and say that a human agent will respond.",
        'Keep responses concise, friendly, and focused on helping the user, using first-person language ("I") and a conversational tone.',
        "Only when the user has clearly indicated they have no further questions (e.g. they said no, that's all, I'm good, or similar in response to you asking if there's anything else you can help with), you may briefly ask for a rating. For example: \"If you have a moment, would you mind rating your experience with me from 1–5 stars? I'd love to hear how I could improve my service for you!\" Then end your reply with exactly a single line: [SUGGEST_RATING]. Do NOT ask for a rating or add [SUGGEST_RATING] in any other situation—only after the user has said they have no more questions. The [SUGGEST_RATING] line will not be shown to the user.",
      ].join(" ");

      const conversationText = history
        .slice(-10)
        .map((m) => `${m.role === "user" ? "User" : "Support"}: ${m.content}`)
        .join("\n");

      const imageAttachments = attachmentList.filter(
        (a) => a.type === "image" || (a.url && /\.(jpe?g|png|gif|webp)$/i.test(a.url.split("?")[0]))
      );

      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: "Gemini API key is not configured on the server.",
        });
      }

      const google = createGoogleGenerativeAI({
        apiKey,
      });

      let text: string;
      if (imageAttachments.length > 0) {
        const promptText = `${systemPrompt}${kbContext}\n\nConversation so far:\n${conversationText}\nUser: ${fullUserText}\n\nSupport:`;
        const content: Array<{ type: "text"; text: string } | { type: "image"; image: string }> = [
          { type: "text", text: promptText },
        ];
        for (const a of imageAttachments) {
          content.push({ type: "image", image: a.url! });
        }
        const result = await generateText({
          model: google("gemini-3.1-flash-lite-preview"),
          messages: [{ role: "user", content }],
        });
        text = result.text;
      } else {
        const prompt = `${systemPrompt}${kbContext}\n\nConversation so far:\n${conversationText}\nUser: ${fullUserText}\n\nSupport:`;
        const result = await generateText({
          model: google("gemini-3.1-flash-lite-preview"),
          prompt,
        });
        text = result.text;
      }

      const rawReply = text || "Sorry, I couldn't process your request.";
      const suggestRatingMarker = "\n[SUGGEST_RATING]";
      const hasSuggestRating =
        rawReply.trimEnd().endsWith("[SUGGEST_RATING]") || rawReply.includes(suggestRatingMarker);
      const reply = hasSuggestRating
        ? rawReply.replace(/\n?\[SUGGEST_RATING\]\s*$/i, "").trimEnd()
        : rawReply;
      const hadFallbackReply = isFallbackReply(reply, fallbackEmail);

      const attachmentUrls =
        attachmentList.length > 0
          ? (attachmentList.filter((a) => a.type && a.url) as { type: string; url: string }[])
          : undefined;

      await appendSupportChatMessages(
        supportChatSessionId,
        { content: message, attachmentUrls },
        { content: reply, hadFallbackReply }
      );
      await updateSessionSuggestRating(supportChatSessionId, hasSuggestRating);

      const updatedMessages = await getSupportChatMessages(agent.id, sessionId);
      const responseMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
        attachmentUrls: m.attachmentUrls ?? undefined,
        timestamp: m.createdAt.toISOString(),
      }));

      return res.status(200).json({
        success: true,
        reply,
        messages: responseMessages,
        suggestShowRating: hasSuggestRating,
      });
    } catch (error) {
      next(error);
    }
  }
);
