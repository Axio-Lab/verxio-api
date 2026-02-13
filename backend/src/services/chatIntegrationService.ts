import { prisma } from "../lib/prisma";
import { generateSharedSecret } from "../middleware/chatIntegrationAuth";
import {
  sendPlanningMessage,
  sendPlanningMessageStreaming,
  clearPlanningConversation,
} from "./planningService";
import { simpleAgentQuery } from "./agent/agentService";
import * as workflowService from "./workflowService";
import * as credentialService from "./credentialService";
import * as skillService from "./skillService";
import { inngest } from "../inngest";
import { sendWhatsAppMessage as sendWhatsAppViaConnector } from "./whatsappConnectorClient";
import { sendDiscordMessage as sendDiscordViaConnector } from "./discordConnectorClient";

/**
 * Chat Integration Integration Service
 *
 * Handles all ChatIntegration-related operations including:
 * - Integration setup and management
 * - External identity linking
 * - Message processing (plan mode, workflow execution)
 */

// ============================================
// Integration Management
// ============================================

/**
 * List integrations for a user
 */
export async function listIntegrations(userId: string) {
  return (prisma as any).chatIntegration.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Create a new Chat Integration integration for a user
 */
export async function createIntegration(
  userId: string,
  data: {
    label: string;
    platform?: "TELEGRAM" | "WHATSAPP" | "DISCORD" | "SLACK";
    scope?: "SINGLE_WORKFLOW" | "ALL_WORKFLOWS" | "ALLOW_LIST";
    scopeWorkflowId?: string | null;
    allowedWorkflowIds?: string[];
    isActive?: boolean;
    allowPlanMode?: boolean;
    allowWorkflowExecution?: boolean;
    soulMd?: string | null;
    evolvePersonality?: boolean;
    skillScope?: "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS";
    allowedSkillIds?: string[];
  }
) {
  const secret = generateSharedSecret();
  return (prisma as any).chatIntegration.create({
    data: {
      userId,
      label: data.label,
      platform: data.platform || "TELEGRAM",
      scope: data.scope || "ALL_WORKFLOWS",
      scopeWorkflowId: data.scopeWorkflowId || null,
      allowedWorkflowIds: data.allowedWorkflowIds || [],
      sharedSecret: secret,
      webhookUrl: null,
      isActive: data.isActive ?? true,
      allowPlanMode: data.allowPlanMode ?? true,
      allowWorkflowExecution: data.allowWorkflowExecution ?? true,
      soulMd: data.soulMd || null,
      evolvePersonality: data.evolvePersonality ?? false,
      skillScope: data.skillScope || "ALL_SKILLS",
      allowedSkillIds: data.allowedSkillIds || [],
    },
  });
}

/**
 * Get integration for a user by ID
 */
export async function getIntegration(userId: string, integrationId: string) {
  return (prisma as any).chatIntegration.findFirst({
    where: { id: integrationId, userId },
  });
}

/**
 * Get integration by ID
 */
export async function getIntegrationById(id: string) {
  return (prisma as any).chatIntegration.findUnique({
    where: { id },
  });
}

/**
 * Update integration settings
 */
export async function updateIntegration(
  userId: string,
  integrationId: string,
  data: {
    label?: string;
    platform?: "TELEGRAM" | "WHATSAPP" | "DISCORD" | "SLACK";
    scope?: "SINGLE_WORKFLOW" | "ALL_WORKFLOWS" | "ALLOW_LIST";
    scopeWorkflowId?: string | null;
    allowedWorkflowIds?: string[];
    isActive?: boolean;
    defaultWorkflowId?: string | null;
    lastRunWorkflowId?: string | null;
    allowPlanMode?: boolean;
    allowWorkflowExecution?: boolean;
    telegramBotToken?: string | null;
    whatsappOnlyOwnerCanChat?: boolean;
    soulMd?: string | null;
    evolvePersonality?: boolean;
    skillScope?: "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS";
    allowedSkillIds?: string[];
  }
) {
  const existing = await getIntegration(userId, integrationId);
  if (!existing) {
    throw new Error("Chat Integration integration not found.");
  }

  return (prisma as any).chatIntegration.update({
    where: { id: integrationId },
    data,
  });
}

// ============================================
// Agent Personality (soul.md) Management
// ============================================

/**
 * Generate a soul.md personality document using Claude.
 */
export async function generateSoulMd(params: {
  name: string;
  description: string;
  tone: string;
  coreTruths?: string;
  boundaries?: string;
}): Promise<string> {
  const { name, description, tone, coreTruths, boundaries } = params;

  const prompt = `You are an expert at crafting agent personality documents (soul.md). Generate a rich, detailed soul.md personality document for an AI assistant with the following details:

**Agent Name:** ${name}
**What it does:** ${description}
**Tone/Vibe:** ${tone}
${coreTruths ? `**User-provided Core Truths:** ${coreTruths}` : ""}
${boundaries ? `**User-provided Boundaries:** ${boundaries}` : ""}

The soul.md MUST have exactly three sections:

## Core Truths
These are the fundamental beliefs and values that define this agent. They should reflect the agent's purpose, principles, and what it stands for. Include 5-8 core truths.

## Boundaries
These are hard limits — things the agent will never do, topics it avoids, and ethical guardrails. Include 4-6 boundaries.

## The Vibe
This defines the agent's voice, tone, and communication style. How does it greet people? What kind of language does it use? Does it use humor? How formal or casual is it? Be very specific and give examples of how the agent would phrase things.

Output ONLY the soul.md content in markdown format. Do not wrap in code fences. Make it feel authentic and unique to this agent's personality — not generic.`;

  const model = process.env.AGENT_CLAUDE_MODEL || "claude-sonnet-4-20250514";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to generate soul.md: ${err}`);
  }

  const result = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const text = result.content
    ?.filter((b: { type: string }) => b.type === "text")
    .map((b: { text?: string }) => b.text || "")
    .join("\n");

  if (!text?.trim()) {
    throw new Error("AI returned empty soul.md content.");
  }

  return text.trim();
}

/**
 * Save soul.md content to an integration.
 */
export async function saveSoulMd(
  userId: string,
  integrationId: string,
  soulMd: string
) {
  const existing = await getIntegration(userId, integrationId);
  if (!existing) {
    throw new Error("Integration not found.");
  }

  return (prisma as any).chatIntegration.update({
    where: { id: integrationId },
    data: { soulMd },
  });
}

/**
 * Update soul.md via agent self-evolution.
 */
export async function updateSoulEvolution(
  userId: string,
  integrationId: string,
  updatedSoulMd: string
) {
  const existing = await getIntegration(userId, integrationId);
  if (!existing) {
    throw new Error("Integration not found.");
  }
  if (!existing.evolvePersonality) {
    throw new Error("Personality evolution is not enabled for this integration.");
  }

  return (prisma as any).chatIntegration.update({
    where: { id: integrationId },
    data: { soulMd: updatedSoulMd },
  });
}

/**
 * Build hosted Telegram webhook URL for a specific integration.
 */
export function getHostedTelegramWebhookUrl(integrationId: string) {
  const base = process.env.API_URL?.trim();
  if (!base) {
    throw new Error("API_URL is required to build the Telegram webhook URL.");
  }
  return `${base.replace(/\/$/, "")}/api/chat-integrations/telegram/webhook/${integrationId}`;
}

/**
 * Configure Telegram webhook for a bot token.
 */
export async function configureTelegramWebhook(
  botToken: string,
  integrationId: string,
  sharedSecret: string
) {
  const webhookUrl = getHostedTelegramWebhookUrl(integrationId);
  if (!webhookUrl.startsWith("https://")) {
    throw new Error(
      "Telegram requires an HTTPS webhook URL. Set CHAT_WEBHOOK_PUBLIC_URL or BACKEND_URL to your public HTTPS URL (e.g. your ngrok URL: https://your-subdomain.ngrok-free.app)."
    );
  }
  const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: sharedSecret,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Telegram setWebhook failed: ${errorData.description || response.statusText}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram setWebhook failed: ${data.description || "Unknown error"}`);
  }

  return webhookUrl;
}

/**
 * Save Telegram bot token and configure hosted webhook.
 */
