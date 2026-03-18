/**
 * SDR Channel Service
 *
 * Handles SDR (Sales Development Representative) mode for support agents.
 * Uses Claude via Verxio for superior reasoning. User-defined funnel rules,
 * campaign context, skills, and optional soul/personality.
 */

import { PROMPT_INJECTION_SECURITY_PREAMBLE } from "./agent/promptInjectionDefense";
import { generateTextWithSystemPrompt } from "./agent/agentService";
import { getSupportAgent } from "./supportAgentService";
import {
  appendSupportChatMessages,
  getOrCreateSupportChatSession,
  getSupportChatMessages,
  updateSessionSuggestRating,
  getSessionFeedback,
  updateSessionFeedbackById,
} from "./supportChatSessionService";
import { basePrismaClient } from "../lib/prisma";

const prisma = basePrismaClient as any;

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

export interface RespondToSdrMessageOptions {
  supportAgentId: string;
  sessionIdentifier: string;
  message: string;
}

/**
 * Load skills content for the agent by skill IDs.
 */
async function loadSkillsContent(userId: string, skillIds: string[]): Promise<string> {
  if (!skillIds || skillIds.length === 0) return "";

  const skills = await prisma.userSkill.findMany({
    where: {
      id: { in: skillIds },
      userId,
    },
    select: { name: true, content: true },
  });

  if (!skills.length) return "";

  const combined = skills
    .map(
      (s: { name: string; content: string | null }) =>
        `### ${s.name}\n${(s.content || "").slice(0, 8000)}`
    )
    .join("\n\n---\n\n");

  return `\n\n[Skills - use for nuanced replies, objections, qualification]\n${combined}\n\n[End of Skills]\n`;
}

/**
 * Build funnel rules section for the system prompt.
 * Supports: array of rules, { rules: [...] }, or { triggers, responses } (mapped).
 */
function buildFunnelRulesSection(funnelRules: unknown): string {
  if (!funnelRules || typeof funnelRules !== "object") return "";

  const rulesList: string[] = [];
  const raw = funnelRules as Record<string, unknown>;

  function addRule(triggers: string[], summary: string, assetUrl?: string, assetLabel?: string) {
    if (!triggers.length || !summary) return;
    rulesList.push(
      `- Triggers: ${triggers.join(", ")}. Response: "${summary}". ${assetUrl ? `Include link: ${assetUrl} (label: "${assetLabel || "Download here"}")` : ""}`
    );
  }

  if (Array.isArray(raw)) {
    for (const rule of raw as Array<Record<string, unknown>>) {
      const triggers = (rule.triggers as string[]) || [];
      addRule(
        triggers,
        (rule.summary as string) || "",
        (rule.assetUrl as string) || undefined,
        (rule.assetLabel as string) || undefined
      );
    }
  } else if (Array.isArray(raw.rules)) {
    for (const rule of raw.rules as Array<Record<string, unknown>>) {
      const triggers = (rule.triggers as string[]) || [];
      addRule(
        triggers,
        (rule.summary as string) || "",
        (rule.assetUrl as string) || undefined,
        (rule.assetLabel as string) || undefined
      );
    }
  } else if (raw.triggers && raw.responses && typeof raw.responses === "object") {
    const triggers = raw.triggers as string[];
    const responses = raw.responses as Record<
      string,
      { summary?: string; assetUrl?: string; assetLabel?: string }
    >;
    for (const key of triggers) {
      const resp = responses[key];
      if (resp?.summary) {
        addRule([key], resp.summary, resp.assetUrl, resp.assetLabel);
      }
    }
  } else if (raw.triggers && raw.summary) {
    addRule(
      raw.triggers as string[],
      raw.summary as string,
      (raw.assetUrl as string) || undefined,
      (raw.assetLabel as string) || undefined
    );
  }

  if (!rulesList.length) return "";

  return `
## Funnel Rules (follow exactly)
${rulesList.join("\n")}

When the user message matches a trigger, respond with the defined summary and link. Do not ask follow-up questions. Deliver and stop.
When the user is vague or says "I don't know", give a summary advice/tip from the campaign context. Do not ask them to clarify.
Read and respond only to what they said. No extra questions after delivering.
`.trim();
}

