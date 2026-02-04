/**
 * Kling AI API client.
 * Base URL: https://api-singapore.klingai.com (or KLING_API_BASE_URL).
 * Auth: Bearer token (KLING_ACCESS_KEY).
 */

import crypto from "crypto";

const DEFAULT_BASE_URL = "https://api-singapore.klingai.com";

export type KlingApiResponse<T = unknown> = {
  code: number;
  message: string;
  request_id?: string;
  data: T;
};

export type KlingTaskData = {
  task_id: string;
  task_status: "submitted" | "processing" | "succeed" | "failed";
  task_status_msg?: string;
  task_info?: { external_task_id?: string };
  created_at?: number;
  updated_at?: number;
  task_result?: {
    videos?: Array<{ id: string; url: string; duration?: string }>;
    images?: Array<{ index: number; url: string }>;
    audios?: Array<{
      id: string;
      url?: string;
      url_mp3?: string;
      url_wav?: string;
      duration?: string;
      duration_mp3?: string;
      duration_wav?: string;
    }>;
  };
};

function getBaseUrl(): string {
  return process.env.KLING_API_BASE_URL || DEFAULT_BASE_URL;
}

function getAuthHeader(): string {
  const rawKey = process.env.KLING_ACCESS_KEY;
  const key = rawKey?.trim();
  const rawSecret = process.env.KLING_SECRET_KEY;
  const secret = rawSecret?.trim();
  if (!key || !secret) {
    throw new Error("KLING_ACCESS_KEY or KLING_SECRET_KEY is not configured");
  }
  return `Bearer ${createKlingJwt(key, secret)}`;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createKlingJwt(accessKey: string, secretKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const payload = {
    iss: accessKey,
    exp: now + 1800,
    nbf: now - 5,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", secretKey).update(signingInput).digest();
  const encodedSignature = base64UrlEncode(signature);
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export async function klingFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<KlingApiResponse<T>> {
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const { method = "GET", body, headers: restHeaders } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: getAuthHeader(),
    ...restHeaders,
  };

  const fetchBody =
    body !== undefined && body !== null
      ? typeof body === "string"
        ? body
        : JSON.stringify(body)
      : undefined;

  const res = await fetch(url, {
    method,
    headers,
    ...(fetchBody !== undefined ? { body: fetchBody } : {}),
  });

  const json = (await res.json()) as KlingApiResponse<T>;
  if (json.code !== 0) {
    throw new Error(json.message || `Kling API error: ${res.status}`);
  }
  return json;
}

/** Response data shape for create-task endpoints (task_id, task_status). */
type KlingCreateTaskData = { task_id: string; task_status: string };

/**
 * Create a task (POST) and return task_id.
 */
export async function createTask<TBody extends Record<string, unknown>>(
  path: string,
  body: TBody
): Promise<{ task_id: string; task_status: string }> {
  const res = await klingFetch<KlingCreateTaskData>(path, { method: "POST", body });
  const d = res.data;
  return { task_id: d.task_id, task_status: d.task_status || "submitted" };
}

/**
 * Get task status and result (GET).
 */
export async function getTask(path: string, taskId: string): Promise<KlingTaskData> {
  const normalizedPath = path.replace(/\/$/, "");
  const url = `${normalizedPath}/${encodeURIComponent(taskId)}`;
  const res = await klingFetch<KlingTaskData>(url);
  return res.data as KlingTaskData;
}

/**
 * Poll until task succeeds or fails. Returns task result data.
 * Uses exponential backoff: starts at initialIntervalMs, increases by 1.5x each poll, capped at maxIntervalMs.
 */
export async function pollUntilDone(
  path: string,
  taskId: string,
  options: {
    initialIntervalMs?: number;
    maxIntervalMs?: number;
    maxWaitMs?: number;
    /** @deprecated Use initialIntervalMs. Kept for backward compatibility. */
    intervalMs?: number;
  } = {}
): Promise<KlingTaskData> {
  const {
    initialIntervalMs = 1000,
    maxIntervalMs = 8000,
    maxWaitMs = 600000,
    intervalMs: legacyIntervalMs,
  } = options;
  const start = Date.now();
  let interval = legacyIntervalMs ?? initialIntervalMs;

  while (Date.now() - start < maxWaitMs) {
    const task = await getTask(path, taskId);
    if (task.task_status === "succeed") {
      return task;
    }
    if (task.task_status === "failed") {
      throw new Error(task.task_status_msg || "Kling task failed");
    }
    await new Promise((r) => setTimeout(r, interval));
    interval = Math.min(interval * 1.5, maxIntervalMs);
  }

  throw new Error("Kling task timed out");
}

/** Resolve image to base64 (from URL, data URL, or raw base64). Used for image2video and image gen. */
export async function resolveImageSource(
  source: string,
  context: Record<string, unknown>,
  compileTemplate: (s: string) => string
): Promise<string | null> {
  try {
    let s = source;
    if (s.includes("{{") && s.includes("}}")) {
      s = compileTemplate(s);
    }
    if (s.startsWith("http://") || s.startsWith("https://")) {
      const res = await fetch(s, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.toString("base64");
    }
    if (s.startsWith("data:")) {
      const [, b64] = s.split(",");
      return b64 || null;
    }
    if (s.length > 100 && /^[A-Za-z0-9+/=]+$/.test(s)) return s;
    return null;
  } catch {
    return null;
  }
}