export async function saveTelegramBotToken(
  userId: string,
  integrationId: string,
  botToken: string
) {
  const integration = await getIntegration(userId, integrationId);
  if (!integration) {
    throw new Error("Chat Integration integration not found.");
  }
  if (integration.platform !== "TELEGRAM") {
    throw new Error("Telegram token can only be set for TELEGRAM integrations.");
  }

  const webhookUrl = await configureTelegramWebhook(
    botToken,
    integration.id,
    integration.sharedSecret
  );

  // Fetch bot info via getMe to store username and ID (needed for group mention detection)
  let telegramBotUsername: string | undefined;
  let telegramBotId: string | undefined;
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const meJson = await meRes.json();
    if (meJson.ok && meJson.result) {
      telegramBotUsername = meJson.result.username || undefined;
      telegramBotId = meJson.result.id?.toString() || undefined;
    }
  } catch (err) {
    console.warn("[Telegram] Failed to fetch bot info via getMe:", err);
  }

  return (prisma as any).chatIntegration.update({
    where: { id: integration.id },
    data: {
      telegramBotToken: botToken,
      webhookUrl,
      ...(telegramBotUsername && { telegramBotUsername }),
      ...(telegramBotId && { telegramBotId }),
    },
  });
}

/**
 * Refresh Telegram webhook using stored bot token.
 */
export async function refreshTelegramWebhook(userId: string, integrationId: string) {
  const integration = await getIntegration(userId, integrationId);
  if (!integration) {
    throw new Error("Chat Integration integration not found.");
  }
  if (integration.platform !== "TELEGRAM") {
    throw new Error("Telegram webhook can only be refreshed for TELEGRAM integrations.");
  }
  if (!integration.telegramBotToken) {
    throw new Error("Telegram bot token is not configured.");
  }

  const webhookUrl = await configureTelegramWebhook(
    integration.telegramBotToken,
    integration.id,
    integration.sharedSecret
  );

  return (prisma as any).chatIntegration.update({
    where: { id: integration.id },
    data: {
      webhookUrl,
    },
  });
}

/**
 * Validate Telegram webhook configuration.
 */
export async function getTelegramWebhookInfo(botToken: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Telegram getWebhookInfo failed: ${errorData.description || response.statusText}`
    );
  }
  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram getWebhookInfo failed: ${data.description || "Unknown error"}`);
  }
  return data.result;
}

/**
 * Get or create WhatsAppSession for a Chat Integration (platform WHATSAPP).
 */
export async function getOrCreateWhatsAppSession(integrationId: string) {
  const integration = await (prisma as any).chatIntegration.findFirst({
    where: { id: integrationId, platform: "WHATSAPP" },
    include: { whatsappSession: true },
  });
  if (!integration) return null;
  if (integration.whatsappSession) return integration.whatsappSession;
  const session = await (prisma as any).whatsAppSession.create({
    data: {
      integrationId,
      status: "disconnected",
    },
  });
  await (prisma as any).chatIntegration.update({
    where: { id: integrationId },
    data: { whatsappSessionId: session.id },
  });
  return session;
}

/**
 * Get or create WhatsAppSession for a Credential (workflow trigger/send only, no Chat Integration agent).
 */
export async function getOrCreateWhatsAppSessionForCredential(
  credentialId: string,
  userId: string
) {
  const credential = await (prisma as any).credential.findFirst({
    where: { id: credentialId, userId },
  });
  if (!credential) return null;
  if (credential.type !== "WHATSAPP") return null;
  const existing = await (prisma as any).whatsAppSession.findUnique({
    where: { credentialId },
  });
  if (existing) return existing;
  const session = await (prisma as any).whatsAppSession.create({
    data: {
      credentialId,
      status: "disconnected",
    },
  });
  return session;
}

/**
 * Regenerate shared secret
 */
export async function regenerateSecret(userId: string, integrationId: string) {
  const newSecret = generateSharedSecret();

  await (prisma as any).chatIntegration.update({
    where: { id: integrationId },
    data: { sharedSecret: newSecret },
  });

  return newSecret;
}

/**
 * Delete integration
 */
export async function deleteIntegration(userId: string, integrationId: string) {
  // Also delete all linked external identities
  await (prisma as any).externalIdentity.deleteMany({
    where: { userId, integrationId },
  });

  return (prisma as any).chatIntegration.delete({
    where: { id: integrationId },
  });
}

// ============================================
// External Identity Management
// ============================================

/**
 * Link an external identity to a Verxio user
 */
export async function linkExternalIdentity(
  userId: string,
  platform: string,
  externalId: string,
  integrationId?: string,
  externalName?: string,
  metadata?: Record<string, unknown>
) {
  // Check if this external identity is already linked to another user
  const existing = await (prisma as any).externalIdentity.findUnique({
    where: {
      platform_externalId_integrationId: {
        platform,
        externalId,
        integrationId: integrationId || null,
      },
    },
  });

  if (existing && existing.userId !== userId) {
    throw new Error("This external identity is already linked to another account");
  }

  if (existing) {
    // Update existing link
    return (prisma as any).externalIdentity.update({
      where: { id: existing.id },
      data: {
        externalName,
        metadata,
        lastActiveAt: new Date(),
      },
    });
  }

  // Create new link
  return (prisma as any).externalIdentity.create({
    data: {
      userId,
      integrationId: integrationId || null,
      platform,
      externalId,
      externalName,
      metadata,
      isActive: true,
    },
  });
}

/**
 * Unlink an external identity
 */
export async function unlinkExternalIdentity(
  userId: string,
  platform: string,
  externalId: string,
  integrationId?: string
) {
  return (prisma as any).externalIdentity.deleteMany({
    where: {
      userId,
      platform,
      externalId,
      integrationId: integrationId || null,
    },
  });
}

/**
 * Get external identities for a user with optional pagination
 */
