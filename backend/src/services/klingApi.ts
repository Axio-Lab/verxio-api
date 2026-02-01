/**
 * Kling AI API client.
 * Base URL: https://api-singapore.klingai.com (or KLING_API_BASE_URL).
 * Auth: Bearer token (KLING_ACCESS_KEY).
 */

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
  const key = process.env.KLING_ACCESS_KEY;
  if (!key) {
    throw new Error("KLING_ACCESS_KEY is not configured");
  }
  return `Bearer ${key}`;
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
 */
export async function pollUntilDone(
  path: string,
  taskId: string,
  options: { intervalMs?: number; maxWaitMs?: number } = {}
): Promise<KlingTaskData> {
  const { intervalMs = 4000, maxWaitMs = 600000 } = options;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const task = await getTask(path, taskId);
    if (task.task_status === "succeed") {
      return task;
    }
    if (task.task_status === "failed") {
      throw new Error(task.task_status_msg || "Kling task failed");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
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