/**
 * Respond to an SDR channel message using Verxio (Claude).
 */
export async function respondToSdrMessage(options: RespondToSdrMessageOptions): Promise<string> {
  const { supportAgentId, sessionIdentifier, message } = options;

  const agent = await getSupportAgent(supportAgentId);
  if (!agent || agent.status !== "active") {
    throw new Error("Support agent not found or inactive");
  }

  const userId = agent.userId as string;

  const { id: sessionId } = await getOrCreateSupportChatSession(agent.id, sessionIdentifier);

  const feedbackState = await getSessionFeedback(agent.id, sessionIdentifier).catch(() => ({
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
    await updateSessionFeedbackById(sessionId, numeric);
    await updateSessionSuggestRating(sessionId, false);

    const replyText =
      "Thank you for your feedback. I really appreciate your rating. If you need anything else, just let me know.";

    await appendSupportChatMessages(
      sessionId,
      { content: message },
      { content: replyText, hadFallbackReply: false }
    );

    return replyText;
  }

  if (feedbackState.rating != null && isClosingMessage(trimmed)) {
    return "";
  }

  const history = await getSupportChatMessages(agent.id, sessionIdentifier, 20);
  const conversationText =
    history.length > 0
      ? history.map((m) => `${m.role === "user" ? "User" : "Support"}: ${m.content}`).join("\n\n")
      : "";

  const kbContext = await buildKnowledgeContext(userId, agent.knowledgeBaseIds, message);
  const skillsContent = await loadSkillsContent(userId, (agent.skillIds as string[]) || []);

  const agentName = (agent.name as string) || "";
  const campaignContext = (agent.campaignContext as string) || "";
  const funnelRules = agent.funnelRules;
  const soulMd = (agent.soulMd as string) || "";
  const description = (agent.description as string) || "";

  const funnelSection = buildFunnelRulesSection(funnelRules);

  const systemParts = [
    PROMPT_INJECTION_SECURITY_PREAMBLE,
    "Never use em dashes. Use commas, periods, or semicolons instead.",
    `You are "${agentName}". You represent this brand as an SDR (Sales Development Representative).`,
    description ? `Your role: ${description}.` : "",
    soulMd ? `\n## Your Personality\n${soulMd}\n` : "",
    'Avoid "AI-like" filler. Do not start with phrases like "Great question", "Absolutely", "Sure!", or "I\'d be happy to help". Start directly with the substance.',
    "Never say or imply you are an AI, a model, or an assistant. You are a human SDR representing the brand.",
    campaignContext
      ? `\n## Campaign / Post Context\n${campaignContext}\n\nUse this to personalize responses and when the user is vague, give a summary advice/tip from this context.`
      : "",
    funnelSection,
    "Do not ask follow-up questions after delivering content. Respond only to what they said.",
    "Keep responses concise. No spam. One focused reply.",
  ].filter(Boolean);

  const systemPrompt = systemParts.join("\n\n");
  const userPrompt = conversationText
    ? `Conversation so far:\n\n${conversationText}\n\nUser: ${message}\n\nSupport:`
    : `User: ${message}\n\nSupport:`;

  const contextWithKb = kbContext ? `\n\n${kbContext}` : "";
  const fullSystemPrompt =
    systemPrompt + contextWithKb + (skillsContent ? `\n\n${skillsContent}` : "");

  const { text } = await generateTextWithSystemPrompt({
    systemPrompt: fullSystemPrompt,
    userPrompt,
  });

  let replyText = (text || "").trim();
  if (!replyText) replyText = "I'm here to help. What can I do for you?";

  const suggestRating = replyText.includes("[SUGGEST_RATING]");
  if (suggestRating) {
    await updateSessionSuggestRating(sessionId, true);
    replyText = replyText.replace(/\[SUGGEST_RATING\]/g, "").trim();
  }

  await appendSupportChatMessages(
    sessionId,
    { content: message },
    { content: replyText, hadFallbackReply: false }
  );

  return replyText;
}