export async function getExternalIdentities(
  userId: string,
  integrationId?: string,
  options?: { page?: number; limit?: number }
) {
  const where = { userId, ...(integrationId ? { integrationId } : {}) };
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const page = Math.max(options?.page ?? 1, 1);
  const skip = (page - 1) * limit;

  const [identities, total] = await Promise.all([
    (prisma as any).externalIdentity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    (prisma as any).externalIdentity.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;
  return { identities, total, page, limit, totalPages };
}

/**
 * Find user by external identity
 */
export async function findUserByExternalIdentity(
  platform: string,
  externalId: string,
  integrationId?: string
) {
  const identity = await (prisma as any).externalIdentity.findUnique({
    where: {
      platform_externalId_integrationId: {
        platform,
        externalId,
        integrationId: integrationId || null,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          subscriptionPlan: true,
        },
      },
    },
  });

  return identity?.user || null;
}

// ============================================
// Message Processing
// ============================================

export interface ChatIntegrationMessage {
  platform: string;
  externalId: string;
  externalName?: string;
  message: string;
  attachments?: Array<{
    type: "image" | "file" | "document";
    url?: string;
    base64?: string;
    mimeType?: string;
    fileName?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface ChatIntegrationResponse {
  success: boolean;
  type: "plan" | "workflow" | "link" | "error" | "info";
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Convert simple Markdown-like text to Telegram-safe HTML.
 * Telegram HTML supports: <b>, <i>, <code>, <pre>, <a>.
 */
export function formatTelegramMessage(text: string): string {
  if (!text) return "";

  // Escape HTML special chars first
  let output = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Inline code
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold (**text** or __text__)
  output = output.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  output = output.replace(/__([^_]+)__/g, "<b>$1</b>");

  // Italic (*text* or _text_) - avoid bold markers already converted
  output = output.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<i>$2</i>");
  output = output.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<i>$2</i>");

  // Bullet lists: "- item" -> "• item"
  output = output.replace(/^\s*-\s+/gm, "• ");

  return output;
}

/**
 * Convert markdown-like text to WhatsApp formatting.
 * WhatsApp supports: *bold*, _italic_, ~strikethrough~, ```monospace```.
 * Cleans up stray Unicode and normalizes bullets/lists for readable display.
 */
export function formatWhatsAppMessage(text: string): string {
  if (!text) return "";
  let out = text;

  // Remove narrow no-break space and similar that break display
  out = out.replace(/\u202f/g, " ").replace(/\u00a0/g, " ");

  // Inline `code` -> ```code``` for monospace
  out = out.replace(/`([^`]+)`/g, "```$1```");

  // Bold: **text** or __text__ -> *text* (WhatsApp bold)
  out = out.replace(/\*\*([^*]+)\*\*/g, "*$1*");
  out = out.replace(/__([^_]+)__/g, "*$1*");

  // Italic: single *word* (not **) -> _word_
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1_$2_");

  // Bullet lists: normalize "• " and "- " to a single bullet style
  out = out.replace(/^\s*[•\-]\s+/gm, "• ");
  // Numbered lists: ensure "1." "2." have a space after the dot
  out = out.replace(/^(\d+)\.\s*/gm, "$1. ");

  return out.trim();
}

/**
 * Format text for Slack mrkdwn.
 * Slack uses *bold*, _italic_, `code`, ```code block```, and <@USER_ID> mentions.
 */
export function formatSlackMessage(text: string): string {
  if (!text) return "";
  let out = text;

  // Bold: **text** or __text__ -> *text*
  out = out.replace(/\*\*([^*]+)\*\*/g, "*$1*");
  out = out.replace(/__([^_]+)__/g, "*$1*");

  // Italic: single *word* (not **) -> _word_ (must not conflict with bold we just converted)
  // Slack uses _italic_ already so markdown _word_ is fine
  // Convert remaining single * that are NOT bold to _italic_
  // Since we already converted ** to *, we skip this step to avoid double-conversion

  // Bullet lists: "- item" -> "• item"
  out = out.replace(/^\s*-\s+/gm, "• ");

  return out.trim();
}

/**
 * Format text for Discord markdown.
 * Discord uses standard markdown: **bold**, *italic*, `code`, ```code block```.
 * Mentions: <@USER_ID>, <@&ROLE_ID>, <#CHANNEL_ID>
 */
export function formatDiscordMessage(text: string): string {
  if (!text) return "";
  // Discord supports standard markdown natively, minimal conversion needed
  let out = text;
  // Bullet lists: "• item" -> "- item" (Discord renders - as bullet)
  out = out.replace(/^\s*•\s+/gm, "- ");
  return out.trim();
}

/**
 * Split a message into chunks for Discord (2000 char limit).
 */
export function splitDiscordMessage(text: string, maxLen = 2000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Try to split at last newline within limit
    let splitIdx = remaining.lastIndexOf("\n", maxLen);
    if (splitIdx < maxLen * 0.3) {
      // No good newline break, split at last space
      splitIdx = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitIdx < maxLen * 0.3) {
      // Force split
      splitIdx = maxLen;
    }
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }
  return chunks;
}

/**
 * Send a message to a Slack channel via Slack Web API.
 */
export async function sendSlackMessage(
  botToken: string,
  channel: string,
  text: string,
  threadTs?: string
) {
  const formatted = formatSlackMessage(text);
  const payload: Record<string, unknown> = {
    channel,
    text: formatted,
    ...(threadTs ? { thread_ts: threadTs } : {}),
  };
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error("[Slack] chat.postMessage failed:", data.error);
  }
  return data;
}

/**
 * Get the hosted Slack webhook URL for an integration.
 */
export function getHostedSlackWebhookUrl(integrationId: string) {
  const base = process.env.API_URL?.trim();
  if (!base) {
    throw new Error("API_URL is required to build the Slack webhook URL.");
  }
  return `${base.replace(/\/$/, "")}/api/chat-integrations/slack/events/${integrationId}`;
}

/**
 * Save Slack bot token and signing secret.
 */
export async function saveSlackBotToken(
  userId: string,
  integrationId: string,
  botToken: string,
  signingSecret: string
) {
  const integration = await getIntegration(userId, integrationId);
  if (!integration) {
    throw new Error("Chat Integration not found.");
  }
  if (integration.platform !== "SLACK") {
    throw new Error("Slack token can only be set for SLACK integrations.");
  }

  // Verify token by calling auth.test
  const authRes = await fetch("https://slack.com/api/auth.test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${botToken}`,
    },
  });
  const authData = await authRes.json();
  if (!authData.ok) {
    throw new Error(`Slack auth.test failed: ${authData.error || "unknown error"}`);
  }

  const webhookUrl = getHostedSlackWebhookUrl(integration.id);

  return (prisma as any).chatIntegration.update({
    where: { id: integration.id },
    data: {
      slackBotToken: botToken,
      slackSigningSecret: signingSecret,
      slackTeamId: authData.team_id || undefined,
      slackBotUserId: authData.user_id || undefined,
      webhookUrl,
    },
  });
}

/**
 * Save Discord bot token.
 */
export async function saveDiscordBotToken(
  userId: string,
  integrationId: string,
  botToken: string
) {
  const integration = await getIntegration(userId, integrationId);
  if (!integration) {
    throw new Error("Chat Integration not found.");
  }
  if (integration.platform !== "DISCORD") {
    throw new Error("Discord token can only be set for DISCORD integrations.");
  }

  // Verify token by calling /users/@me
  const meRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!meRes.ok) {
    const text = await meRes.text();
    throw new Error(`Discord token verification failed: ${text}`);
  }
  const meData = await meRes.json();

  return (prisma as any).chatIntegration.update({
    where: { id: integration.id },
    data: {
      discordBotToken: botToken,
      discordBotUserId: meData.id || undefined,
    },
  });
}

/**
 * Generate Discord bot invite URL with required permissions.
 */
export function getDiscordInviteUrl(clientId: string): string {
  // Permissions: Send Messages (2048), Read Message History (65536), Mention Everyone (131072)
  const permissions = 2048 + 65536 + 131072;
  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot`;
}

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_WAIT_MS = 90_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildWorkflowName(message: ChatIntegrationMessage): string {
  const sender = message.externalName || message.externalId || "Unknown";
  const normalized = message.message.replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").slice(0, 8).join(" ");
  const suffix = words ? ` - ${words}` : "";
  return `ChatIntegration ${sender}${suffix}`.slice(0, 80);
}

function buildResultSummaryBasic(output: Record<string, unknown>): string | null {
  const mediaLines: string[] = [];
  const keys = Object.keys(output || {});

  const firstText = extractFirstText(output);
  if (firstText) {
    return truncateTelegramText(`**Workflow completed.**\n\n${firstText}`);
  }

  for (const key of keys) {
    const value: any = (output as any)[key];
    if (value && typeof value === "object") {
      const imageUrl = value.imageUrl || value.image_url;
      const videoUrl = value.videoUrl || value.video_url;
      const audioUrl = value.audioUrl || value.audio_url;
      if (imageUrl) mediaLines.push(`• **${key}**: ${imageUrl}`);
      if (videoUrl) mediaLines.push(`• **${key}**: ${videoUrl}`);
      if (audioUrl) mediaLines.push(`• **${key}**: ${audioUrl}`);
    }
  }

  if (mediaLines.length > 0) {
    return truncateTelegramText(`**Workflow completed.**\n\n${mediaLines.join("\n")}`);
  }

  const summaryLines: string[] = [];
  for (const key of keys) {
    const value: any = (output as any)[key];
    if (value == null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      const text = String(value);
      summaryLines.push(`• **${key}**: ${text}`);
      continue;
    }
    if (typeof value === "object") {
      const candidate =
        typeof (value as any).text === "string"
          ? (value as any).text
          : typeof (value as any).message === "string"
            ? (value as any).message
            : null;
      if (candidate) {
        summaryLines.push(`• **${key}**: ${candidate}`);
      } else if (Array.isArray(value)) {
        summaryLines.push(`• **${key}**: ${value.length} items`);
      } else {
        summaryLines.push(`• **${key}**: object`);
      }
    }
  }

  if (summaryLines.length > 0) {
    return truncateTelegramText(`**Workflow completed.**\n\n${summaryLines.join("\n")}`);
  }

  return null;
}

async function buildResultSummaryWithAgent(options: {
  output: Record<string, unknown>;
  userId: string;
  workflowId?: string;
}): Promise<string> {
  const basic = buildResultSummaryBasic(options.output);
  if (basic) return basic;

  const preview = JSON.stringify(options.output, null, 2);
  const clipped = preview.length > 6000 ? `${preview.slice(0, 6000)}\n...` : preview;
  const prompt = `You are formatting a workflow execution result for Telegram.
Use only the JSON below. Do not invent data. Do not output JSON.
Return a concise, readable response with short paragraphs and bullet points.
If there is a main text content, include it verbatim.

JSON:
${clipped}`;

  const result = await simpleAgentQuery({
    prompt,
    userId: options.userId,
    workflowId: options.workflowId,
    includeUserConnections: false,
    maxTurns: 2,
    traceType: "agent_query",
  });

  const fallback = `**Workflow completed.**\n\n${clipped.slice(0, 1200)}${clipped.length > 1200 ? "\n..." : ""}`;
  if (!result.success || !result.result) {
    return truncateTelegramText(fallback);
  }

  return truncateTelegramText(result.result.trim());
}

function extractFirstText(output: Record<string, unknown>): string | null {
  const paths: Array<string[]> = [
    ["aiContent", "text"],
    ["result", "aiContent", "text"],
    ["output", "aiContent", "text"],
    ["content", "text"],
    ["text"],
    ["message"],
  ];

  for (const path of paths) {
    let current: any = output as any;
    let found = true;
    for (const key of path) {
      if (!current || typeof current !== "object" || !(key in current)) {
        found = false;
        break;
      }
      current = current[key];
    }
    if (found && typeof current === "string" && current.trim()) {
      return current.trim();
    }
  }

  return null;
}

function truncateTelegramText(text: string, maxLength = 3500): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n...`;
}

