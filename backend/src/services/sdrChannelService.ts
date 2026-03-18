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
  appendSupportAssistantMessage,
  getOrCreateSupportChatSession,
  getSessionFlowStateById,
  getSupportChatMessages,
  updateSessionFlowStateById,
  updateSessionSuggestRating,
  getSessionFeedback,
  updateSessionFeedbackById,
} from "./supportChatSessionService";
import { basePrismaClient } from "../lib/prisma";
import { getOrCreateWhatsAppSessionForSupportChannel } from "./supportChannelService";
import { sendWhatsAppMessage } from "./whatsappConnectorClient";

const prisma = basePrismaClient as any;

type DeterministicFunnelRule = {
  key: string;
  triggers: string[];
  questionsEnabled?: boolean;
  autoWriteDeliveryMessage?: boolean;
  question1?: string;
  question2?: string;
  summary?: string;
  assetUrl?: string;
  assetLabel?: string;
  maxAgentReplies?: number;
  answerOptionsQ1?: string[];
  answerOptionsQ2?: string[];
  derailMessage?: string;
  followUpEnabled?: boolean;
  followUps?: Array<{
    message: string;
    delayMinutes?: number;
    sendAt?: string;
    ctaUrl?: string;
  }>;
};

type FlowStep = "idle" | "q1_asked" | "q2_asked" | "completed";

type SdrFlowState = {
  activeRuleKey?: string | null;
  step?: FlowStep;
  answer1?: string | null;
  answer2?: string | null;
  repliesSent?: number;
  followUpVersion?: number;
  followUpSentCount?: number;
  updatedAt?: string;
};

const followUpTimers = new Map<string, NodeJS.Timeout>();

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

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim().toLowerCase();
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => vars[key] ?? "");
}

function toDeterministicRules(funnelRules: unknown): DeterministicFunnelRule[] {
  if (!funnelRules || typeof funnelRules !== "object") return [];
  const raw = funnelRules as Record<string, unknown>;
  const source = Array.isArray(raw.rules) ? raw.rules : Array.isArray(raw) ? raw : [];
  if (!Array.isArray(source)) return [];

  return source
    .map((item) => item as Record<string, unknown>)
    .map((r, idx) => ({
      key: typeof r.id === "string" && r.id.trim() ? r.id.trim() : `rule-${idx + 1}`,
      triggers: Array.isArray(r.triggers)
        ? (r.triggers as string[]).map((t) => String(t || "").trim()).filter(Boolean)
        : [],
      questionsEnabled:
        r.questionsEnabled === true ||
        (typeof r.question1 === "string" && r.question1.trim().length > 0) ||
        (typeof r.question2 === "string" && r.question2.trim().length > 0),
      autoWriteDeliveryMessage: r.autoWriteDeliveryMessage === true,
      question1: typeof r.question1 === "string" ? r.question1.trim() : undefined,
      question2: typeof r.question2 === "string" ? r.question2.trim() : undefined,
      summary: typeof r.summary === "string" ? r.summary.trim() : undefined,
      assetUrl: typeof r.assetUrl === "string" ? r.assetUrl.trim() : undefined,
      assetLabel: typeof r.assetLabel === "string" ? r.assetLabel.trim() : undefined,
      maxAgentReplies:
        typeof r.maxAgentReplies === "number" && Number.isFinite(r.maxAgentReplies)
          ? Math.max(1, Math.floor(r.maxAgentReplies))
          : undefined,
      answerOptionsQ1: Array.isArray(r.answerOptionsQ1)
        ? (r.answerOptionsQ1 as string[]).map((t) => String(t || "").trim()).filter(Boolean)
        : [],
      answerOptionsQ2: Array.isArray(r.answerOptionsQ2)
        ? (r.answerOptionsQ2 as string[]).map((t) => String(t || "").trim()).filter(Boolean)
        : [],
      derailMessage: typeof r.derailMessage === "string" ? r.derailMessage.trim() : undefined,
      followUpEnabled: r.followUpEnabled === true,
      followUps: (() => {
        const items = Array.isArray(r.followUps) ? (r.followUps as Array<Record<string, unknown>>) : [];
        const normalized = items
          .map((f) => ({
            message: typeof f.message === "string" ? f.message.trim() : "",
            delayMinutes:
              typeof f.delayMinutes === "number" && Number.isFinite(f.delayMinutes)
                ? Math.max(1, Math.floor(f.delayMinutes))
                : 30,
            sendAt: typeof f.sendAt === "string" ? f.sendAt.trim() : "",
            ctaUrl: typeof f.ctaUrl === "string" ? f.ctaUrl.trim() : "",
          }))
          .filter((f) => !!f.message);
        if (normalized.length > 0) return normalized;

        // Backward compatibility with legacy single follow-up fields.
        const legacyMessage =
          typeof r.followUpMessage === "string" ? (r.followUpMessage as string).trim() : "";
        if (!legacyMessage) return [];
        const legacyDelay =
          typeof r.followUpDelayMinutes === "number" && Number.isFinite(r.followUpDelayMinutes)
            ? Math.max(1, Math.floor(r.followUpDelayMinutes as number))
            : 30;
        return [{ message: legacyMessage, delayMinutes: legacyDelay, sendAt: "" }];
      })(),
    }))
    .filter((r) => r.triggers.length > 0 && (!!r.summary || !!r.assetUrl));
}

