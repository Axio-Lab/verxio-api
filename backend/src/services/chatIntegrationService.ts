import { prisma } from "../lib/prisma";
import { generateSharedSecret } from "../middleware/chatIntegrationAuth";
import {
  sendPlanningMessage,
  sendPlanningMessageStreaming,
  clearPlanningConversation,
} from "./planningService";
import { simpleAgentQuery } from "./claude-agent/claudeAgentService";
import * as workflowService from "./workflowService";
import * as credentialService from "./credentialService";
import { inngest } from "../inngest";

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

  return (prisma as any).chatIntegration.update({
    where: { id: integration.id },
    data: {
      telegramBotToken: botToken,
      webhookUrl,
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
 * Get all external identities for a user
 */
export async function getExternalIdentities(userId: string, integrationId?: string) {
  return (prisma as any).externalIdentity.findMany({
    where: { userId, ...(integrationId ? { integrationId } : {}) },
    orderBy: { createdAt: "desc" },
  });
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
}) {
  const { workflowId, userId, message, telegramPayload } = options;

  const workflow = await workflowService.getWorkflow(workflowId, userId);
  const nodes = workflow.nodes || [];
  const telegramTrigger = nodes.find((n: any) => n.type === "TELEGRAM_TRIGGER");
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

    // Send message to planning service
    const result = await sendPlanningMessage({
      workflowId,
      userId,
      message: message.message,
      attachments: attachments as any,
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

    // Stream from planning service
    for await (const event of sendPlanningMessageStreaming({
      workflowId,
      userId,
      message: message.message,
      attachments: message.attachments as any,
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
    const genericTestMessage =
      "Connection test successful. Your Verxio integration is working.";
    let testMessageSent = false;
    try {
      const identities = await getExternalIdentities(userId, integrationId);
      const telegramIdentity = identities.find(
        (i: any) => i.platform === "telegram"
      );
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