function resolveAllowedWorkflowIds(integration: any): string[] | null {
  if (integration?.scope === "ALL_WORKFLOWS") return null;
  if (integration?.scope === "SINGLE_WORKFLOW") {
    return integration.scopeWorkflowId ? [integration.scopeWorkflowId] : [];
  }
  if (integration?.scope === "ALLOW_LIST") {
    return Array.isArray(integration.allowedWorkflowIds) ? integration.allowedWorkflowIds : [];
  }
  return null;
}

/**
 * Check if user has premium access (plan mode requires premium)
 */
function hasPremiumAccess(user: { subscriptionPlan?: string | null }): boolean {
  const plan = user.subscriptionPlan?.toLowerCase();
  // Free plan users don't have premium access
  if (!plan || plan === "free") {
    return false;
  }
  // Premium plans: pro, enterprise, beta-tester, etc.
  return true;
}

function isWorkflowAllowed(integration: any, workflowId: string): boolean {
  const allowed = resolveAllowedWorkflowIds(integration);
  if (!allowed) return true;
  return allowed.includes(workflowId);
}

type MediaItem = { type: "photo" | "video" | "audio"; url: string; label: string };

function extractMediaItems(output: Record<string, unknown>): MediaItem[] {
  const items: MediaItem[] = [];
  const keys = Object.keys(output || {});

  for (const key of keys) {
    const value: any = (output as any)[key];
    if (!value || typeof value !== "object") continue;
    const imageUrl = value.imageUrl || value.image_url;
    const videoUrl = value.videoUrl || value.video_url;
    const audioUrl = value.audioUrl || value.audio_url;
    if (imageUrl) items.push({ type: "photo", url: imageUrl, label: key });
    if (videoUrl) items.push({ type: "video", url: videoUrl, label: key });
    if (audioUrl) items.push({ type: "audio", url: audioUrl, label: key });
  }

  return items;
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const formatted = formatTelegramMessage(text);
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatted,
      parse_mode: "HTML",
    }),
  });
}

async function sendTelegramMedia(botToken: string, chatId: string, item: MediaItem) {
  const endpoint =
    item.type === "photo" ? "sendPhoto" : item.type === "video" ? "sendVideo" : "sendAudio";

  const body: Record<string, unknown> = {
    chat_id: chatId,
    caption: formatTelegramMessage(`Output (${item.label})`),
    parse_mode: "HTML",
  };

  if (item.type === "photo") {
    body.photo = item.url;
  } else if (item.type === "video") {
    body.video = item.url;
  } else {
    body.audio = item.url;
  }

  await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Send up to 10 photos as a single Telegram album (media group). */
async function sendTelegramPhotoAlbum(
  botToken: string,
  chatId: string,
  photoItems: MediaItem[],
  caption?: string
) {
  const MAX_ALBUM = 10;
  const slice = photoItems.slice(0, MAX_ALBUM);
  const media = slice.map((item, i) => ({
    type: "photo" as const,
    media: item.url,
    caption: i === 0 && caption ? formatTelegramMessage(caption) : undefined,
    parse_mode: i === 0 && caption ? "HTML" : undefined,
  }));
  if (media.length === 0) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      media,
    }),
  });
  // If there are more than 10, send the rest as individual photos
  for (let i = MAX_ALBUM; i < photoItems.length; i++) {
    await sendTelegramMedia(botToken, chatId, photoItems[i]);
  }
}

async function runWorkflowAndWait(options: {
  workflowId: string;
  userId: string;
  message: string;
  telegramPayload?: Record<string, unknown>;
  whatsappPayload?: Record<string, unknown>;
}) {
  const { workflowId, userId, message, telegramPayload, whatsappPayload } = options;

  const workflow = await workflowService.getWorkflow(workflowId, userId);
  const nodes = workflow.nodes || [];
  const telegramTrigger = nodes.find((n: any) => n.type === "TELEGRAM_TRIGGER");
  const whatsappTrigger = nodes.find((n: any) => n.type === "WHATSAPP_TRIGGER");
  const webhookTrigger = nodes.find((n: any) => n.type === "WEBHOOK");

  const run = await (prisma as any).publicChatRun.create({
    data: {
      workflowId,
      status: "PENDING",
      input: { message } as object,
    },
  });

  const eventData: Record<string, unknown> = {
    workflowId,
    userId,
    publicChatRunId: run.id,
  };

  if (telegramTrigger && telegramPayload) {
    eventData.telegramNodeId = telegramTrigger.id;
    eventData.initialData = {
      telegramPayload,
    };
  } else if (whatsappTrigger && whatsappPayload) {
    eventData.whatsappNodeId = whatsappTrigger.id;
    eventData.initialData = {
      whatsappPayload,
    };
  } else if (webhookTrigger) {
    eventData.webhookNodeId = webhookTrigger.id;
    eventData.initialData = {
      webhookPayload: { message },
      webhookHeaders: {},
    };
  } else {
    eventData.data = { message, source: "chat-integration" };
  }

  await inngest.send({
    name: "workflow/trigger",
    data: eventData as any,
  });

  const deadline = Date.now() + POLL_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const updated = await (prisma as any).publicChatRun.findUnique({ where: { id: run.id } });
    if (!updated) break;
    if (updated.status === "COMPLETED") {
      return { success: true, output: updated.output || {} };
    }
    if (updated.status === "FAILED") {
      return { success: false, error: updated.error || "Workflow failed" };
    }
  }

  return { success: false, error: "Workflow did not complete in time" };
}

/**
 * Process incoming message from ChatIntegration
 */
export async function processMessage(
  userId: string,
  integration: any,
  message: ChatIntegrationMessage
): Promise<ChatIntegrationResponse> {
  const text = message.message.trim();
  const lowerText = text.toLowerCase();

  // Handle special commands
  if (lowerText.startsWith("/")) {
    return handleCommand(userId, integration, text, message);
  }

  // Treat natural-language "run" requests as workflow execution
  if (integration.allowWorkflowExecution) {
    const runMatch = lowerText.match(/^(run|execute|rerun)\b(.*)$/);
    if (runMatch) {
      const args = (runMatch[2] || "").trim();
      return handleRunWorkflow(userId, integration, args, message);
    }
  }

  // Default: Use plan mode if allowed
  if (integration.allowPlanMode) {
    return handlePlanMessage(userId, integration, message);
  }

  return {
    success: false,
    type: "error",
    message: "Plan mode is disabled for this integration. Use /help for available commands.",
  };
}

/**
 * Handle special commands
 */
