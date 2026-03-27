import { executeComposioAction, isComposioConfigured } from "./composio/composioService";

// ─── Legacy types (used by agent goals) ─────────────────────────────────

export interface DeliveryAction {
  action: string;
  label: string;
  params?: Record<string, unknown>;
  enabled?: boolean;
}

// ─── Task report types ──────────────────────────────────────────────────

export interface ReportDestination {
  type: "whatsapp" | "telegram" | "slack" | "discord" | "gmail";
  enabled: boolean;
  whatsappNumber?: string;
  gmailTo?: string;
}

export interface DeliveryConfig {
  messagingChannel?: boolean;
  reportDocType?: "googledocs" | "notion";
  reportFolderId?: string;
  destinations?: ReportDestination[];
  /** @deprecated Used by agent goals — task reports use destinations instead */
  composioActions?: DeliveryAction[];
}

export interface ComposioDeliveryResult {
  action: string;
  label: string;
  delivered: boolean;
  documentUrl?: string;
  error?: string;
  result?: unknown;
}

export async function deliverToDestinations(
  userId: string,
  destinations: ReportDestination[],
  title: string,
  summaryWithLink: string
): Promise<ComposioDeliveryResult[]> {
  if (!destinations.length || !isComposioConfigured()) return [];

  const results: ComposioDeliveryResult[] = [];

  for (const dest of destinations) {
    if (!dest.enabled) continue;

    try {
      switch (dest.type) {
        case "telegram": {
          const result = await executeComposioAction(
            userId,
            "TELEGRAM_TELEGRAM_BOT_API_SEND_TEXT_MESSAGE",
            { text: `*${title}*\n\n${summaryWithLink}` }
          );
          results.push({ action: "TELEGRAM", label: "Telegram", delivered: true, result });
          break;
        }
        case "slack": {
          const result = await executeComposioAction(
            userId,
            "SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL",
            { text: `*${title}*\n\n${summaryWithLink}` }
          );
          results.push({ action: "SLACK", label: "Slack", delivered: true, result });
          break;
        }
        case "discord": {
          const result = await executeComposioAction(userId, "DISCORD_SEND_MESSAGE", {
            content: `**${title}**\n\n${summaryWithLink}`,
          });
          results.push({ action: "DISCORD", label: "Discord", delivered: true, result });
          break;
        }
        case "gmail": {
          if (!dest.gmailTo) break;
          const result = await executeComposioAction(userId, "GMAIL_SEND_EMAIL", {
            recipient_email: dest.gmailTo,
            subject: title,
            body: summaryWithLink,
          });
          results.push({ action: "GMAIL", label: "Gmail", delivered: true, result });
          break;
        }
        // WhatsApp is handled natively in taskReportService, not via Composio
      }
    } catch (err: any) {
      console.error(`[ComposioDelivery] ${dest.type} failed:`, err.message);
      results.push({
        action: dest.type.toUpperCase(),
        label: dest.type.charAt(0).toUpperCase() + dest.type.slice(1),
        delivered: false,
        error: err.message,
      });
    }
  }

  return results;
}

export async function createReportDocument(
  userId: string,
  docType: "googledocs" | "notion",
  title: string,
  content: string,
  folderId: string | null
): Promise<string | null> {
  if (!isComposioConfigured()) return null;

  try {
    if (docType === "notion") {
      const result = await executeComposioAction(userId, "NOTION_CREATE_PAGE", {
        title,
        content,
      });
      const parsed = result as any;
      return (
        parsed?.url ||
        parsed?.data?.url ||
        parsed?.response_data?.url ||
        (parsed?.id ? `https://notion.so/${parsed.id.replace(/-/g, "")}` : null)
      );
    }

    // Default: Google Docs
    const params: Record<string, unknown> = { title, text: content };
    if (folderId) params.folder_id = folderId;

    const result = await executeComposioAction(userId, "GOOGLEDOCS_CREATE_DOCUMENT", params);
    const parsed = result as any;
    const documentId =
      parsed?.documentId || parsed?.data?.documentId || parsed?.response_data?.documentId;

    if (documentId) {
      return `https://docs.google.com/document/d/${documentId}/edit`;
    }
    return parsed?.url || parsed?.data?.url || null;
  } catch (err: any) {
    console.error(`[ComposioDelivery] ${docType} document creation failed:`, err.message);
    return null;
  }
}

export function getAvailableDestinations(): { type: string; label: string }[] {
  return [
    { type: "whatsapp", label: "WhatsApp" },
    { type: "telegram", label: "Telegram" },
    { type: "slack", label: "Slack" },
    { type: "discord", label: "Discord" },
    { type: "gmail", label: "Gmail" },
  ];
}

// ─── Legacy functions (used by agent goals, not task reports) ────────────

export async function executeDeliveryActions(
  userId: string,
  config: DeliveryConfig | null | undefined,
  title: string,
  markdownContent: string
): Promise<ComposioDeliveryResult[]> {
  const actions = (config as any)?.composioActions as DeliveryAction[] | undefined;
  if (!actions?.length || !isComposioConfigured()) return [];

  const results: ComposioDeliveryResult[] = [];

  for (const action of actions) {
    if (action.enabled === false) continue;
    try {
      const params = buildLegacyActionParams(action, title, markdownContent);
      const result = await executeComposioAction(userId, action.action, params);
      const parsed = result as any;
      const documentId =
        parsed?.documentId || parsed?.data?.documentId || parsed?.response_data?.documentId;
      const documentUrl = documentId
        ? `https://docs.google.com/document/d/${documentId}/edit`
        : parsed?.url || parsed?.data?.url;
      results.push({
        action: action.action,
        label: action.label,
        delivered: true,
        documentUrl,
        result,
      });
    } catch (err: any) {
      console.error(`[ComposioDelivery] ${action.action} failed:`, err.message);
      results.push({
        action: action.action,
        label: action.label,
        delivered: false,
        error: err.message,
      });
    }
  }
  return results;
}

function buildLegacyActionParams(
  action: DeliveryAction,
  title: string,
  content: string
): Record<string, unknown> {
  const base = { ...(action.params || {}) };
  const upper = action.action.toUpperCase();
  if (upper.includes("GOOGLEDOCS")) return { ...base, title, text: content };
  if (upper.includes("GOOGLESHEETS")) return { ...base, title, data: content };
  if (upper.includes("NOTION")) return { ...base, title, content };
  if (upper.includes("GMAIL") || upper.includes("EMAIL"))
    return { ...base, subject: title, body: content };
  if (upper.includes("SLACK")) return { ...base, text: `*${title}*\n\n${content}` };
  if (upper.includes("DISCORD")) return { ...base, content: `**${title}**\n\n${content}` };
  return { ...base, title, content };
}

export function getAvailableDeliveryActions(): DeliveryAction[] {
  return [
    { action: "GOOGLEDOCS_CREATE_DOCUMENT", label: "Google Docs" },
    { action: "GMAIL_SEND_EMAIL", label: "Gmail" },
    { action: "SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL", label: "Slack (Composio)" },
    { action: "DISCORD_SEND_MESSAGE", label: "Discord (Composio)" },
  ];
}
