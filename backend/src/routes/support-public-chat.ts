import { Router, Request, Response, NextFunction } from "express";
import {
  getSupportAgentByPublicId,
  incrementSupportAgentConversations,
} from "@/services/supportAgentService";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

export const supportPublicChatRouter = Router();

type SupportChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// In-memory conversation store keyed by supportAgentId + sessionId
const supportConversations = new Map<string, SupportChatMessage[]>();

function getSessionKey(agentId: string, sessionId: string): string {
  return `${agentId}:${sessionId}`;
}

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

supportPublicChatRouter.post(
  "/:publicId/messages",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { publicId } = req.params;
      const { message, sessionId } = req.body || {};

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

      const sessionKey = getSessionKey(agent.id, sessionId);
      const history = supportConversations.get(sessionKey) || [];

      // Build KB context
      const kbContext = await buildKnowledgeContext(agent.userId, agent.knowledgeBaseIds, message);

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
      ].join(" ");

      const conversationText = history
        .slice(-10)
        .map((m) => `${m.role === "user" ? "User" : "Support"}: ${m.content}`)
        .join("\n");

      const prompt = `${systemPrompt}${kbContext}\n\nConversation so far:\n${conversationText}\nUser: ${message}\n\nSupport:`;

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

      const { text } = await generateText({
        model: google("gemini-3.1-flash-lite-preview"),
        prompt,
      });

      const reply = text || "Sorry, I couldn't process your request.";

      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: reply });
      if (history.length > 30) {
        history.splice(0, history.length - 30);
      }
      supportConversations.set(sessionKey, history);

      await incrementSupportAgentConversations(agent.id);

      return res.status(200).json({
        success: true,
        reply,
        messages: history,
      });
    } catch (error) {
      next(error);
    }
  }
);