async function handleCommand(
  userId: string,
  integration: any,
  command: string,
  message: ChatIntegrationMessage
): Promise<ChatIntegrationResponse> {
  const parts = command.slice(1).split(" ");
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  switch (cmd) {
    case "help":
      return {
        success: true,
        type: "info",
        message: `**Verxio Commands:**

/workflows - List your workflows
/workflow <workflow_name_or_id> - Get workflow details
/run <workflow_name> - Execute a workflow
/create-workflow <name> - Create a new workflow
/delete-workflow <workflow_name_or_id> - Delete a workflow
/credentials - List your credentials
/add-credential <TYPE> <NAME> <VALUE> - Add a credential
/delete-credential <credential_id> - Delete a credential
/skills - List your skills
/add-skill <url> - Add a skill file from URL
/update-skill <skill_id> <url> - Update a skill from URL
/remove-skill <skill_id> - Remove a skill
/status - Check integration status
/link - Link your Telegram to Verxio (if not already linked)
/clear - Clear workflow conversation history

**Plan Mode:**
Just send a message to interact with the AI assistant. It can help you:
- Create and modify workflows
- Understand your automation needs
- Configure nodes and connections`,
      };

    case "workflows":
      return handleListWorkflows(userId, integration);

    case "workflow":
      return handleWorkflowDetails(userId, integration, args);

    case "create-workflow":
      return handleCreateWorkflow(userId, integration, args);

    case "delete-workflow":
      return handleDeleteWorkflow(userId, integration, args);

    case "credentials":
      return handleListCredentials(userId);

    case "add-credential":
      return handleAddCredential(userId, args);

    case "delete-credential":
      return handleDeleteCredential(userId, args);

    case "run":
      if (!integration.allowWorkflowExecution) {
        return {
          success: false,
          type: "error",
          message: "Workflow execution is disabled for this integration.",
        };
      }
      return handleRunWorkflow(userId, integration, args, message);

    case "status":
      return {
        success: true,
        type: "info",
        message: `**Integration Status:**
- Plan Mode: ${integration.allowPlanMode ? "Enabled" : "Disabled"}
- Workflow Execution: ${integration.allowWorkflowExecution ? "Enabled" : "Disabled"}
- Total Requests: ${integration.totalRequests}
- Last Used: ${integration.lastUsedAt ? new Date(integration.lastUsedAt).toLocaleString() : "Never"}`,
      };

    case "link":
      // Linking is handled separately via a secure link
      return {
        success: true,
        type: "info",
        message:
          "To link your Telegram account, please visit your Verxio dashboard and use the ChatIntegration page to complete setup.",
      };

    case "clear":
      return handleClearConversation(userId, integration);

    case "add-skill":
      return handleAddSkill(userId, args);

    case "skills":
      return handleListSkills(userId);

    case "remove-skill":
      return handleRemoveSkill(userId, args);

    case "update-skill":
      return handleUpdateSkill(userId, args);

    default:
      return {
        success: false,
        type: "error",
        message: `Unknown command: /${cmd}. Use /help for available commands.`,
      };
  }
}

/**
 * Handle clear conversation command
 */
async function handleClearConversation(
  userId: string,
  integration: any
): Promise<ChatIntegrationResponse> {
  try {
    // Get workflow ID using same logic as plan mode
    let workflowId = integration.defaultWorkflowId;
    const allowedIds = resolveAllowedWorkflowIds(integration);

    if (integration.scope === "SINGLE_WORKFLOW" && integration.scopeWorkflowId) {
      workflowId = integration.scopeWorkflowId;
    } else if (
      integration.scope === "ALLOW_LIST" &&
      allowedIds &&
      allowedIds.length > 0 &&
      (!workflowId || !allowedIds.includes(workflowId))
    ) {
      workflowId = allowedIds[0];
    }

    if (!workflowId) {
      return {
        success: false,
        type: "error",
        message:
          "No workflow found. Start a conversation first by sending a message, then you can clear it.",
      };
    }

    await clearPlanningConversation(workflowId);

    return {
      success: true,
      type: "info",
      message: "Conversation history cleared. Starting fresh!",
    };
  } catch (error) {
    console.error("[ChatIntegration] Clear conversation error:", error);
    return {
      success: false,
      type: "error",
      message: error instanceof Error ? error.message : "Failed to clear conversation",
    };
  }
}

/**
 * Handle plan mode message
 */
async function handlePlanMessage(
  userId: string,
  integration: any,
  message: ChatIntegrationMessage
): Promise<ChatIntegrationResponse> {
  try {
    // Get or use default workflow for planning
    let workflowId = integration.defaultWorkflowId;
    const allowedIds = resolveAllowedWorkflowIds(integration);

    if (integration.scope === "SINGLE_WORKFLOW" && integration.scopeWorkflowId) {
      workflowId = integration.scopeWorkflowId;
    } else if (
      integration.scope === "ALLOW_LIST" &&
      allowedIds &&
      allowedIds.length > 0 &&
      (!workflowId || !allowedIds.includes(workflowId))
    ) {
      workflowId = allowedIds[0];
    }

    if (!workflowId) {
      // Create a new workflow for this planning session
      const workflow = await workflowService.createWorkflow({
        name: buildWorkflowName(message),
        userId,
      });
      workflowId = workflow.id;

      // Update integration with default workflow
      await updateIntegration(userId, integration.id, { defaultWorkflowId: workflowId });
    }

    // Process attachments
    const attachments = message.attachments?.map((att) => ({
      type: att.type === "document" ? "file" : att.type,
      url: att.url,
      base64: att.base64,
      mimeType: att.mimeType,
      fileName: att.fileName,
    }));

    // Build agent personality and skill config from integration (always pass when in integration flow)
    const agentPersonality = {
      name: integration.label || "Verxio",
      soulMd: integration.soulMd || "",
      evolvePersonality: integration.evolvePersonality ?? false,
      integrationId: integration.id,
      skillScope: (integration.skillScope || "ALL_SKILLS") as "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS",
      allowedSkillIds: integration.allowedSkillIds || [],
    };

    // Send message to planning service
    const result = await sendPlanningMessage({
      workflowId,
      userId,
      message: message.message,
      attachments: attachments as any,
      agentPersonality,
    });

    return {
      success: true,
      type: "plan",
      message: result.response,
      data: {
        workflowModified: result.workflowModified,
        toolsUsed: result.toolsUsed,
        workflowId,
      },
    };
  } catch (error) {
    console.error("[ChatIntegration] Plan message error:", error);
    return {
      success: false,
      type: "error",
      message: error instanceof Error ? error.message : "Failed to process message",
    };
  }
}

/**
 * Handle listing workflows
 */
async function handleListWorkflows(
  userId: string,
  integration: any
): Promise<ChatIntegrationResponse> {
  try {
    const result = await workflowService.getWorkflows(userId, 1, 100);
    const allowedIds = resolveAllowedWorkflowIds(integration);
    const workflows = allowedIds
      ? result.workflows.filter((w: any) => allowedIds.includes(w.id))
      : result.workflows;

    if (workflows.length === 0) {
      return {
        success: true,
        type: "info",
        message: "You don't have any workflows yet. Send a message to start creating one!",
      };
    }

    const workflowList = workflows
      .map((w: any, i: number) => `${i + 1}. **${w.name}** (ID: \`${w.id}\`)`)
      .join("\n");

    return {
      success: true,
      type: "info",
      message: `**Your Workflows:**\n\n${workflowList}\n\nUse \`/run <workflow_name>\` to execute a workflow.`,
      data: {
        workflows: workflows.map((w: any) => ({ id: w.id, name: w.name })),
        total: workflows.length,
      },
    };
  } catch (error) {
    console.error("[ChatIntegration] List workflows error:", error);
    return {
      success: false,
      type: "error",
      message: "Failed to list workflows",
    };
  }
}

/**
 * Handle workflow detail lookup
 */
