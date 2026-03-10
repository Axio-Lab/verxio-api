import { getSupportAgent } from "./supportAgentService";
import {
  appendSupportChatMessages,
  getOrCreateSupportChatSession,
  updateSessionSuggestRating,
  getSessionFeedback,
  updateSessionFeedbackById,
} from "./supportChatSessionService";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

async function buildKnowledgeContext(
  userId: string,
  knowledgeBaseIds: string[] | null | undefined,
  query: string
): Promise<string> {
  if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) return "";

  try {
    const { searchKnowledge } = await import("./knowledgeBaseService");
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

function isFallbackReply(reply: string, fallbackEmail: string | null): boolean {
  if (!fallbackEmail) return false;
  const lower = reply.toLowerCase();
  return (
    lower.includes("i'm not certain") ||
    lower.includes("i am not certain") ||
    (lower.includes("email") && lower.includes(fallbackEmail.toLowerCase()))
  );
}

function isClosingMessage(message: string): boolean {
  const lower = message.trim().toLowerCase();
  if (!lower) return false;

  const phrases = [
    "no",
    "nope",
    "nothing else",
    "that's all",
    "thats all",
    "i'm good",
    "im good",
    "i am good",
    "no thank you",
    "no thanks",
    "nothing more",
    "no more questions",
  ];

  return phrases.some((p) => lower === p || lower.includes(p));
}

export async function respondToChannelMessage(options: {
  supportAgentId: string;
  externalId: string;
  message: string;
}) {
  const { supportAgentId, externalId, message } = options;

  const agent = await getSupportAgent(supportAgentId);
  if (!agent || agent.status !== "active") {
    throw new Error("Support agent not found or inactive");
  }

  const userId = agent.userId as string;

  const { id: sessionId } = await getOrCreateSupportChatSession(agent.id, externalId);

  // If the model previously asked for a rating in this session and the user now replies
  // with a simple 1–5 style answer (e.g. "5" or "5 stars"), treat it as feedback instead
  // of sending it back through the LLM.
  const feedbackState = await getSessionFeedback(agent.id, externalId).catch(() => ({
    rating: null,
    feedback: null,
    suggestRating: false,
  }));

  const trimmed = message.trim();
  const firstChar = trimmed.charAt(0);
  const numeric = Number(firstChar);
  const looksLikeRating =
    feedbackState.suggestRating && trimmed.length > 0 && numeric >= 1 && numeric <= 5;

  if (looksLikeRating) {
    const ratingValue = numeric;

    await updateSessionFeedbackById(sessionId, ratingValue);
    await updateSessionSuggestRating(sessionId, false);

    const replyText =
      "Thank you for your feedback! I really appreciate your rating. If you need anything else, just let me know.";

    await appendSupportChatMessages(
      sessionId,
      {
        content: message,
      },
      {
        content: replyText,
        hadFallbackReply: false,
      }
    );

    return replyText;
  }

  // If a rating already exists for this session and the user is clearly closing the
  // conversation (e.g. "nothing else", "that's all"), do not generate another reply
  // or ask for a rating again.
  if (feedbackState.rating != null && isClosingMessage(trimmed)) {
    return "";
  }

  const kbContext = await buildKnowledgeContext(userId, agent.knowledgeBaseIds, message);

  const fallbackEmail = (agent.fallbackEmail as string | null) ?? null;

  const personaParts: string[] = [
    agent.description
      ? `Your role and personality: ${agent.description}.`
      : "You should sound like a warm, friendly human support agent.",
  ].filter(Boolean) as string[];

  const systemPrompt = [
    personaParts.join(" "),
    "You are a dedicated customer support agent for a business using Verxio.",
    "You must answer ONLY using the provided support knowledge base context when available.",
    "Do NOT introduce yourself, do NOT say hello, and do NOT repeat your name in replies. Start directly with the answer UNLESS the user asks you to introduce yourself.",
    "If the knowledge base does not contain a clear answer, you MUST say you are not sure and ask the user to contact support via email.",
    fallbackEmail
      ? `When you cannot answer confidently, say something like: \"I'm not certain about that. Please email us at ${fallbackEmail} and our team will get back to you.\"`
      : "When you cannot answer confidently, ask the user to contact support via email and say that a human agent will respond.",
    'Keep responses concise, friendly, and focused on helping the user, using first-person language ("I") and a conversational tone.',
    "Only when the user has clearly indicated they have no further questions (e.g. they said no, that's all, I'm good, or similar in response to you asking if there's anything else you can help with), you may briefly ask for a rating. For example: \"If you have a moment, would you mind rating your experience with me from 1–5 stars? I'd love to hear how I could improve my service for you!\" Then end your reply with exactly a single line: [SUGGEST_RATING]. Do NOT ask for a rating or add [SUGGEST_RATING] in any other situation—only after the user has said they have no more questions. The [SUGGEST_RATING] line will not be shown to the user.",
  ].join(" ");

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
  if (!apiKey) {
    throw new Error("Gemini API key is not configured");
  }

  const google = createGoogleGenerativeAI({
    apiKey,
  });

  const prompt = `${systemPrompt}${kbContext}\n\nConversation so far:\n\nUser: ${message}\n\nSupport:`;

  const result = await generateText({
    model: google("gemini-3.1-flash-lite-preview"),
    prompt,
  });

  let text = result.text;

  const suggestRating = text.includes("[SUGGEST_RATING]");
  if (suggestRating) {
    await updateSessionSuggestRating(sessionId, true);
    text = text.replace("[SUGGEST_RATING]", "").trim();
  }

  const hadFallback = isFallbackReply(text, fallbackEmail);

  await appendSupportChatMessages(
    sessionId,
    {
      content: message,
    },
    {
      content: text,
      hadFallbackReply: hadFallback,
    }
  );

  return text;
}