function buildFinalCtaText(
  rule: DeterministicFunnelRule,
  answer1: string,
  answer2: string,
  context?: { campaignContext?: string }
): string {
  const summary = renderTemplate(rule.summary || "", { answer1, answer2 }).trim();
  const url = (rule.assetUrl || "").trim();
  const label = (rule.assetLabel || "View details").trim();
  if (!url) return summary;
  if (summary) return `${summary}\n\n${label}: ${url}`.trim();

  // Keyword-only (no summary): keep it clean and consistent.
  const safeLabel = label || "resource";
  return `Here is the ${safeLabel}:\n${url}`.trim();
}

async function buildKeywordDeliveryMessage(params: {
  agentName: string;
  campaignContext: string;
  assetLabel: string;
  assetUrl: string;
}): Promise<string> {
  const { agentName, campaignContext, assetLabel, assetUrl } = params;
  const safeLabel = (assetLabel || "resource").trim();
  const safeUrl = (assetUrl || "").trim();

  const systemPrompt = [
    PROMPT_INJECTION_SECURITY_PREAMBLE,
    `You are "${agentName || "an SDR"}".`,
    "Write a short delivery message for a requested resource.",
    "Constraints:",
    "- 1–2 short sentences max",
    "- No emojis",
    "- No em dashes",
    "- No filler like 'Great question' or 'Absolutely'",
    "- Do not mention being an AI",
    "- Do not include the URL in the message",
    `Resource name: ${safeLabel}`,
  ].join("\n");

  const userPrompt = campaignContext
    ? `Campaign context:\n${campaignContext}`
    : "No campaign context. Keep it generic but confident.";

  try {
    const { text } = await generateTextWithSystemPrompt({ systemPrompt, userPrompt });
    const intro = (text || "").trim().replace(/\s+/g, " ");
    if (intro) return `${intro}\n\n${safeUrl}`.trim();
  } catch {
    // fall back
  }

  return `Here is the ${safeLabel}:\n${safeUrl}`.trim();
}

