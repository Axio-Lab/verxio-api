/**
 * SDR Channel Service
 *
 * Handles SDR (Sales Development Representative) mode for support agents.
 * Uses Claude via Verxio for superior reasoning. User-defined funnel rules,
 * campaign context, skills, and optional soul/personality.
 */

import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
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

type FunnelBranch = {
  /** Answer keyword(s) that activate this branch (case-insensitive partial match). */
  matchKeywords: string[];
  summary?: string;
  assetUrl?: string;
  assetLabel?: string;
};

type DeterministicFunnelRule = {
  key: string;
  triggers: string[];
  questionsEnabled?: boolean;
  autoWriteDeliveryMessage?: boolean;
  /** Ordered list of questions to ask (replaces question1/question2). */
  questions?: string[];
  summary?: string;
  assetUrl?: string;
  assetLabel?: string;
  maxAgentReplies?: number;
  followUpEnabled?: boolean;
  followUps?: Array<{
    message: string;
    /** When true the message field is sent verbatim; when false the AI generates a contextual nudge using message as a topic directive. */
    useCustomMessage?: boolean;
    delayMinutes?: number;
    sendAt?: string;
    ctaUrl?: string;
  }>;
  /** Optional per-answer branches for Q1. Each answer can route to a different resource. */
  branches?: FunnelBranch[];
};

type FlowStep = "idle" | "questioning" | "completed";

type SdrFlowState = {
  activeRuleKey?: string | null;
  step?: FlowStep;
  /** Collected answers indexed by question position (answers[0] = Q1, etc.). */
  answers?: string[];
  /** Which question we asked last (0-based); user's next message is the answer to this index. */
  currentQuestionIndex?: number;
  repliesSent?: number;
  followUpVersion?: number;
  followUpSentCount?: number;
  followUpNextFireAt?: string | null;
  /** "channel" = WhatsApp/Telegram (can dispatch follow-ups). "web" = web chat (cannot). */
  sessionType?: "channel" | "web";
  /** Index of the matched branch from rule.branches, if Q1 answer matched one. */
  matchedBranchIndex?: number | null;
  updatedAt?: string;
};