async function handleWorkflowDetails(
  userId: string,
  integration: any,
  workflowNameOrId: string
): Promise<ChatIntegrationResponse> {
  const trimmed = workflowNameOrId.trim();
  if (!trimmed) {
    return {
      success: false,
      type: "error",
      message: "Please specify a workflow name or ID. Example: `/workflow Daily Content`",
    };
  }

  const result = await workflowService.getWorkflows(userId, 1, 200);
  const allowedIds = resolveAllowedWorkflowIds(integration);
  const candidates = allowedIds
    ? result.workflows.filter((w: any) => allowedIds.includes(w.id))
    : result.workflows;

  const workflow = candidates.find(
    (w: any) =>
      w.id === trimmed ||
      w.name.toLowerCase() === trimmed.toLowerCase() ||
      w.name.toLowerCase().includes(trimmed.toLowerCase())
  );

  if (!workflow) {
    return {
      success: false,
      type: "error",
      message: `Workflow "${workflowNameOrId}" not found. Use /workflows to see available workflows.`,
    };
  }

  const full = await workflowService.getWorkflow(workflow.id, userId);
  const nodeCount = full.nodes?.length || 0;
  const connectionCount = full.connections?.length || 0;

  return {
    success: true,
    type: "info",
    message: `**Workflow Details**\n\n• **Name**: ${full.name}\n• **ID**: \`${full.id}\`\n• **Nodes**: ${nodeCount}\n• **Connections**: ${connectionCount}\n• **Updated**: ${new Date(full.updatedAt).toLocaleString()}`,
  };
}

/**
 * Handle workflow creation
 */
async function handleCreateWorkflow(
  userId: string,
  integration: any,
  name: string
): Promise<ChatIntegrationResponse> {
  const trimmed = name.trim();
  if (!trimmed) {
    return {
      success: false,
      type: "error",
      message: "Please provide a workflow name. Example: `/create-workflow Daily Content`",
    };
  }

  if (integration.scope === "SINGLE_WORKFLOW") {
    return {
      success: false,
      type: "error",
      message: "This integration is locked to a single workflow. Update scope to create more.",
    };
  }

  const workflow = await workflowService.createWorkflow({ name: trimmed, userId });

  if (integration.scope === "ALLOW_LIST") {
    const nextAllowed = Array.isArray(integration.allowedWorkflowIds)
      ? Array.from(new Set([...integration.allowedWorkflowIds, workflow.id]))
      : [workflow.id];
    await updateIntegration(userId, integration.id, { allowedWorkflowIds: nextAllowed });
  }

  return {
    success: true,
    type: "info",
    message: `Workflow created: **${workflow.name}** (ID: \`${workflow.id}\`).`,
  };
}

/**
 * Handle workflow deletion
 */
async function handleDeleteWorkflow(
  userId: string,
  integration: any,
  workflowNameOrId: string
): Promise<ChatIntegrationResponse> {
  const trimmed = workflowNameOrId.trim();
  if (!trimmed) {
    return {
      success: false,
      type: "error",
      message: "Please specify a workflow name or ID. Example: `/delete-workflow Daily Content`",
    };
  }

  const result = await workflowService.getWorkflows(userId, 1, 200);
  const allowedIds = resolveAllowedWorkflowIds(integration);
  const candidates = allowedIds
    ? result.workflows.filter((w: any) => allowedIds.includes(w.id))
    : result.workflows;

  const workflow = candidates.find(
    (w: any) =>
      w.id === trimmed ||
      w.name.toLowerCase() === trimmed.toLowerCase() ||
      w.name.toLowerCase().includes(trimmed.toLowerCase())
  );

  if (!workflow) {
    return {
      success: false,
      type: "error",
      message: `Workflow "${workflowNameOrId}" not found or not allowed for this integration.`,
    };
  }

  await workflowService.deleteWorkflow(workflow.id, userId);

  if (integration.scope === "ALLOW_LIST") {
    const nextAllowed = (integration.allowedWorkflowIds || []).filter(
      (id: string) => id !== workflow.id
    );
    await updateIntegration(userId, integration.id, { allowedWorkflowIds: nextAllowed });
  }

  if (integration.scope === "SINGLE_WORKFLOW" && integration.scopeWorkflowId === workflow.id) {
    await updateIntegration(userId, integration.id, {
      scopeWorkflowId: null,
      defaultWorkflowId: null,
      lastRunWorkflowId: null,
    });
  }

  return {
    success: true,
    type: "info",
    message: `Workflow deleted: **${workflow.name}**`,
  };
}

/**
 * Handle credential listing
 */
async function handleListCredentials(userId: string): Promise<ChatIntegrationResponse> {
  const result = await credentialService.getCredentials(userId, 1, 50);
  if (result.credentials.length === 0) {
    return {
      success: true,
      type: "info",
      message: "You don't have any credentials yet. Use /add-credential to create one.",
    };
  }

  const lines = result.credentials
    .map((c) => `• **${c.name}** (${c.type}) — \`${c.id}\``)
    .join("\n");

  return {
    success: true,
    type: "info",
    message: `**Credentials:**\n\n${lines}`,
  };
}

/**
 * Handle credential creation
 */
async function handleAddCredential(userId: string, args: string): Promise<ChatIntegrationResponse> {
  const parts = args.split(" ").filter(Boolean);
  const type = parts[0];
  const name = parts[1];
  const value = parts.slice(2).join(" ");

  if (!type || !name || !value) {
    return {
      success: false,
      type: "error",
      message:
        "Usage: /add-credential <TYPE> <NAME> <VALUE>. Example: /add-credential OPENAI MyKey sk-...",
    };
  }

  const credential = await credentialService.createCredential({
    userId,
    type,
    name,
    value,
  });

  return {
    success: true,
    type: "info",
    message: `Credential created: **${credential.name}** (${credential.type}) — \`${credential.id}\``,
  };
}

/**
 * Handle credential deletion
 */
async function handleDeleteCredential(
  userId: string,
  args: string
): Promise<ChatIntegrationResponse> {
  const id = args.trim();
  if (!id) {
    return {
      success: false,
      type: "error",
      message: "Usage: /delete-credential <credential_id>",
    };
  }

  await credentialService.deleteCredential(id, userId);
  return {
    success: true,
    type: "info",
    message: `Credential deleted: \`${id}\``,
  };
}

/**
 * Handle adding a skill
 */
async function handleAddSkill(userId: string, args: string): Promise<ChatIntegrationResponse> {
  const url = args.trim();
  if (!url) {
    return {
      success: false,
      type: "error",
      message: "Usage: /add-skill <url>. Example: /add-skill https://solana.com/SKILL.md",
    };
  }

  try {
    const content = await skillService.fetchSkillFromUrl(url);
    const metadata = skillService.parseSkillMetadata(content);
    const skill = await skillService.createSkill({
      userId,
      name: metadata.name,
      description: metadata.description,
      url,
      content,
    });

    return {
      success: true,
      type: "info",
      message: `Skill added: **${skill.name}** — \`${skill.id}\``,
    };
  } catch (error) {
    return {
      success: false,
      type: "error",
      message: error instanceof Error ? error.message : "Failed to add skill",
    };
  }
}

/**
 * Handle listing skills
 */
async function handleListSkills(userId: string): Promise<ChatIntegrationResponse> {
  try {
    const result = await skillService.getSkills(userId, 1, 50);
    if (result.skills.length === 0) {
      return {
        success: true,
        type: "info",
        message: "You don't have any skills yet. Use /add-skill <url> to add one.",
      };
    }

    const skillList = result.skills
      .map(
        (skill) =>
          `• **${skill.name}** — \`${skill.id}\`${skill.description ? `\n  ${skill.description}` : ""}`
      )
      .join("\n");

    return {
      success: true,
      type: "info",
      message: `**Your Skills (${result.total}):**\n\n${skillList}`,
    };
  } catch (error) {
    return {
      success: false,
      type: "error",
      message: error instanceof Error ? error.message : "Failed to list skills",
    };
  }
}

/**
 * Handle updating a skill
 */
