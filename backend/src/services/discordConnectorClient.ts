/**
 * Client to call the Discord Connector service (send message, start/stop sessions, etc.)
 */

const CONNECTOR_URL = process.env.DISCORD_CONNECTOR_URL || "http://localhost:3098";

export interface SendDiscordParams {
  integrationId: string;
  channelId: string;
  text: string;
  threadId?: string;
}

export interface SendDiscordResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendDiscordMessage(
  params: SendDiscordParams
): Promise<SendDiscordResult> {
  const res = await fetch(`${CONNECTOR_URL.replace(/\/$/, "")}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: data.error || res.statusText };
  }
  return data as SendDiscordResult;
}

export async function connectDiscordBot(
  integrationId: string,
  botToken: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${CONNECTOR_URL.replace(/\/$/, "")}/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ integrationId, botToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: data.error || res.statusText };
  }
  return data;
}

export async function disconnectDiscordBot(
  integrationId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${CONNECTOR_URL.replace(/\/$/, "")}/disconnect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ integrationId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: data.error || res.statusText };
  }
  return data;
}

export async function getDiscordBotStatus(
  integrationId: string
): Promise<{ status: string; guildCount?: number } | null> {
  const res = await fetch(
    `${CONNECTOR_URL.replace(/\/$/, "")}/status/${encodeURIComponent(integrationId)}`
  );
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  return data;
}

export function isDiscordConnectorConfigured(): boolean {
  return !!process.env.DISCORD_CONNECTOR_URL;
}
