/**
 * Client to call the WhatsApp Connector service (send message, start session, etc.)
 */

const CONNECTOR_URL = process.env.WHATSAPP_CONNECTOR_URL || "http://localhost:3099";

export interface SendWhatsAppParams {
  sessionRef: string;
  toJid: string;
  text: string;
  media?: { url: string; mimetype?: string; caption?: string };
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppMessage(params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
  const res = await fetch(`${CONNECTOR_URL.replace(/\/$/, "")}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionRef: params.sessionRef,
      toJid: params.toJid,
      text: params.text,
      media: params.media,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: data.error || res.statusText };
  }
  return data as SendWhatsAppResult;
}

export async function startWhatsAppSession(sessionId: string): Promise<{
  status: string;
  qr?: string;
  error?: string;
}> {
  const res = await fetch(
    `${CONNECTOR_URL.replace(/\/$/, "")}/session/${encodeURIComponent(sessionId)}/start`,
    { method: "POST" }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { status: "error", error: data.error || res.statusText };
  }
  return data;
}

export async function getWhatsAppSessionStatus(sessionId: string): Promise<{
  status: string;
  qr?: string;
} | null> {
  const res = await fetch(
    `${CONNECTOR_URL.replace(/\/$/, "")}/session/${encodeURIComponent(sessionId)}/status`
  );
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  return data;
}

export async function getWhatsAppSessionQr(sessionId: string): Promise<string | null> {
  const res = await fetch(
    `${CONNECTOR_URL.replace(/\/$/, "")}/session/${encodeURIComponent(sessionId)}/qr`
  );
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  return data.qr ?? null;
}

export function isConnectorConfigured(): boolean {
  return !!process.env.WHATSAPP_CONNECTOR_URL;
}