function normalizeFlowState(raw: unknown): SdrFlowState {
  if (!raw || typeof raw !== "object") {
    return {
      activeRuleKey: null,
      step: "idle",
      answer1: null,
      answer2: null,
      repliesSent: 0,
      followUpVersion: 0,
      followUpSentCount: 0,
      updatedAt: new Date().toISOString(),
    };
  }
  const s = raw as Record<string, unknown>;
  return {
    activeRuleKey:
      typeof s.activeRuleKey === "string" && s.activeRuleKey.trim() ? s.activeRuleKey : null,
    step:
      s.step === "q1_asked" || s.step === "q2_asked" || s.step === "completed"
        ? (s.step as FlowStep)
        : "idle",
    answer1: typeof s.answer1 === "string" ? s.answer1 : null,
    answer2: typeof s.answer2 === "string" ? s.answer2 : null,
    repliesSent:
      typeof s.repliesSent === "number" && Number.isFinite(s.repliesSent)
        ? Math.max(0, Math.floor(s.repliesSent))
        : 0,
    followUpVersion:
      typeof s.followUpVersion === "number" && Number.isFinite(s.followUpVersion)
        ? Math.max(0, Math.floor(s.followUpVersion))
        : 0,
    followUpSentCount:
      typeof s.followUpSentCount === "number" && Number.isFinite(s.followUpSentCount)
        ? Math.max(0, Math.floor(s.followUpSentCount))
        : 0,
    updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : new Date().toISOString(),
  };
}

function normalizeReplyText(text: string): string {
  return text.trim();
}

function matchesOneOfOptions(message: string, options: string[] | undefined): boolean {
  if (!options || options.length === 0) return true;
  const normalized = normalizeText(message);
  return options.some((opt) => {
    const candidate = normalizeText(opt);
    return !!candidate && (normalized === candidate || normalized.includes(candidate));
  });
}

function buildDerailReply(
  question: string,
  options: string[] | undefined,
  derailMessage?: string
): string {
  const list = options && options.length > 0 ? `\n\nYou can reply with: ${options.join(", ")}` : "";
  return (
    derailMessage ||
    `Let's keep this focused so I can give you the best next step.\n\n${question}${list}`
  ).trim();
}

function cancelFollowUpTimer(conversationKey: string): void {
  const timer = followUpTimers.get(conversationKey);
  if (timer) {
    clearTimeout(timer);
    followUpTimers.delete(conversationKey);
  }
}

function buildFollowUpText(
  followUp: { message: string; ctaUrl?: string }
): string {
  const message = followUp.message.trim();
  const ctaUrl = (followUp.ctaUrl || "").trim();
  const withCta = ctaUrl ? `${message}\n\nView details: ${ctaUrl}` : message;
  return normalizeReplyText(withCta);
}