async function handleUpdateSkill(userId: string, args: string): Promise<ChatIntegrationResponse> {
  const parts = args.trim().split(/\s+/);
  const id = parts[0];
  const url = parts.slice(1).join(" ");

  if (!id || !url) {
    return {
      success: false,
      type: "error",
      message:
        "Usage: /update-skill <skill_id> <url>. Example: /update-skill cm123abc https://solana.com/SKILL.md",
    };
  }

  try {
    const content = await skillService.fetchSkillFromUrl(url);
    const metadata = skillService.parseSkillMetadata(content);
    const skill = await skillService.updateSkill(userId, id, {
      name: metadata.name,
      description: metadata.description,
      url,
      content,
    });

    return {
      success: true,
      type: "info",
      message: `Skill updated: **${skill.name}** — \`${skill.id}\``,
    };
  } catch (error) {
    return {
      success: false,
      type: "error",
      message: error instanceof Error ? error.message : "Failed to update skill",
    };
  }
}

/**
 * Handle removing a skill
 */
async function handleRemoveSkill(userId: string, args: string): Promise<ChatIntegrationResponse> {
  const id = args.trim();
  if (!id) {
    return {
      success: false,
      type: "error",
      message: "Usage: /remove-skill <skill_id>",
    };
  }

  try {
    await skillService.deleteSkill(userId, id);
    return {
      success: true,
      type: "info",
      message: `Skill removed: \`${id}\``,
    };
  } catch (error) {
    return {
      success: false,
      type: "error",
      message: error instanceof Error ? error.message : "Failed to remove skill",
    };
  }
}

/**
 * Handle running a workflow
 */
async function handleRunWorkflow(
  userId: string,
  integration: any,
  workflowNameOrId: string,
  message: ChatIntegrationMessage
): Promise<ChatIntegrationResponse> {
  try {
    const trimmed = workflowNameOrId.trim();
    let workflow: any | null = null;
    const allowedIds = resolveAllowedWorkflowIds(integration);

    if (!trimmed) {
      if (integration.scope === "SINGLE_WORKFLOW" && integration.scopeWorkflowId) {
        try {
          workflow = await workflowService.getWorkflow(integration.scopeWorkflowId, userId);
        } catch (error) {
          return {
            success: false,
            type: "error",
            message: "Configured workflow not found. Update your Chat Integration integration.",
          };
        }
      } else {
        const fallbackId = integration.lastRunWorkflowId || integration.defaultWorkflowId;
        const candidateId =
          allowedIds && allowedIds.length > 0
            ? allowedIds.includes(fallbackId)
              ? fallbackId
              : allowedIds[0]
            : fallbackId;
        if (!candidateId) {
          return {
            success: false,
            type: "error",
            message: "Please specify a workflow name or ID. Example: `/run My Workflow`",
          };
        }
        try {
          workflow = await workflowService.getWorkflow(candidateId, userId);
        } catch (error) {
          return {
            success: false,
            type: "error",
            message: "Default workflow not found. Use /workflows to select a workflow.",
          };
        }
      }
    } else {
      // Try to find workflow by name or ID
      const result = await workflowService.getWorkflows(userId, 1, 200);
      const candidates = allowedIds
        ? result.workflows.filter((w: any) => allowedIds.includes(w.id))
        : result.workflows;
      workflow = candidates.find(
        (w: any) =>
          w.id === trimmed ||
          w.name.toLowerCase() === trimmed.toLowerCase() ||
          w.name.toLowerCase().includes(trimmed.toLowerCase())
      );
      if (!workflow && integration.defaultWorkflowId) {
        try {
          if (!allowedIds || allowedIds.includes(integration.defaultWorkflowId)) {
            workflow = await workflowService.getWorkflow(integration.defaultWorkflowId, userId);
          }
        } catch (error) {
          workflow = null;
        }
      }
      if (!workflow) {
        return {
          success: false,
          type: "error",
          message: `Workflow "${workflowNameOrId}" not found. Use /workflows to see available workflows.`,
        };
      }
    }

    if (!isWorkflowAllowed(integration, workflow.id)) {
      return {
        success: false,
        type: "error",
        message: "This workflow is not allowed for the current Chat Integration integration.",
      };
    }

    await updateIntegration(userId, integration.id, { lastRunWorkflowId: workflow.id });

    // Trigger workflow execution via Inngest
    const chatId = (message.metadata as any)?.chatId?.toString();
    const telegramPayload = (message.metadata as any)?.telegramPayload;

    // If we have a chatId + bot token, send results asynchronously
    if (chatId && integration?.telegramBotToken) {
      void (async () => {
        const result = await runWorkflowAndWait({
          workflowId: workflow.id,
          userId,
          message: message.message,
          telegramPayload,
        });

        if (result.success) {
          const output = result.output as Record<string, unknown>;
          const mediaItems = extractMediaItems(output);
          const photos = mediaItems.filter((m) => m.type === "photo");
          const nonPhotos = mediaItems.filter((m) => m.type !== "photo");

          if (photos.length > 0) {
            await sendTelegramPhotoAlbum(
              integration.telegramBotToken,
              chatId,
              photos,
              photos.length > 1
                ? `**Workflow completed.** ${photos.length} image(s).`
                : `**Workflow completed.** Output (${photos[0].label}).`
            );
          }
          for (const item of nonPhotos) {
            await sendTelegramMedia(integration.telegramBotToken, chatId, item);
          }
          const summary = await buildResultSummaryWithAgent({
            output,
            userId,
            workflowId: workflow.id,
          });
          await sendTelegramMessage(integration.telegramBotToken, chatId, summary);
        } else {
          await sendTelegramMessage(
            integration.telegramBotToken,
            chatId,
            `Workflow failed: ${result.error}`
          );
        }
      })();

      return {
        success: true,
        type: "workflow",
        message: `Running **${workflow.name}**... I’ll send results when it completes.`,
        data: {
          workflowId: workflow.id,
          workflowName: workflow.name,
        },
      };
    }

    // If WhatsApp, run workflow and send result via connector
    if (chatId && integration?.platform === "WHATSAPP" && integration.id) {
      void (async () => {
        const result = await runWorkflowAndWait({
          workflowId: workflow.id,
          userId,
          message: message.message,
          telegramPayload: undefined,
          whatsappPayload: (message.metadata as any)?.whatsappPayload,
        });
        const summary = result.success
          ? await buildResultSummaryWithAgent({
              output: result.output as Record<string, unknown>,
              userId,
              workflowId: workflow.id,
            })
          : `Workflow failed: ${result.error}`;
        await sendWhatsAppViaConnector({
          sessionRef: integration.id,
          toJid: chatId,
          text: formatWhatsAppMessage(summary),
        });
      })();
      return {
        success: true,
        type: "workflow",
        message: `Running **${workflow.name}**... I'll send results when it completes.`,
        data: {
          workflowId: workflow.id,
          workflowName: workflow.name,
        },
      };
    }

    // If Slack, run workflow and send result via Slack Web API
    if (chatId && integration?.platform === "SLACK" && integration.slackBotToken) {
      const threadTs = (message.metadata as any)?.threadTs;
      void (async () => {
        const result = await runWorkflowAndWait({
          workflowId: workflow.id,
          userId,
          message: message.message,
        });
        const summary = result.success
          ? await buildResultSummaryWithAgent({
              output: result.output as Record<string, unknown>,
              userId,
              workflowId: workflow.id,
            })
          : `Workflow failed: ${result.error}`;
        await sendSlackMessage(
          integration.slackBotToken!,
          chatId,
          formatSlackMessage(summary),
          threadTs
        );
      })();
      return {
        success: true,
        type: "workflow",
        message: `Running **${workflow.name}**... I'll send results when it completes.`,
        data: {
          workflowId: workflow.id,
          workflowName: workflow.name,
        },
      };
    }

    // If Discord, run workflow and send result via Discord connector
    if (chatId && integration?.platform === "DISCORD" && integration.id) {
      void (async () => {
        const result = await runWorkflowAndWait({
          workflowId: workflow.id,
          userId,
          message: message.message,
        });
        const summary = result.success
          ? await buildResultSummaryWithAgent({
              output: result.output as Record<string, unknown>,
              userId,
              workflowId: workflow.id,
            })
          : `Workflow failed: ${result.error}`;
        const formatted = formatDiscordMessage(summary);
        const chunks = splitDiscordMessage(formatted);
        for (const chunk of chunks) {
          await sendDiscordViaConnector({
            integrationId: integration.id,
            channelId: chatId,
            text: chunk,
          });
        }
      })();
      return {
        success: true,
        type: "workflow",
        message: `Running **${workflow.name}**... I'll send results when it completes.`,
        data: {
          workflowId: workflow.id,
          workflowName: workflow.name,
        },
      };
    }

    // Fallback: trigger without async response
    await inngest.send({
      name: "workflow/trigger",
      data: {
        workflowId: workflow.id,
        userId,
        data: {
          source: "chat-integration",
        },
      },
    });

    return {
      success: true,
      type: "workflow",
      message: `Workflow **${workflow.name}** has been triggered!`,
      data: {
        workflowId: workflow.id,
        workflowName: workflow.name,
      },
    };
  } catch (error) {
    console.error("[ChatIntegration] Run workflow error:", error);
    return {
      success: false,
      type: "error",
      message: error instanceof Error ? error.message : "Failed to run workflow",
    };
  }
}

