import path from "path";
import fs from "fs";
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { createId } from "@paralleldrive/cuid2";
import { PROMPT_INJECTION_SECURITY_PREAMBLE } from "@/services/agent/promptInjectionDefense";
import { getSupportAgentByPublicId } from "@/services/supportAgentService";
import { respondToSdrMessage } from "@/services/sdrChannelService";
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
      if (!agent) {
        return res.status(404).json({ success: false, message: "Support agent not found" });
      }
      return res.status(200).json({
        success: agent.status === "active",
        active: agent.status === "active",
        name: agent.name,
        description: agent.description ?? null,
        greeting: agent.greeting,
        brandColor: agent.brandColor,
        position: agent.position,
        avatarUrl: agent.avatarUrl ?? null,
        widgetLabel: agent.widgetLabel ?? null,
        widgetDisplay: agent.widgetDisplay ?? "label",
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
      if (!agent) {
        return res.status(404).json({ success: false, message: "Support agent not found" });
      }
      if (agent.status !== "active") {
        return res.status(200).json({
          success: false,
          code: "agentDisabled",
          agentName: agent.name,
          message: `${agent.name} is disabled. Enable in your Verxio dashboard support agent section.`,
        });
      }

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

      if (agent.mode === "sdr") {
        const reply = await respondToSdrMessage({
          supportAgentId: agent.id,
          sessionIdentifier: sessionId,
          message: fullUserText,
        });
        const updatedMessages = await getSupportChatMessages(agent.id, sessionId);
        const responseMessages = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
          attachmentUrls: m.attachmentUrls ?? undefined,
          timestamp: m.createdAt.toISOString(),
        }));
        const feedback = await getSessionFeedback(agent.id, sessionId);
        return res.status(200).json({
          success: true,
          reply,
          messages: responseMessages,
          suggestShowRating: feedback.suggestRating,
        });
      }

      const { id: supportChatSessionId } = await getOrCreateSupportChatSession(agent.id, sessionId);
      const dbMessages = await getSupportChatMessages(agent.id, sessionId, 30);
      const history = dbMessages.map((m) => ({ role: m.role, content: m.content }));

      // Build KB context
      const kbContext = await buildKnowledgeContext(
        agent.userId,
        agent.knowledgeBaseIds,
        fullUserText
      );

      const fallbackEmail = agent.fallbackEmail;

      const personaParts = [
        agent.name
          ? `You are "${agent.name}". You represent this brand and speak as its support agent.`
          : "",
        agent.description
          ? `Your role and personality: ${agent.description}.`
          : "You should sound like a warm, friendly human support agent.",
      ].filter(Boolean);

      const systemPrompt = [
        PROMPT_INJECTION_SECURITY_PREAMBLE,
        personaParts.join(" "),
        agent.name
          ? `When the user says hello, hi, or similar greetings, respond warmly as ${agent.name} (e.g. "Hi! I'm ${agent.name}. How can I help you today?"). Do NOT mention Verxio unless the user asks about the platform. You represent ${agent.name}, not Verxio.`
          : "When the user says hello or similar, respond with a warm greeting. Do not mention Verxio unless the user asks about it.",
        "You MUST answer ONLY using information found in the provided knowledge base context below. Do NOT make up, assume, or infer any facts, features, pricing, steps, or details that are not explicitly stated in the knowledge base.",
        "If the knowledge base context is empty or does not contain a clear answer to the user's question, you MUST say you are not sure. NEVER fabricate an answer.",
        "For questions: start directly with the answer. Do NOT repeat your name in every reply. Introduce yourself only when the user says hello or asks who you are.",
        fallbackEmail
          ? `When you cannot answer confidently, say something like: "I'm not certain about that. Please email us at ${fallbackEmail} and our team will get back to you."`
          : "When you cannot answer confidently, ask the user to contact support via email and say that a human agent will respond.",
        "",
        "TONE:",
        "Never use em dashes. Use commas, periods, or semicolons instead.",
        'Never use AI-like filler phrases: "Great question!", "Absolutely!", "Of course!", "Certainly!", "Sure thing!". Start directly with the answer.',
        'Use first-person language ("I") and a warm, conversational tone. Sound like a helpful human, not a bot.',
        "",
        "FORMATTING:",
        "Each answer or point gets its own line or short paragraph. Put a blank line between separate thoughts.",
        "Never cram multiple ideas into one wall of text. Break it up so it is easy to read.",
        "If you list steps or options, give each its own line. Do not use dashes or bullets, just separate lines.",
        "Keep responses focused and concise. Answer what was asked. Do not pad with extra sentences.",
        "",
        "Only when the user has clearly indicated they have no further questions (e.g. they said no, that's all, I'm good, or similar in response to you asking if there's anything else you can help with), you may briefly ask for a rating. For example: \"If you have a moment, would you mind rating your experience with me from 1 to 5 stars? I'd love to hear how I could improve.\" Then end your reply with exactly a single line: [SUGGEST_RATING]. Do NOT ask for a rating or add [SUGGEST_RATING] in any other situation. The [SUGGEST_RATING] line will not be shown to the user.",
      ].join("\n\n");

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
