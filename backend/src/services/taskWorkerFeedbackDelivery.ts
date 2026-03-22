/**
 * Deliver human-task worker feedback (HELP, READY replies, vetting messages) to chat platforms.
 * Uses the same markdown-like body from `handleIncomingSubmission` everywhere; chunks when needed
 * so WhatsApp (~4096), Discord (2000), Telegram (4096), Slack (4000) never truncate long HELP text.
 */

import {
  formatWhatsAppMessage,
  formatTelegramMessage,
  formatDiscordMessage,
  sendSlackMessage,
} from "@/services/chatIntegrationService";
import { sendWhatsAppMessage } from "@/services/whatsappConnectorClient";
import { sendDiscordMessage } from "@/services/discordConnectorClient";

/** Split at paragraph boundaries; falls back to single newlines or hard cut so chunks stay under maxLen. */
export function chunkTextByParagraphs(text: string, maxLen: number): string[] {
  const t = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  if (t.length <= maxLen) return [t];

  const out: string[] = [];
  let rest = t;
  while (rest.length > 0) {
    if (rest.length <= maxLen) {
      out.push(rest);
      break;
    }
    let cut = rest.lastIndexOf("\n\n", maxLen);
    if (cut < maxLen / 4) cut = rest.lastIndexOf("\n", maxLen);
    if (cut < maxLen / 4) cut = maxLen;
    const head = rest.slice(0, cut).trimEnd();
    if (head) out.push(head);
    rest = rest.slice(cut).trimStart();
  }
  return out;
}

const CHUNK_WA = 3500;
const CHUNK_TG = 3000;
const CHUNK_DC = 1900;
const CHUNK_SL = 3500;

export async function deliverTaskWorkerFeedbackWhatsApp(
  sessionRef: string,
  toJid: string,
  markdownBody: string
): Promise<void> {
  for (const chunk of chunkTextByParagraphs(markdownBody, CHUNK_WA)) {
    await sendWhatsAppMessage({
      sessionRef,
      toJid,
      text: formatWhatsAppMessage(chunk),
    });
  }
}

export async function deliverTaskWorkerFeedbackDiscord(options: {
  integrationId: string;
  channelId: string;
  markdownBody: string;
}): Promise<void> {
  const { integrationId, channelId, markdownBody } = options;
  for (const chunk of chunkTextByParagraphs(markdownBody, CHUNK_DC)) {
    await sendDiscordMessage({
      integrationId,
      channelId,
      text: formatDiscordMessage(chunk),
    });
  }
}

/**
 * `sendSlackMessage` applies `formatSlackMessage` — pass raw markdown chunks only (no double format).
 */
export async function deliverTaskWorkerFeedbackSlack(
  botToken: string,
  channel: string,
  threadTs: string | undefined,
  markdownBody: string
): Promise<void> {
  for (const chunk of chunkTextByParagraphs(markdownBody, CHUNK_SL)) {
    await sendSlackMessage(botToken, channel, chunk, threadTs);
  }
}

function normalizeTelegramChatId(chatId: string): string | number {
  const s = String(chatId).trim();
  return /^\d+$/.test(s) ? Number(s) : s;
}

/** One chunk: HTML parse mode with plain fallback (matches task-channel Telegram behavior). */
async function sendTelegramChunkHtml(
  botToken: string,
  chatId: string,
  markdownChunk: string
): Promise<void> {
  const formatted = formatTelegramMessage(markdownChunk);
  const cid = normalizeTelegramChatId(chatId);
  const payload: Record<string, unknown> = {
    chat_id: cid,
    text: formatted,
    parse_mode: "HTML",
  };
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data as { ok?: boolean }).ok === false) {
    const desc = (data as { description?: string }).description || response.statusText;
    if (String(desc).includes("parse") || String(desc).includes("entities")) {
      const plain = markdownChunk.replace(/\*\*/g, "").replace(/^#{1,6}\s+/gm, "");
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: cid, text: plain.slice(0, 4000) }),
      });
      return;
    }
    console.error(`[TaskWorkerFeedback Telegram] sendMessage failed: ${desc}`);
  }
}

export async function deliverTaskWorkerFeedbackTelegram(
  botToken: string,
  chatId: string,
  markdownBody: string
): Promise<void> {
  for (const chunk of chunkTextByParagraphs(markdownBody, CHUNK_TG)) {
    await sendTelegramChunkHtml(botToken, chatId, chunk);
  }
}
