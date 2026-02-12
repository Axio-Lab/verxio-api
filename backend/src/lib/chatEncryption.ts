/**
 * Encryption for chat/conversation history at rest.
 * Uses AES-256-GCM. Set CHAT_CONVERSATION_ENCRYPTION_KEY (32-byte hex or 32-char string) in env.
 * When key is not set, data is stored in plain form for backward compatibility.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const KEY_LEN = 32;
const AUTH_TAG_LEN = 16;
const PREFIX = "v1$";

function getKey(): Buffer | null {
  const raw = process.env.CHAT_CONVERSATION_ENCRYPTION_KEY;
  if (!raw || raw.length < 16) return null;
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return scryptSync(raw, "verxio-chat-salt", KEY_LEN);
}

/**
 * Encrypt a string (e.g. JSON.stringify(conversationHistory)).
 * Returns plain string if key not set.
 */
export function encryptConversationPayload(plain: string): string {
  const key = getKey();
  if (!key) return plain;

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv, { authTagLength: AUTH_TAG_LEN });
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64url");
}

/**
 * Decrypt a string stored in DB.
 * If value is not our encrypted format, returns as-is (for legacy plain or already-parsed).
 */
export function decryptConversationPayload(value: string | unknown): string {
  if (typeof value !== "string") return JSON.stringify(value);
  if (!value.startsWith(PREFIX)) return value;

  const key = getKey();
  if (!key) return value;

  try {
    const buf = Buffer.from(value.slice(PREFIX.length), "base64url");
    if (buf.length < IV_LEN + AUTH_TAG_LEN) return value;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const enc = buf.subarray(IV_LEN + AUTH_TAG_LEN);
    const decipher = createDecipheriv(ALG, key, iv, { authTagLength: AUTH_TAG_LEN });
    decipher.setAuthTag(tag);
    return decipher.update(enc) + decipher.final("utf8");
  } catch {
    return value;
  }
}

/**
 * Parse conversation history from DB value (encrypted string or legacy array).
 */
export function parseConversationHistory(
  value: unknown
): Array<{ role: string; content: string; timestamp?: string; attachments?: unknown }> {
  if (Array.isArray(value)) return value as any;
  const str = decryptConversationPayload(value);
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Serialize and optionally encrypt conversation history for storage.
 * Always returns a string (plain JSON or "v1$..." encrypted) for the DB String column.
 */
export function serializeConversationHistory(
  history: Array<{ role: string; content: string; timestamp?: string; attachments?: unknown }>
): string {
  const key = getKey();
  const json = JSON.stringify(history);
  if (!key) return json;
  return encryptConversationPayload(json);
}