const followUpTimers = new Map<string, NodeJS.Timeout>();
let followUpRecoveryInterval: NodeJS.Timeout | null = null;

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
    .map((r, idx) => {
      // Normalize questions: new format is questions[], old format is question1/question2.
      const q1Legacy = typeof r.question1 === "string" ? r.question1.trim() : "";
      const q2Legacy = typeof r.question2 === "string" ? r.question2.trim() : "";
      const questions = Array.isArray(r.questions)
        ? (r.questions as string[]).map((q) => String(q || "").trim()).filter(Boolean)
        : [q1Legacy, q2Legacy].filter(Boolean);

      return {
        key: typeof r.id === "string" && r.id.trim() ? r.id.trim() : `rule-${idx + 1}`,
        triggers: Array.isArray(r.triggers)
          ? (r.triggers as string[]).map((t) => String(t || "").trim()).filter(Boolean)
          : [],
        questionsEnabled: r.questionsEnabled === true || questions.length > 0,
        autoWriteDeliveryMessage: r.autoWriteDeliveryMessage === true,
        questions,
        summary: typeof r.summary === "string" ? r.summary.trim() : undefined,
        assetUrl: typeof r.assetUrl === "string" ? r.assetUrl.trim() : undefined,
        assetLabel: typeof r.assetLabel === "string" ? r.assetLabel.trim() : undefined,
        maxAgentReplies:
          typeof r.maxAgentReplies === "number" && Number.isFinite(r.maxAgentReplies)
            ? Math.max(1, Math.floor(r.maxAgentReplies))
            : undefined,
        branches: (() => {
          const raw = Array.isArray(r.branches) ? (r.branches as Array<Record<string, unknown>>) : [];
          return raw
            .map((b) => ({
              matchKeywords: Array.isArray(b.matchKeywords)
                ? (b.matchKeywords as string[]).map((k) => String(k || "").trim()).filter(Boolean)
                : [],
              summary: typeof b.summary === "string" ? b.summary.trim() : undefined,
              assetUrl: typeof b.assetUrl === "string" ? b.assetUrl.trim() : undefined,
              assetLabel: typeof b.assetLabel === "string" ? b.assetLabel.trim() : undefined,
            }))
            .filter((b) => b.matchKeywords.length > 0);
        })(),
        followUpEnabled: r.followUpEnabled === true,
        followUps: (() => {
          const items = Array.isArray(r.followUps) ? (r.followUps as Array<Record<string, unknown>>) : [];
          const normalized = items
            .map((f) => ({
              message: typeof f.message === "string" ? f.message.trim() : "",
              useCustomMessage: f.useCustomMessage === true,
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
      };
    })
    .filter((r) => r.triggers.length > 0 && (!!r.summary || !!r.assetUrl || (r.branches ?? []).some((b) => !!b.assetUrl || !!b.summary)));
}

function normalizeFlowState(raw: unknown): SdrFlowState {
  if (!raw || typeof raw !== "object") {
    return {
      activeRuleKey: null,
      step: "idle",
      answers: [],
      currentQuestionIndex: 0,
      repliesSent: 0,
      followUpVersion: 0,
      followUpSentCount: 0,
      followUpNextFireAt: null,
      sessionType: "web",
      updatedAt: new Date().toISOString(),
    };
  }
  const s = raw as Record<string, unknown>;

  // Migrate legacy step names to the new "questioning" step.
  let step: FlowStep = "idle";
  let currentQuestionIndex = 0;
  if (s.step === "questioning") {
    step = "questioning";
    currentQuestionIndex =
      typeof s.currentQuestionIndex === "number" && Number.isFinite(s.currentQuestionIndex)
        ? Math.max(0, Math.floor(s.currentQuestionIndex))
        : 0;
  } else if (s.step === "q1_asked") {
    step = "questioning";
    currentQuestionIndex = 0;
  } else if (s.step === "q2_asked") {
    step = "questioning";
    currentQuestionIndex = 1;
  } else if (s.step === "completed") {
    step = "completed";
  }

  // Migrate legacy answer1/answer2 fields to answers[].
  let answers: string[] = [];
  if (Array.isArray(s.answers)) {
    answers = (s.answers as unknown[]).map((a) => (typeof a === "string" ? a : ""));
  } else {
    const a1 = typeof s.answer1 === "string" ? s.answer1 : null;
    const a2 = typeof s.answer2 === "string" ? s.answer2 : null;
    if (a1 !== null) answers.push(a1);
    if (a2 !== null) answers.push(a2);
  }

  return {
    activeRuleKey:
      typeof s.activeRuleKey === "string" && s.activeRuleKey.trim() ? s.activeRuleKey : null,
    step,
    answers,
    currentQuestionIndex,
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
    followUpNextFireAt:
      typeof s.followUpNextFireAt === "string" && s.followUpNextFireAt.trim()
        ? s.followUpNextFireAt
        : null,
    sessionType: s.sessionType === "channel" ? "channel" : "web",
    matchedBranchIndex:
      typeof s.matchedBranchIndex === "number" && Number.isFinite(s.matchedBranchIndex)
        ? Math.floor(s.matchedBranchIndex)
        : null,
    updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : new Date().toISOString(),
  };
}

/** Build template variable map from an answers array: answer1, answer2, answer3 ... */
function buildTemplateVars(answers: string[], extraVars?: Record<string, string>): Record<string, string> {
  const vars: Record<string, string> = {};
  answers.forEach((a, i) => {
    vars[`answer${i + 1}`] = a;
  });
  if (extraVars) Object.assign(vars, extraVars);
  return vars;
}

function normalizeReplyText(text: string): string {
  return text.trim();
}

/**
 * Use AI to turn a raw template/directive into a natural, contextual response.
 * The template acts as an instruction ("what to say"), not the literal output.
 * Falls back to the rendered template if AI generation fails.
 */
async function agentizeResponse(params: {
  directive: string;
  agentName: string;
  campaignContext: string;
  skillsContent?: string;
  /** All collected answers so far (indexed; answers[0] = Q1, etc.). */
  answers?: string[];
  /** All questions in the funnel rule (indexed; questions[0] = Q1, etc.). */
  questions?: string[];
  /** Current question being asked or referenced (for derail prompts). */
  currentQuestion?: string;
  assetUrl?: string;
  assetLabel?: string;
  type: "question" | "cta" | "derail" | "followup";
}): Promise<string> {
  const {
    directive,
    agentName,
    campaignContext,
    skillsContent,
    answers = [],
    questions = [],
    currentQuestion,
    assetUrl,
    assetLabel,
    type,
  } = params;

  // Convenience aliases kept for prompt readability.
  // const answer1 = answers[0];
  // const answer2 = answers[1];
  const question1 = questions[0];

  const systemParts = [
    PROMPT_INJECTION_SECURITY_PREAMBLE,
    `You are "${agentName || "a senior sales rep"}". You have years of experience closing deals and talking to prospects.`,
    "You write like a real person messaging a prospect, not like a chatbot or AI assistant.",
    "",
    "STRICT TONE RULES:",
    "- Be DIRECT. Get to the point immediately. No preambles, no buildup.",
    "- No emojis. No em dashes (use commas or periods instead). No bullet points. No numbered lists.",
    '- NEVER start with "Got it", "Great", "Interesting", "That makes sense", "Here\'s what", "I see", "Understood", "So basically", "Sounds like", or any acknowledgment filler.',
    "- NEVER over-explain or analyze what the user said back to them. They know what they said.",
    "- NEVER use phrases like \"here's what that usually means\", \"what I'm hearing is\", \"in my experience\", \"let me break that down\".",
    "- Short, punchy sentences. Like a message from someone who's done this 1000 times.",
    "- Do not mention being an AI, model, or assistant. You are a human.",
    "- If you have skills/expertise, weave specific knowledge in naturally. Do not lecture.",
    "",
    "STRICT FORMATTING RULES:",
    "- Each sentence or thought gets its own line. Use a blank line between separate points.",
    "- Never cram multiple ideas into one wall of text.",
    "- Maximum 3-4 sentences total. Break them up for readability.",
    "- If you include a link, it MUST be on its own line, prefixed with 'Get it here:' or a short label that fits naturally.",
  ];

  if (type === "question") {
    systemParts.push(
      "",
      "YOUR TASK: Ask a follow-up question.",
      "- Jump straight into the question. No recap of what they said.",
      "- One question only. Keep it tight.",
      "- The question must end with a question mark.",
      "- Put the question on its own line if you have a preceding sentence."
    );
  } else if (type === "cta") {
    systemParts.push(
      "",
      "YOUR TASK: Deliver a resource/link.",
      "- 1-2 sentences connecting their situation to why this resource fits.",
      "- Then on a NEW LINE, write a short label followed by the link.",
      "- Do not over-sell or hype it up. Just tell them what it is and why it fits.",
      "- Format: [short label]: [url] — the link must be alone on its own line."
    );
    if (assetUrl) {
      systemParts.push(`- You MUST include this EXACT link on its own line: ${assetUrl}`);
    }
    if (assetLabel) {
      systemParts.push(`- Resource name: ${assetLabel}`);
    }
  } else if (type === "derail") {
    systemParts.push(
      "",
      "YOUR TASK: Redirect back to the question.",
      "- If they asked something valid, give a one-line answer, then steer back.",
      "- If they are confused, simplify and re-ask.",
      "- Keep it to 2 lines max. Each on its own line."
    );
    const questionToReask = currentQuestion || question1;
    if (questionToReask) {
      systemParts.push(`- Re-ask this: "${questionToReask}"`);
    }
  } else if (type === "followup") {
    systemParts.push(
      "",
      "YOUR TASK: Send a follow-up nudge.",
      "- Short and casual. Like checking back in.",
      "- You can drop a quick tip if relevant. No pressure.",
      "- 2 sentences max. Each on its own line."
    );
  }

  if (skillsContent) {
    systemParts.push(
      "",
      "## Your domain knowledge (use naturally, do not lecture):",
      skillsContent
    );
  }

  const contextParts = [`Directive/template: ${directive}`];
  answers.forEach((a, i) => {
    if (a) contextParts.push(`User's answer to question ${i + 1}: "${a}"`);
  });
  questions.forEach((q, i) => {
    if (q) contextParts.push(`Question ${i + 1} was: "${q}"`);
  });
  if (campaignContext) contextParts.push(`Campaign context:\n${campaignContext}`);

  try {
    const { text } = await generateTextWithSystemPrompt({
      systemPrompt: systemParts.join("\n"),
      userPrompt: contextParts.join("\n"),
    });
    const result = (text || "").trim();
    if (result) return result;
  } catch {
    // fall back to rendered template
  }

  return directive;
}

function matchesOneOfOptions(message: string, options: string[] | undefined): boolean {
  if (!options || options.length === 0) return true;
  const normalized = normalizeText(message);
  return options.some((opt) => {
    const candidate = normalizeText(opt);
    return !!candidate && (normalized === candidate || normalized.includes(candidate));
  });
}

/**
 * Ask the AI whether a message is genuinely answering the current question
 * or is completely off-topic / a side question.
 * Returns true if the message is a valid/relevant answer (including partial, short, or indirect ones).
 * Returns false only if it's clearly unrelated and should trigger a gentle re-ask.
 */
async function isRelevantAnswer(
  message: string,
  currentQuestion: string,
  context?: { questions?: string[]; answers?: string[] }
): Promise<boolean> {
  try {
    const contextLines: string[] = [];
    if (context?.questions && context.questions.length > 0) {
      context.questions.forEach((q, i) => {
        if (q) contextLines.push(`Q${i + 1}: ${q}`);
        if (context.answers?.[i]) contextLines.push(`A${i + 1}: ${context.answers[i]}`);
      });
    }

    const systemPrompt = [
      PROMPT_INJECTION_SECURITY_PREAMBLE,
      "You are a relevance classifier for a sales conversation.",
      "Your only job: decide if the user's message is a reasonable attempt to answer the question asked, OR is completely off-topic.",
      "Be generous. Short answers, indirect answers, tangential comments that still relate to the topic — all count as relevant.",
      "Only return false if the message has absolutely nothing to do with the question (e.g. asking about weather, a random URL, unrelated spam).",
      "Output ONLY: true or false. No explanation. No other text.",
    ].join("\n");

    const userPrompt = [
      contextLines.length > 0 ? `Prior conversation:\n${contextLines.join("\n")}\n` : "",
      `Current question asked: "${currentQuestion}"`,
      `User's message: "${message}"`,
      "",
      "Is this message a relevant answer to the question? Reply true or false.",
    ]
      .filter(Boolean)
      .join("\n");

    const { text } = await generateTextWithSystemPrompt({ systemPrompt, userPrompt });
    return (text || "").trim().toLowerCase() !== "false";
  } catch {
    // If classification fails, assume it's relevant and let the funnel proceed.
    return true;
  }
}

/**
 * Use AI to determine which branch best fits the user's final answer.
 * The model reads the answer + branch keywords in context and returns the branch index (0-based),
 * or -1 if no branch is a good fit. Falls back to literal keyword matching on failure.
 */
async function matchBranchIndex(
  answer: string,
  branches: FunnelBranch[] | undefined,
  context?: { questions?: string[]; answers?: string[] }
): Promise<number> {
  if (!branches || branches.length === 0) return -1;

  // Fast literal check first — if an exact / substring match exists, use it.
  const normalized = normalizeText(answer);
  const literalIdx = branches.findIndex((b) =>
    b.matchKeywords.some((k) => {
      const kn = normalizeText(k);
      return !!kn && (normalized === kn || normalized.includes(kn));
    })
  );
  if (literalIdx >= 0) return literalIdx;

  // No literal match — ask the AI to infer intent from the answer.
  try {
    const branchDescriptions = branches
      .map((b, i) => `Branch ${i}: ${b.matchKeywords.join(", ")}`)
      .join("\n");

    const contextLines: string[] = [];
    if (context?.questions && context.questions.length > 0) {
      context.questions.forEach((q, i) => {
        if (q) contextLines.push(`Q${i + 1}: ${q}`);
        if (context.answers?.[i]) contextLines.push(`A${i + 1}: ${context.answers[i]}`);
      });
    }

    const systemPrompt = [
      PROMPT_INJECTION_SECURITY_PREAMBLE,
      "You are a routing classifier. Your only job is to pick the best-matching branch index for a user's answer.",
      "Output ONLY a single integer: the 0-based branch index that best matches the user's intent.",
      "If none of the branches are a reasonable match, output -1.",
      "Do not explain. Do not add any other text. Output the integer only.",
    ].join("\n");

    const userPrompt = [
      contextLines.length > 0 ? `Conversation context:\n${contextLines.join("\n")}\n` : "",
      `User's final answer: "${answer}"`,
      "",
      "Available branches (match on meaning, not just exact words):",
      branchDescriptions,
    ]
      .filter(Boolean)
      .join("\n");

    const { text } = await generateTextWithSystemPrompt({ systemPrompt, userPrompt });
    const parsed = parseInt((text || "").trim(), 10);
    if (Number.isFinite(parsed) && parsed >= -1 && parsed < branches.length) {
      return parsed;
    }
  } catch {
    // If AI classification fails, return no match.
  }

  return -1;
}

function resolveBranchCta(
  rule: DeterministicFunnelRule,
  branchIndex: number | null | undefined
): { summary?: string; assetUrl?: string; assetLabel?: string } {
  if (branchIndex != null && branchIndex >= 0 && rule.branches && rule.branches[branchIndex]) {
    const b = rule.branches[branchIndex];
    return {
      summary: b.summary ?? rule.summary,
      assetUrl: b.assetUrl ?? rule.assetUrl,
      assetLabel: b.assetLabel ?? rule.assetLabel,
    };
  }
  return { summary: rule.summary, assetUrl: rule.assetUrl, assetLabel: rule.assetLabel };
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

function computeFollowUpFireTime(followUp: { delayMinutes?: number; sendAt?: string }): Date {
  const rawSendAt = (followUp.sendAt || "").trim();
  if (rawSendAt) {
    const target = new Date(rawSendAt);
    if (!isNaN(target.getTime())) {
      const clampedMs = Math.min(Math.max(1000, target.getTime() - Date.now()), 7 * 24 * 60 * 60 * 1000);
      return new Date(Date.now() + clampedMs);
    }
  }
  const delayMinutes = Math.max(1, Math.floor(followUp.delayMinutes || 30));
  const ms = Math.min(delayMinutes * 60 * 1000, 7 * 24 * 60 * 60 * 1000);
  return new Date(Date.now() + ms);
}

async function executeFollowUp(params: {
  supportAgentId: string;
  sessionIdentifier: string;
  supportChatSessionId: string;
  expectedVersion: number;
  expectedRuleKey: string;
}): Promise<void> {
  const { supportAgentId, sessionIdentifier, supportChatSessionId, expectedVersion, expectedRuleKey } = params;

  const persistedRaw = await getSessionFlowStateById(supportChatSessionId);
  const persisted = normalizeFlowState(persistedRaw);
  if ((persisted.followUpVersion || 0) !== expectedVersion) return;
  if ((persisted.activeRuleKey || "") !== expectedRuleKey) return;

  const agent = await getSupportAgent(supportAgentId);
  if (!agent || agent.status !== "active") return;

  const deterministicRules = toDeterministicRules(agent.funnelRules);
  const rule = deterministicRules.find((r) => r.key === expectedRuleKey);
  if (!rule || !rule.followUpEnabled) return;

  const followUps = (rule.followUps || []).filter((f) => !!(f.message || "").trim());
  const cap = followUps.length;
  const persistedSent = persisted.followUpSentCount || 0;
  if (persistedSent >= cap) return;

  const nextFollowUp = followUps[persistedSent];
  if (!nextFollowUp) return;

  const userId = agent.userId as string;
  const agName = (agent.name as string) || "";
  const agCampaign = (agent.campaignContext as string) || "";
  const skills = await loadSkillsContent(userId, (agent.skillIds as string[]) || []);

  // useCustomMessage = true  → send verbatim (what you wrote is what gets sent).
  // useCustomMessage = false → treat message as topic directive; AI generates contextual nudge.
  let followUpText: string;
  if (nextFollowUp.useCustomMessage) {
    followUpText = buildFollowUpText(nextFollowUp);
  } else {
    const rawText = buildFollowUpText(nextFollowUp);
    followUpText = await agentizeResponse({
      directive: rawText,
      agentName: agName,
      campaignContext: agCampaign,
      skillsContent: skills || undefined,
      answers: persisted.answers ?? [],
      assetUrl: nextFollowUp.ctaUrl || undefined,
      type: "followup",
    });
  }

  const sent = await dispatchFollowUpToChannel(supportAgentId, sessionIdentifier, followUpText);
  if (!sent) {
    console.error(
      `[SDR follow-up] dispatch failed for session ${supportChatSessionId} (identifier: ${sessionIdentifier}). ` +
      `Check that the contact exists and the channel is still connected.`
    );
    return;
  }

  await appendSupportAssistantMessage(supportChatSessionId, {
    content: followUpText,
    hadFallbackReply: false,
  });

  const nextSent = persistedSent + 1;
  let nextFireAt: string | null = null;
  if (nextSent < cap) {
    const nextFu = followUps[nextSent];
    if (nextFu) {
      nextFireAt = computeFollowUpFireTime(nextFu).toISOString();
    }
  }

  const nextState: SdrFlowState = {
    ...persisted,
    followUpSentCount: nextSent,
    followUpNextFireAt: nextFireAt,
    updatedAt: new Date().toISOString(),
  };
  await updateSessionFlowStateById(supportChatSessionId, nextState as Record<string, unknown>);

  if (nextFireAt) {
    const conversationKey = `${supportAgentId}:${sessionIdentifier}`;
    scheduleFollowUpTimer({
      conversationKey,
      supportAgentId,
      sessionIdentifier,
      supportChatSessionId,
      expectedVersion,
      expectedRuleKey,
      fireAt: new Date(nextFireAt),
    });
  }
}

function scheduleFollowUpTimer(params: {
  conversationKey: string;
  supportAgentId: string;
  sessionIdentifier: string;
  supportChatSessionId: string;
  expectedVersion: number;
  expectedRuleKey: string;
  fireAt: Date;
}): void {
  const { conversationKey, supportAgentId, sessionIdentifier, supportChatSessionId, expectedVersion, expectedRuleKey, fireAt } = params;
  const delayMs = Math.max(1000, fireAt.getTime() - Date.now());

  cancelFollowUpTimer(conversationKey);

  const timer = setTimeout(async () => {
    followUpTimers.delete(conversationKey);
    try {
      await executeFollowUp({
        supportAgentId,
        sessionIdentifier,
        supportChatSessionId,
        expectedVersion,
        expectedRuleKey,
      });
    } catch (err) {
      console.error(`[SDR follow-up] error for session ${supportChatSessionId}:`, err);
    }
  }, delayMs);

  followUpTimers.set(conversationKey, timer);
}

async function scheduleFollowUpIfNeeded(params: {
  supportAgentId: string;
  sessionIdentifier: string;
  supportChatSessionId: string;
  flowState: SdrFlowState;
  rule: DeterministicFunnelRule;
  agentName?: string;
  campaignContext?: string;
  skillsContent?: string;
}): Promise<void> {
  const { supportAgentId, sessionIdentifier, supportChatSessionId, flowState, rule } = params;
  if (!rule.followUpEnabled) return;
  // Only dispatch follow-ups for channel sessions (WhatsApp/Telegram). Web chat has no outbound channel.
  if (flowState.sessionType !== "channel") return;
  const followUps = (rule.followUps || []).filter((f) => !!(f.message || "").trim());
  if (followUps.length === 0) return;
  const sentCount = flowState.followUpSentCount || 0;
  if (sentCount >= followUps.length) return;

  const nextFollowUp = followUps[sentCount];
  if (!nextFollowUp) return;

  const fireAt = computeFollowUpFireTime(nextFollowUp);
  const expectedVersion = flowState.followUpVersion || 0;
  const conversationKey = `${supportAgentId}:${sessionIdentifier}`;

  const updatedState: SdrFlowState = {
    ...flowState,
    followUpNextFireAt: fireAt.toISOString(),
  };
  await updateSessionFlowStateById(supportChatSessionId, updatedState as Record<string, unknown>);

  scheduleFollowUpTimer({
    conversationKey,
    supportAgentId,
    sessionIdentifier,
    supportChatSessionId,
    expectedVersion,
    expectedRuleKey: rule.key,
    fireAt,
  });
}

/**
 * Recover any follow-ups that were scheduled but lost due to server restart.
 * Queries all sessions with a pending followUpNextFireAt and re-schedules or
 * fires them immediately if overdue.
 */
export async function recoverPendingFollowUps(): Promise<void> {
  try {
    const sessions = await prisma.supportChatSession.findMany({
      where: {
        flowState: { not: null },
      },
      select: {
        id: true,
        supportAgentId: true,
        publicSessionId: true,
        flowState: true,
      },
    });

    let recovered = 0;
    for (const session of sessions) {
      const state = normalizeFlowState(session.flowState);
      if (!state.followUpNextFireAt || !state.activeRuleKey) continue;
      // Only recover channel sessions -- web chat has no outbound dispatch.
      if (state.sessionType !== "channel") continue;

      const fireAt = new Date(state.followUpNextFireAt);
      if (isNaN(fireAt.getTime())) continue;

      const conversationKey = `${session.supportAgentId}:${session.publicSessionId}`;
      if (followUpTimers.has(conversationKey)) continue;

      scheduleFollowUpTimer({
        conversationKey,
        supportAgentId: session.supportAgentId,
        sessionIdentifier: session.publicSessionId,
        supportChatSessionId: session.id,
        expectedVersion: state.followUpVersion || 0,
        expectedRuleKey: state.activeRuleKey,
        fireAt,
      });
      recovered++;
    }

    if (recovered > 0) {
      console.log(`[SDR follow-up] recovered ${recovered} pending follow-up(s)`);
    }
  } catch (err) {
    console.error("[SDR follow-up] recovery scan failed:", err);
  }
}

/**
 * Start the periodic follow-up recovery loop. Call once on server startup.
 */
export function startFollowUpRecovery(): void {
  recoverPendingFollowUps();
  if (followUpRecoveryInterval) clearInterval(followUpRecoveryInterval);
  followUpRecoveryInterval = setInterval(() => {
    recoverPendingFollowUps();
  }, 60_000);
}

export interface RespondToSdrMessageOptions {
  supportAgentId: string;
  sessionIdentifier: string;
  message: string;
  /** "channel" = WhatsApp/Telegram (follow-ups can be dispatched). Defaults to "web". */
  sessionType?: "channel" | "web";
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
  const { supportAgentId, sessionIdentifier, message, sessionType = "web" } = options;

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
    // Save the user's message even though the agent stays silent.
    await appendSupportChatMessages(
      sessionId,
      { content: message },
      { content: "", hadFallbackReply: false }
    );
    return "";
  }

  const history = await getSupportChatMessages(agent.id, sessionIdentifier, 20);
  const deterministicRules = toDeterministicRules(agent.funnelRules);
  const conversationKey = `${agent.id}:${sessionIdentifier}`;
  let flowState = normalizeFlowState(await getSessionFlowStateById(sessionId));
  cancelFollowUpTimer(conversationKey);
  flowState.followUpVersion = (flowState.followUpVersion || 0) + 1;
  flowState.followUpNextFireAt = null;
  flowState.sessionType = sessionType;
  flowState.updatedAt = new Date().toISOString();

  const skillsContent = await loadSkillsContent(userId, (agent.skillIds as string[]) || []);

  if (deterministicRules.length > 0) {
    const activeRule =
      flowState.activeRuleKey && flowState.step !== "idle"
        ? deterministicRules.find((r) => r.key === flowState.activeRuleKey) || null
        : null;

    if (activeRule && flowState.step !== "completed") {
      const cap = activeRule.maxAgentReplies || 3;
      const agName = (agent.name as string) || "";
      const agCampaign = (agent.campaignContext as string) || "";

      if ((flowState.repliesSent || 0) >= cap) {
        // Cap hit mid-funnel: mark as completed, then fall through to the LLM
        // fallback so the user can still get support answers and their message is stored.
        flowState = {
          ...flowState,
          step: "completed",
          updatedAt: new Date().toISOString(),
        };
        await updateSessionFlowStateById(sessionId, flowState as Record<string, unknown>);
        // flowState.step is now "completed", so the questioning block below is skipped.
      }

      // Generic N-question handler: fires whenever the user is in mid-funnel.
      // Branches are evaluated only on the final answer to route to the right CTA.
      if (flowState.step === "questioning") {
        const qi = flowState.currentQuestionIndex ?? 0;
        const allQuestions = activeRule.questions ?? [];
        const currentQ = renderTemplate(allQuestions[qi] || "", buildTemplateVars(flowState.answers ?? []));

        // Check if the message is relevant to the current question.
        // If it's completely off-topic, gently re-ask without advancing.
        const relevant = await isRelevantAnswer(message, currentQ, {
          questions: allQuestions,
          answers: flowState.answers ?? [],
        });
        if (!relevant) {
          const reply = normalizeReplyText(
            await agentizeResponse({
              directive: currentQ,
              agentName: agName,
              campaignContext: agCampaign,
              skillsContent,
              answers: flowState.answers ?? [],
              questions: allQuestions,
              currentQuestion: currentQ,
              type: "derail",
            })
          );
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
            agentName: agName,
            campaignContext: agCampaign,
            skillsContent,
          });
          return reply;
        }

        // Record this answer.
        const updatedAnswers = [...(flowState.answers ?? [])];
        updatedAnswers[qi] = message.trim();

        // If there is another question, ask it now.
        const nextQi = qi + 1;
        const nextQRaw = allQuestions[nextQi];
        if (nextQRaw) {
          const nextQRendered = renderTemplate(nextQRaw, buildTemplateVars(updatedAnswers));
          const reply = normalizeReplyText(
            await agentizeResponse({
              directive: nextQRendered,
              agentName: agName,
              campaignContext: agCampaign,
              skillsContent,
              answers: updatedAnswers,
              questions: allQuestions,
              type: "question",
            })
          );
          flowState = {
            ...flowState,
            answers: updatedAnswers,
            currentQuestionIndex: nextQi,
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
            agentName: agName,
            campaignContext: agCampaign,
            skillsContent,
          });
          return reply;
        }

        // All questions answered.
        // Ask the AI to read the final answer and determine the best matching branch.
        const finalAnswer = updatedAnswers[qi];
        const branchIndex = await matchBranchIndex(finalAnswer, activeRule.branches, {
          questions: allQuestions,
          answers: updatedAnswers,
        });
        const resolvedCta = resolveBranchCta(activeRule, branchIndex >= 0 ? branchIndex : null);

        const ctaVars = buildTemplateVars(updatedAnswers, {
          question1: allQuestions[0] || "",
          question2: allQuestions[1] || "",
        });
        const ctaDirective = renderTemplate(resolvedCta.summary || "", ctaVars);
        const finalReply = normalizeReplyText(
          await agentizeResponse({
            directive: ctaDirective || "Based on everything shared, deliver the most relevant resource.",
            agentName: agName,
            campaignContext: agCampaign,
            skillsContent,
            answers: updatedAnswers,
            questions: allQuestions,
            assetUrl: resolvedCta.assetUrl,
            assetLabel: resolvedCta.assetLabel,
            type: "cta",
          })
        );
        if (finalReply) {
          flowState = {
            ...flowState,
            answers: updatedAnswers,
            step: "completed",
            matchedBranchIndex: branchIndex >= 0 ? branchIndex : null,
            repliesSent: (flowState.repliesSent || 0) + 1,
            updatedAt: new Date().toISOString(),
          };
          await appendSupportChatMessages(
            sessionId,
            { content: message },
            { content: finalReply, hadFallbackReply: false }
          );
          await updateSessionFlowStateById(sessionId, flowState as Record<string, unknown>);
          await scheduleFollowUpIfNeeded({
            supportAgentId: agent.id,
            sessionIdentifier,
            supportChatSessionId: sessionId,
            flowState,
            rule: activeRule,
            agentName: agName,
            campaignContext: agCampaign,
            skillsContent,
          });
          return finalReply;
        }
      }
    }

    const matchedRule = deterministicRules.find((rule) => keywordMatched(message, rule.triggers));
    if (matchedRule) {
      // Don't re-trigger the same funnel rule if it's already in progress or completed.
      // A funnel should only start fresh from a keyword hit on a new/idle session.
      const isSameRuleAlreadyEngaged =
        flowState.activeRuleKey === matchedRule.key && flowState.step !== "idle";

      if (!isSameRuleAlreadyEngaged) {
        const firstQuestion = normalizeReplyText((matchedRule.questions?.[0] || "").trim());

        if (matchedRule.questionsEnabled !== true || !firstQuestion) {
          // Keyword-only: deliver the asset immediately.
          const summaryDirective = (matchedRule.summary || "").trim();
          const reply = normalizeReplyText(
            await agentizeResponse({
              directive:
                summaryDirective ||
                `Deliver the ${(matchedRule.assetLabel || "resource").trim()} to the user in a natural way.`,
              agentName: (agent.name as string) || "",
              campaignContext: (agent.campaignContext as string) || "",
              skillsContent,
              assetUrl: matchedRule.assetUrl,
              assetLabel: matchedRule.assetLabel,
              type: "cta",
            })
          );
          if (reply) {
            flowState = {
              ...flowState,
              activeRuleKey: matchedRule.key,
              step: "completed",
              answers: [],
              currentQuestionIndex: 0,
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
              agentName: (agent.name as string) || "",
              campaignContext: (agent.campaignContext as string) || "",
              skillsContent,
            });
            return reply;
          }
        } else {
          // Question funnel: send the first question and enter "questioning" state.
          flowState = {
            ...flowState,
            activeRuleKey: matchedRule.key,
            step: "questioning",
            currentQuestionIndex: 0,
            answers: [],
            matchedBranchIndex: null,
            repliesSent: 1,
            followUpSentCount: 0,
            updatedAt: new Date().toISOString(),
          };
          await appendSupportChatMessages(
            sessionId,
            { content: message },
            { content: firstQuestion, hadFallbackReply: false }
          );
          await updateSessionFlowStateById(sessionId, flowState as Record<string, unknown>);
          await scheduleFollowUpIfNeeded({
            supportAgentId: agent.id,
            sessionIdentifier,
            supportChatSessionId: sessionId,
            flowState,
            rule: matchedRule,
            agentName: (agent.name as string) || "",
            campaignContext: (agent.campaignContext as string) || "",
            skillsContent,
          });
          return firstQuestion;
        }
      } // end if (!isSameRuleCapActive)
    }
  }

  // If the funnel is completed and the cap is still active, don't reset the funnel state.
  // The LLM fallback below will still respond to general support questions and store the message.
  const completedRule = flowState.activeRuleKey
    ? deterministicRules.find((r) => r.key === flowState.activeRuleKey)
    : null;
  const completedCap = completedRule?.maxAgentReplies || 3;
  const capStillActive =
    flowState.step === "completed" &&
    completedRule != null &&
    (flowState.repliesSent || 0) >= completedCap;

  if (!capStillActive) {
    if (flowState.step !== "idle" || flowState.activeRuleKey) {
      flowState = {
        ...flowState,
        activeRuleKey: null,
        step: "idle",
        answers: [],
        currentQuestionIndex: 0,
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
          answers: [],
          currentQuestionIndex: 0,
        } as Record<string, unknown>
      );
    }
  } // end if (!capStillActive)

  const conversationText =
    history.length > 0
      ? history.map((m) => `${m.role === "user" ? "User" : "Support"}: ${m.content}`).join("\n\n")
      : "";

  const kbContext = await buildKnowledgeContext(userId, agent.knowledgeBaseIds, message);

  const agentName = (agent.name as string) || "";
  const campaignContext = (agent.campaignContext as string) || "";
  const funnelRules = agent.funnelRules;
  const soulMd = (agent.soulMd as string) || "";
  const description = (agent.description as string) || "";
  const fallbackEmail = (agent.fallbackEmail as string) || "";

  // Only include funnel trigger rules when the session is idle (no active/completed funnel).
  // Once a funnel is done, the agent acts purely as a support agent answering questions.
  const sessionIsIdle = flowState.step === "idle" && !flowState.activeRuleKey;
  const funnelSection = sessionIsIdle ? buildFunnelRulesSection(funnelRules) : "";

  const systemParts = [
    PROMPT_INJECTION_SECURITY_PREAMBLE,
    `You are "${agentName}". You are a senior Sales Development Representative with years of experience. You handle support and customer questions directly.`,
    description ? `Your role: ${description}.` : "",
    soulMd ? `\n## Your Personality\n${soulMd}\n` : "",
    "",
    "KNOWLEDGE BASE (CRITICAL):",
    "You MUST answer ONLY using information found in the provided knowledge base context below. Do NOT make up, assume, or infer any facts, features, pricing, steps, or details that are not explicitly stated in the knowledge base.",
    "If the knowledge base context is empty or does not contain a clear answer to the user's question, you MUST say you are not sure. NEVER fabricate an answer.",
    "For questions: start directly with the answer. Do NOT repeat your name in every reply. Introduce yourself only when the user says hello or asks who you are.",
    fallbackEmail
      ? `When the knowledge base does not have the answer, say something like: "I don't have that information right now. You can reach our team directly at ${fallbackEmail} and they'll get back to you."`
      : "When the knowledge base does not have the answer, let the user know you are not sure and suggest they reach out to the team directly for a more accurate answer.",
    "",
    "TONE:",
    'Never use em dashes. Use commas, periods, or semicolons instead.',
    'Never use AI-like filler: "Great question", "Absolutely", "Sure!", "I\'d be happy to help", "That makes sense", "Got it". Start directly with substance.',
    "Never say or imply you are an AI, model, or assistant. You are a human.",
    "Be direct. Short punchy sentences. Sound like a real person, not a chatbot.",
    `GREETINGS: When the user greets you, respond warmly with your name and a single natural line that opens the conversation. Do NOT say "What's going on?" or "How can I help?". Do NOT repeat your role title robotically after your name. Sound like a real person saying hello, not a chatbot reciting a script.`,
    `Example greeting: "Hey! I'm ${agentName}. Good to have you here. What's on your mind?"`,
    "",
    "FORMATTING:",
    "Each sentence or idea gets its own line. Put a blank line between separate points.",
    "Never cram multiple ideas into one wall of text.",
    "If you include a link, put it on its own line with a short label. Example: 'Get it here: https://...'",
    "Keep responses focused. One clear point per reply. No spam.",
    campaignContext
      ? `\n## Campaign / Post Context\n${campaignContext}\n\nUse this to personalize responses. When the user is vague, give a specific tip from this context.`
      : "",
    funnelSection,
    "Do not ask follow-up questions after delivering content. Respond only to what they said.",
    "",
    `RATING: Only when the user has clearly indicated they have no further questions (e.g. they said "no", "that's all", "I'm good", or similar in response to you asking if there's anything else), you may briefly ask for a rating. For example: "If you have a moment, would you mind rating your experience with me from 1 to 5 stars? I'd love to hear how I could improve." Then end your reply with exactly a single line: [SUGGEST_RATING]. Do NOT ask for a rating or add [SUGGEST_RATING] in any other situation. The [SUGGEST_RATING] line will not be shown to the user.`,
  ].filter(Boolean);

  const systemPrompt = systemParts.join("\n\n");
  const userPrompt = conversationText
    ? `Conversation so far:\n\n${conversationText}\n\nUser: ${message}\n\nSupport:`
    : `User: ${message}\n\nSupport:`;

  const contextWithKb = kbContext ? `\n\n${kbContext}` : "";
  const fullPrompt =
    systemPrompt +
    contextWithKb +
    (skillsContent ? `\n\n${skillsContent}` : "") +
    "\n\n" +
    userPrompt;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
  const google = createGoogleGenerativeAI({ apiKey });
  const { text } = await generateText({
    model: google("gemini-3.1-flash-lite-preview"),
    prompt: fullPrompt,
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
