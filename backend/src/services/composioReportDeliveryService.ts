import { executeComposioAction, isComposioConfigured } from "./composio/composioService";

export interface DeliveryAction {
  action: string;
  label: string;
  params?: Record<string, unknown>;
  enabled?: boolean;
}

export interface DeliveryConfig {
  messagingChannel?: boolean;
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

export async function executeDeliveryActions(
  userId: string,
  config: DeliveryConfig | null | undefined,
  title: string,
  markdownContent: string
): Promise<ComposioDeliveryResult[]> {
  if (!config?.composioActions?.length || !isComposioConfigured()) {
    return [];
  }

  const results: ComposioDeliveryResult[] = [];

  for (const action of config.composioActions) {
    if (action.enabled === false) continue;

    try {
      const params = buildActionParams(action, title, markdownContent);
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

function buildActionParams(
  action: DeliveryAction,
  title: string,
  content: string
): Record<string, unknown> {
  const base = { ...(action.params || {}) };
  const actionUpper = action.action.toUpperCase();

  if (actionUpper.includes("GOOGLEDOCS")) {
    return { ...base, title, text: content };
  }
  if (actionUpper.includes("GOOGLESHEETS")) {
    return { ...base, title, data: content };
  }
  if (actionUpper.includes("NOTION")) {
    return { ...base, title, content };
  }
  if (actionUpper.includes("GMAIL") || actionUpper.includes("EMAIL")) {
    return { ...base, subject: title, body: content };
  }
  if (actionUpper.includes("SLACK")) {
    return { ...base, text: `*${title}*\n\n${content}` };
  }
  if (actionUpper.includes("DISCORD")) {
    return { ...base, content: `**${title}**\n\n${content}` };
  }
  return { ...base, title, content };
}

export function getAvailableDeliveryActions(): DeliveryAction[] {
  return [
    { action: "GOOGLEDOCS_CREATE_DOCUMENT", label: "Google Docs" },
    { action: "GOOGLESHEETS_CREATE_SPREADSHEET", label: "Google Sheets" },
    { action: "NOTION_CREATE_PAGE", label: "Notion" },
    { action: "GMAIL_SEND_EMAIL", label: "Gmail" },
    { action: "SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL", label: "Slack (Composio)" },
    { action: "DISCORD_SEND_MESSAGE", label: "Discord (Composio)" },
  ];
}