function keywordMatched(message: string, triggers: string[]): boolean {
  const incoming = normalizeText(message);
  return triggers.some((t) => {
    const k = normalizeText(t);
    return !!k && (incoming === k || incoming.includes(k));
  });
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

async function dispatchFollowUpToChannel(
  supportAgentId: string,
  sessionIdentifier: string,
  text: string
): Promise<boolean> {
  const contact = await prisma.supportContact.findFirst({
    where: {
      supportAgentId,
      externalId: sessionIdentifier,
    },
    include: {
      supportChannel: {
        select: {
          id: true,
          platform: true,
          status: true,
          telegramBotToken: true,
        },
      },
    },
  });

  if (!contact || !contact.supportChannel || contact.supportChannel.status !== "connected") {
    return false;
  }

  const platform = String(contact.platform || "").toUpperCase();
  if (platform === "WHATSAPP") {
    const meta = (contact.metadata || {}) as Record<string, unknown>;
    const metaJid = typeof meta.whatsappRemoteJid === "string" ? meta.whatsappRemoteJid.trim() : "";
    const toJid = metaJid || sessionIdentifier;
    if (!toJid || !toJid.includes("@")) return false;

    const waSession = await getOrCreateWhatsAppSessionForSupportChannel(contact.supportChannel.id);
    const sent = await sendWhatsAppMessage({
      sessionRef: waSession.id,
      toJid,
      text,
    });
    return sent.success === true;
  }

  if (platform === "TELEGRAM") {
    const botToken = String(contact.supportChannel.telegramBotToken || "");
    if (!botToken) return false;
    const meta = (contact.metadata || {}) as Record<string, unknown>;
    const chatId =
      (typeof meta.telegramChatId === "string" && meta.telegramChatId.trim()) || sessionIdentifier;
    if (!chatId) return false;
    await sendTelegramMessage(botToken, chatId, text);
    return true;
  }

  return false;
}

async function scheduleFollowUpIfNeeded(params: {
  supportAgentId: string;
  sessionIdentifier: string;
  supportChatSessionId: string;
  flowState: SdrFlowState;
  rule: DeterministicFunnelRule;
}): Promise<void> {
  const { supportAgentId, sessionIdentifier, supportChatSessionId, flowState, rule } = params;
  if (!rule.followUpEnabled) return;
  const followUps = (rule.followUps || []).filter((f) => !!(f.message || "").trim());
  if (followUps.length === 0) return;
  const cap = followUps.length;
  if ((flowState.followUpSentCount || 0) >= cap) {
    return;
  }

  const conversationKey = `${supportAgentId}:${sessionIdentifier}`;
  cancelFollowUpTimer(conversationKey);

  const expectedVersion = flowState.followUpVersion || 0;
  const expectedRule = rule.key;
  const scheduleOne = (index: number) => {
    const next = followUps[index];
    if (!next) return;
    const timeoutMs = (() => {
      const rawSendAt = (next.sendAt || "").trim();
      if (rawSendAt) {
        const target = new Date(rawSendAt);
        const diff = target.getTime() - Date.now();
        if (Number.isFinite(diff)) {
          return Math.min(Math.max(1000, diff), 7 * 24 * 60 * 60 * 1000);
        }
      }
      const delayMinutes = Math.max(1, Math.floor(next.delayMinutes || 30));
      return Math.min(delayMinutes * 60 * 1000, 7 * 24 * 60 * 60 * 1000);
    })();
    const timer = setTimeout(async () => {
    try {
      const persistedRaw = await getSessionFlowStateById(supportChatSessionId);
      const persisted = normalizeFlowState(persistedRaw);
      if ((persisted.followUpVersion || 0) !== expectedVersion) return;
      if ((persisted.activeRuleKey || "") !== expectedRule) return;
      const persistedSent = persisted.followUpSentCount || 0;
      if (persistedSent >= cap) {
        return;
      }

      const nextFollowUp = followUps[persistedSent];
      if (!nextFollowUp) return;
      const followUpText = buildFollowUpText(nextFollowUp);
      const sent = await dispatchFollowUpToChannel(supportAgentId, sessionIdentifier, followUpText);
      if (!sent) return;

      await appendSupportAssistantMessage(supportChatSessionId, {
        content: followUpText,
        hadFallbackReply: false,
      });

      const nextState: SdrFlowState = {
        ...persisted,
        followUpSentCount: persistedSent + 1,
        updatedAt: new Date().toISOString(),
      };
      await updateSessionFlowStateById(supportChatSessionId, nextState as Record<string, unknown>);

      // Chain the next follow-up automatically while staying version-safe.
      if (persistedSent + 1 < cap) {
        scheduleOne(persistedSent + 1);
      }
    } catch {
      // best-effort; never break main message flow
    } finally {
      // Keep entry only when another follow-up was scheduled.
      const active = followUpTimers.get(conversationKey);
      if (active === timer) {
        followUpTimers.delete(conversationKey);
      }
    }
    }, timeoutMs);
    followUpTimers.set(conversationKey, timer);
  };

  scheduleOne(flowState.followUpSentCount || 0);
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
  const deterministicRules = toDeterministicRules(agent.funnelRules);
  const conversationKey = `${agent.id}:${sessionIdentifier}`;
  let flowState = normalizeFlowState(await getSessionFlowStateById(sessionId));
  cancelFollowUpTimer(conversationKey);
  flowState.followUpVersion = (flowState.followUpVersion || 0) + 1;
  flowState.updatedAt = new Date().toISOString();

  if (deterministicRules.length > 0) {
    const activeRule =
      flowState.activeRuleKey && flowState.step !== "idle"
        ? deterministicRules.find((r) => r.key === flowState.activeRuleKey) || null
        : null;

    if (activeRule && flowState.step !== "completed") {
      const cap = activeRule.maxAgentReplies || 3;
      if ((flowState.repliesSent || 0) >= cap) {
        flowState = {
          ...flowState,
          activeRuleKey: null,
          step: "completed",
          updatedAt: new Date().toISOString(),
        };
        await updateSessionFlowStateById(sessionId, flowState as Record<string, unknown>);
        return "";
      }

      if (flowState.step === "q1_asked") {
        const q1 = (activeRule.question1 || "").trim();
        const options = activeRule.answerOptionsQ1 || [];
        if (!matchesOneOfOptions(message, options)) {
          const recovery = buildDerailReply(q1, options, activeRule.derailMessage);
          const reply = normalizeReplyText(recovery);
          flowState = {
            ...flowState,
            repliesSent: (flowState.repliesSent || 0) + 1,
            updatedAt: new Date().toISOString(),
          };
          await appendSupportChatMessages(
            sessionId,
            { content: message },
            { content: reply, hadFallbackReply: false }
          );
          await updateSessionFlowStateById(sessionId, flowState as Record<string, unknown>);
          await scheduleFollowUpIfNeeded({
            supportAgentId: agent.id,
            sessionIdentifier,
            supportChatSessionId: sessionId,
            flowState,
            rule: activeRule,
          });
          return reply;
        }

        const answer1 = message.trim();
        const q2 = renderTemplate(activeRule.question2 || "", { answer1 }).trim();
        if (q2) {
          const reply = normalizeReplyText(q2);
          flowState = {
            ...flowState,
            answer1,
            step: "q2_asked",
            repliesSent: (flowState.repliesSent || 0) + 1,
            updatedAt: new Date().toISOString(),
          };
          await appendSupportChatMessages(
            sessionId,
            { content: message },
            { content: reply, hadFallbackReply: false }
          );
          await updateSessionFlowStateById(sessionId, flowState as Record<string, unknown>);
          await scheduleFollowUpIfNeeded({
            supportAgentId: agent.id,
            sessionIdentifier,
            supportChatSessionId: sessionId,
            flowState,
            rule: activeRule,
          });
          return reply;
        }

        const finalReply = buildFinalCtaText(activeRule, answer1, "", {
          campaignContext: (agent.campaignContext as string) || "",
        });
        if (finalReply) {
          const reply = normalizeReplyText(finalReply);
          flowState = {
            ...flowState,
            answer1,
            answer2: "",
            step: "completed",
            repliesSent: (flowState.repliesSent || 0) + 1,
            updatedAt: new Date().toISOString(),
          };
          await appendSupportChatMessages(
            sessionId,
            { content: message },
            { content: reply, hadFallbackReply: false }
          );
          await updateSessionFlowStateById(sessionId, flowState as Record<string, unknown>);
          await scheduleFollowUpIfNeeded({
            supportAgentId: agent.id,
            sessionIdentifier,
            supportChatSessionId: sessionId,
            flowState,
            rule: activeRule,
          });
          return reply;
        }
      }

      if (flowState.step === "q2_asked") {
        const options = activeRule.answerOptionsQ2 || [];
        const expectedQ2 = renderTemplate(activeRule.question2 || "", {
          answer1: flowState.answer1 || "",
        }).trim();
        if (!matchesOneOfOptions(message, options)) {
          const recovery = buildDerailReply(expectedQ2, options, activeRule.derailMessage);
          const reply = normalizeReplyText(recovery);
          flowState = {
            ...flowState,
            repliesSent: (flowState.repliesSent || 0) + 1,
            updatedAt: new Date().toISOString(),
          };
          await appendSupportChatMessages(
            sessionId,
            { content: message },
            { content: reply, hadFallbackReply: false }
          );
          await updateSessionFlowStateById(sessionId, flowState as Record<string, unknown>);
          await scheduleFollowUpIfNeeded({
            supportAgentId: agent.id,
            sessionIdentifier,
            supportChatSessionId: sessionId,
            flowState,
            rule: activeRule,
          });
          return reply;
        }

        const answer1 = flowState.answer1 || "";
        const answer2 = message.trim();
        const finalReply = buildFinalCtaText(activeRule, answer1, answer2, {
          campaignContext: (agent.campaignContext as string) || "",
        });
        if (finalReply) {
          const reply = normalizeReplyText(finalReply);
          flowState = {
            ...flowState,
            answer2,
            step: "completed",
            repliesSent: (flowState.repliesSent || 0) + 1,
            updatedAt: new Date().toISOString(),
          };
          await appendSupportChatMessages(
            sessionId,
            { content: message },
            { content: reply, hadFallbackReply: false }
          );
          await updateSessionFlowStateById(sessionId, flowState as Record<string, unknown>);
          await scheduleFollowUpIfNeeded({
            supportAgentId: agent.id,
            sessionIdentifier,
            supportChatSessionId: sessionId,
            flowState,
            rule: activeRule,
          });
          return reply;
        }
      }
    }

    const matchedRule = deterministicRules.find((rule) => keywordMatched(message, rule.triggers));
    if (matchedRule) {
      if (matchedRule.questionsEnabled !== true || !matchedRule.question1) {
        const directReply = buildFinalCtaText(matchedRule, "", "", {
          campaignContext: (agent.campaignContext as string) || "",
        });
        if (directReply) {
          const reply = normalizeReplyText(
            matchedRule.autoWriteDeliveryMessage
              ? await buildKeywordDeliveryMessage({
                  agentName: (agent.name as string) || "",
                  campaignContext: (agent.campaignContext as string) || "",
                  assetLabel: (matchedRule.assetLabel || "resource").trim(),
                  assetUrl: (matchedRule.assetUrl || "").trim(),
                })
              : directReply
          );
          flowState = {
            ...flowState,
            activeRuleKey: matchedRule.key,
            step: "completed",
            answer1: "",
            answer2: "",
            repliesSent: 1,
            followUpSentCount: 0,
            updatedAt: new Date().toISOString(),
          };
          await appendSupportChatMessages(
            sessionId,
            { content: message },
            { content: reply, hadFallbackReply: false }
          );
          await updateSessionFlowStateById(sessionId, flowState as Record<string, unknown>);
          await scheduleFollowUpIfNeeded({
            supportAgentId: agent.id,
            sessionIdentifier,
            supportChatSessionId: sessionId,
            flowState,
            rule: matchedRule,
          });
          return reply;
        }
      }

      const q1 = normalizeReplyText((matchedRule.question1 || "").trim());
      if (!q1) {
        // No deterministic question path configured, fall through to LLM behavior.
      } else {
        flowState = {
          ...flowState,
          activeRuleKey: matchedRule.key,
          step: "q1_asked",
          answer1: null,
          answer2: null,
          repliesSent: 1,
          followUpSentCount: 0,
          updatedAt: new Date().toISOString(),
        };
        await appendSupportChatMessages(
          sessionId,
          { content: message },
          { content: q1, hadFallbackReply: false }
        );
        await updateSessionFlowStateById(sessionId, flowState as Record<string, unknown>);
        await scheduleFollowUpIfNeeded({
          supportAgentId: agent.id,
          sessionIdentifier,
          supportChatSessionId: sessionId,
          flowState,
          rule: matchedRule,
        });
        return q1;
      }
    }
  }

  if (flowState.step !== "idle" || flowState.activeRuleKey) {
    flowState = {
      ...flowState,
      activeRuleKey: null,
      step: "idle",
      answer1: null,
      answer2: null,
      updatedAt: new Date().toISOString(),
    };
    await updateSessionFlowStateById(sessionId, flowState as Record<string, unknown>);
  } else if (deterministicRules.length === 0) {
    await updateSessionFlowStateById(
      sessionId,
      {
        ...flowState,
        activeRuleKey: null,
        step: "idle",
        answer1: null,
        answer2: null,
      } as Record<string, unknown>
    );
  }

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
