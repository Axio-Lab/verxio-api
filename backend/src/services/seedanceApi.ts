/**
 * Seedance (BytePlus) Video Generation API client.
 * Base URL: https://ark.ap-southeast.bytepluses.com/api/v3
 * Auth: Bearer token (ARK_API_KEY).
 */

const DEFAULT_BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3";

/** Default model id for workflow / API requests — keep in sync with BytePlus console. */
export const SEEDANCE_DEFAULT_MODEL = "dreamina-seedance-2-0-260128" as const;

export type SeedanceRatio = "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "adaptive";

/** Seedance 2.0 / 2.0 fast: 1080p not supported for this model. */
export type SeedanceResolution = "480p" | "720p";

export type SeedanceStatus = "queued" | "running" | "succeeded" | "failed" | "expired";

export type SeedanceContentItem =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      image_url: { url: string };
      role?: "first_frame" | "last_frame" | "reference_image";
    }
  | {
      type: "video_url";
      video_url: { url: string };
      role?: "reference_video";
    }
  | {
      type: "audio_url";
      audio_url: { url: string };
      role?: "reference_audio";
    }
  | {
      type: "draft_task";
      draft_task: { id: string };
    };

export type CreateSeedanceTaskRequest = {
  model: typeof SEEDANCE_DEFAULT_MODEL;
  content: SeedanceContentItem[];
  generate_audio?: boolean;
  ratio?: SeedanceRatio;
  duration?: number; // Allowed range depends on model; see BytePlus API docs
  resolution?: SeedanceResolution;
  seed?: number;
  camera_fixed?: boolean;
  watermark?: boolean;
  draft?: boolean; // When supported by the active model
  service_tier?: "default" | "flex";
  execution_expires_after?: number; // For flex tier
  return_last_frame?: boolean;
};

export type SeedanceTaskResponse = {
  id: string;
  model?: string;
  status?: SeedanceStatus;
  content?: {
    video_url?: string;
    last_frame_url?: string;
  };
  usage?: {
    completion_tokens?: number;
    total_tokens?: number;
  };
  created_at?: number;
  updated_at?: number;
  seed?: number;
  resolution?: string;
  ratio?: string;
  duration?: number;
  framespersecond?: number;
  service_tier?: string;
  execution_expires_after?: number;
  error?: {
    code?: string;
    message?: string;
  };
};

function getBaseUrl(): string {
  return process.env.BYTEPLUS_ARK_BASE_URL || DEFAULT_BASE_URL;
}

function getAuthHeader(): string {
  const apiKey = process.env.ARK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ARK_API_KEY is not configured");
  }
  return `Bearer ${apiKey}`;
}

async function seedanceFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<T> {
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

  const response = await fetch(url, {
    method,
    headers,
    body: fetchBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Seedance API error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
    } catch {
      errorMessage = `${errorMessage}\n${errorText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Create a video generation task
 */
export async function createSeedanceTask(
  request: CreateSeedanceTaskRequest
): Promise<{ id: string }> {
  return seedanceFetch<{ id: string }>("/contents/generations/tasks", {
    method: "POST",
    body: request,
  });
}

/**
 * Get task status and result
 */
export async function getSeedanceTask(taskId: string): Promise<SeedanceTaskResponse> {
  return seedanceFetch<SeedanceTaskResponse>(`/contents/generations/tasks/${taskId}`);
}

/**
 * Poll task until completion (succeeded, failed, or expired)
 */
export async function pollSeedanceTask(
  taskId: string,
  options: { intervalMs?: number; maxWaitMs?: number } = {}
): Promise<SeedanceTaskResponse> {
  const { intervalMs = 10000, maxWaitMs = 600000 } = options; // Default: 10s interval, 10min max
  const startTime = Date.now();

  while (true) {
    const task = await getSeedanceTask(taskId);
    const status = task.status;

    if (status === "succeeded" || status === "failed" || status === "expired") {
      return task;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= maxWaitMs) {
      throw new Error(`Seedance task ${taskId} did not complete within ${maxWaitMs}ms`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Upload an image file and return a URL
 * This uploads to the internal upload endpoint to get a public URL
 */
export async function uploadImageForSeedance(
  imageBase64: string,
  filename?: string
): Promise<string> {
  // Extract base64 data if it's a data URL
  let base64Data = imageBase64;
  if (imageBase64.startsWith("data:")) {
    base64Data = imageBase64.split(",")[1] || imageBase64;
  }

  const buffer = Buffer.from(base64Data, "base64");

  // Use FormData (available in Node.js 18+)
  const formData = new FormData();
  const blob = new Blob([buffer], { type: "image/png" });
  formData.append("file", blob, filename || "image.png");

  // Use the internal upload endpoint
  const uploadUrl = process.env.API_URL;
  const response = await fetch(`${uploadUrl}/api/public/chat/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image upload failed: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as { url?: string };
  if (!json?.url) {
    throw new Error("Image upload did not return a URL");
  }

  return json.url;
}

function guessVideoMimeFromFilename(filename?: string): string {
  const lower = (filename || "").toLowerCase();
  if (lower.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

function guessAudioMimeFromFilename(filename?: string): string {
  const lower = (filename || "").toLowerCase();
  if (lower.endsWith(".wav")) return "audio/wav";
  return "audio/mpeg";
}

/** Upload reference video (base64 or data URL) — BytePlus requires a public URL for video_url. */
export async function uploadVideoForSeedance(
  videoBase64: string,
  filename?: string
): Promise<string> {
  let base64Data = videoBase64;
  if (videoBase64.startsWith("data:")) {
    base64Data = videoBase64.split(",")[1] || videoBase64;
  }
  const buffer = Buffer.from(base64Data, "base64");
  const formData = new FormData();
  const mime = guessVideoMimeFromFilename(filename);
  const name = filename || "reference.mp4";
  formData.append("file", new Blob([buffer], { type: mime }), name);
  const uploadUrl = process.env.API_URL;
  const response = await fetch(`${uploadUrl}/api/public/chat/upload`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Video upload failed: ${response.status} ${errorText}`);
  }
  const json = (await response.json()) as { url?: string };
  if (!json?.url) throw new Error("Video upload did not return a URL");
  return json.url;
}

/** Upload reference audio (base64 or data URL). */
export async function uploadAudioForSeedance(
  audioBase64: string,
  filename?: string
): Promise<string> {
  let base64Data = audioBase64;
  if (audioBase64.startsWith("data:")) {
    base64Data = audioBase64.split(",")[1] || audioBase64;
  }
  const buffer = Buffer.from(base64Data, "base64");
  const formData = new FormData();
  const mime = guessAudioMimeFromFilename(filename);
  const name = filename || "reference.mp3";
  formData.append("file", new Blob([buffer], { type: mime }), name);
  const uploadUrl = process.env.API_URL;
  const response = await fetch(`${uploadUrl}/api/public/chat/upload`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Audio upload failed: ${response.status} ${errorText}`);
  }
  const json = (await response.json()) as { url?: string };
  if (!json?.url) throw new Error("Audio upload did not return a URL");
  return json.url;
}