/**
 * Process message with streaming (for SSE responses)
 */
export async function* processMessageStreaming(
  userId: string,
  integration: any,
  message: ChatIntegrationMessage
): AsyncGenerator<{ type: string; data?: unknown }> {
  const text = message.message.trim();
  const lowerText = text.toLowerCase();

  // Commands don't stream
  if (lowerText.startsWith("/")) {
    const result = await handleCommand(userId, integration, text, message);
    yield { type: "complete", data: result };
    return;
  }

  if (!integration.allowPlanMode) {
    yield {
      type: "complete",
      data: {
        success: false,
        type: "error",
        message: "Plan mode is disabled for this integration.",
      },
    };
    return;
  }

  // Check premium access before allowing plan mode
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionPlan: true },
  });

  if (!user || !hasPremiumAccess(user)) {
    yield {
      type: "complete",
      data: {
        success: false,
        type: "error",
        message: `**Plan Mode is a Premium Feature**

Plan Mode (AI assistant) requires a premium subscription. Upgrade plan to use this feature.

Visit your dashboard to upgrade: ${process.env.FRONTEND_URL}/billing`,
      },
    };
    return;
  }

  try {
    let workflowId = integration.defaultWorkflowId;

    if (!workflowId) {
      const workflow = await workflowService.createWorkflow({
        name: buildWorkflowName(message),
        userId,
      });
      workflowId = workflow.id;
      await updateIntegration(userId, integration.id, { defaultWorkflowId: workflowId });
    }

    // Build agent personality and skill config from integration
    const agentPersonality = {
      name: integration.label || "Verxio",
      soulMd: integration.soulMd || "",
      evolvePersonality: integration.evolvePersonality ?? false,
      integrationId: integration.id,
      skillScope: (integration.skillScope || "ALL_SKILLS") as "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS",
      allowedSkillIds: integration.allowedSkillIds || [],
    };

    // Stream from planning service
    for await (const event of sendPlanningMessageStreaming({
      workflowId,
      userId,
      message: message.message,
      attachments: message.attachments as any,
      agentPersonality,
    })) {
      yield event;
    }
  } catch (error) {
    console.error("[ChatIntegration] Streaming error:", error);
    yield {
      type: "error",
      data: error instanceof Error ? error.message : "Failed to process message",
    };
  }
}

/**
 * Test the integration connection
 */
export async function testConnection(
  userId: string,
  integrationId: string
): Promise<{
  success: boolean;
  message: string;
  integration?: any;
}> {
  try {
    const integration = await getIntegration(userId, integrationId);

    if (!integration) {
      return {
        success: false,
        message: "Chat Integration integration not found. Please set up the integration first.",
      };
    }
    if (integration.platform === "WHATSAPP") {
      if (!integration.isActive) {
        return {
          success: false,
          message: "Chat Integration integration is disabled.",
          integration,
        };
      }
      const { getWhatsAppSessionStatus, sendWhatsAppMessage } =
        await import("./whatsappConnectorClient");
      const session = await getOrCreateWhatsAppSession(integrationId);
      if (!session) {
        return {
          success: false,
          message: "WhatsApp session not found for this integration.",
          integration,
        };
      }
      const status = await getWhatsAppSessionStatus(session.id);
      if (!status) {
        return {
          success: true,
          message:
            "WhatsApp connector is not running or session not loaded. Start the connector and connect to see status.",
          integration: {
            whatsappSessionId: integration.whatsappSessionId,
            isActive: integration.isActive,
          },
        };
      }
      let testMessageSent = false;
      const { identities } = await getExternalIdentities(userId, integrationId);
      const waIdentity = identities.find((i: any) => i.platform === "whatsapp");
      let toJid = waIdentity?.externalId;
      if (!toJid && status.status === "open") {
        const sessionRow = await (prisma as any).whatsAppSession.findUnique({
          where: { id: session.id },
          select: { phoneNumber: true },
        });
        if (sessionRow?.phoneNumber) {
          toJid = `${String(sessionRow.phoneNumber).replace(/\D/g, "")}@s.whatsapp.net`;
        }
      }
      if (toJid && status.status === "open") {
        const result = await sendWhatsAppMessage({
          sessionRef: integration.id,
          toJid,
          text: "Connection test successful. Your Verxio integration is working.",
        });
        testMessageSent = result.success;
      }
      return {
        success: true,
        message: testMessageSent
          ? "A test message was sent to your WhatsApp."
          : status.status === "open"
            ? "WhatsApp is connected. Send a message to this number from your phone to chat, or use Test again to send a test message to the connected number."
            : `WhatsApp session status: ${status.status}. Scan the QR code to connect.`,
        integration: {
          whatsappSessionId: integration.whatsappSessionId,
          whatsappStatus: status.status,
          isActive: integration.isActive,
        },
      };
    }

    if (integration.platform !== "TELEGRAM") {
      return {
        success: false,
        message: "This integration is not Telegram-based.",
        integration,
      };
    }

    if (!integration.isActive) {
      return {
        success: false,
        message: "Chat Integration integration is disabled.",
        integration,
      };
    }

    if (!integration.telegramBotToken) {
      return {
        success: false,
        message: "Telegram bot token is missing. Please save a bot token first.",
        integration,
      };
    }

    const info = await getTelegramWebhookInfo(integration.telegramBotToken);
    const expectedUrl = getHostedTelegramWebhookUrl(integration.id);
    const webhookOk = info?.url === expectedUrl;

    if (!webhookOk) {
      return {
        success: false,
        message: "Telegram webhook is not configured correctly. Re-save the bot token.",
        integration: {
          webhookUrl: integration.webhookUrl,
          isActive: integration.isActive,
          allowPlanMode: integration.allowPlanMode,
          allowWorkflowExecution: integration.allowWorkflowExecution,
          totalRequests: integration.totalRequests,
          lastUsedAt: integration.lastUsedAt,
        },
      };
    }

    // Send a generic test message (no agent) so user can verify delivery without using tokens
    const genericTestMessage = "Connection test successful. Your Verxio integration is working.";
    let testMessageSent = false;
    try {
      const { identities } = await getExternalIdentities(userId, integrationId);
      const telegramIdentity = identities.find((i: any) => i.platform === "telegram");
      const chatId =
        telegramIdentity?.metadata?.chatId != null
          ? String(telegramIdentity.metadata.chatId)
          : telegramIdentity?.externalId;
      if (chatId && integration.telegramBotToken) {
        const formatted = formatTelegramMessage(genericTestMessage);
        const res = await fetch(
          `https://api.telegram.org/bot${integration.telegramBotToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: formatted,
              parse_mode: "HTML",
            }),
          }
        );
        testMessageSent = res.ok;
      }
    } catch (sendErr) {
      console.warn("[Chat Integration] Test message send failed:", sendErr);
    }

    return {
      success: true,
      message: testMessageSent
        ? "A test message was sent to your Telegram."
        : "Telegram webhook is configured and active. Link an account and message the bot to receive a test in Telegram.",
      integration: {
        webhookUrl: integration.webhookUrl,
        isActive: integration.isActive,
        allowPlanMode: integration.allowPlanMode,
        allowWorkflowExecution: integration.allowWorkflowExecution,
        totalRequests: integration.totalRequests,
        lastUsedAt: integration.lastUsedAt,
      },
    };
  } catch (error) {
    console.error("[ChatIntegration] Test connection error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to test connection",
    };
  }
}
