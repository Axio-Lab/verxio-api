/**
 * Seedream (BytePlus) Image Generation API client.
 * Base URL: https://ark.ap-southeast.bytepluses.com/api/v3
 * Auth: Bearer token (ARK_API_KEY).
 */

const DEFAULT_BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3";

export type SeedreamModel = "seedream-4-5-251128";

export type SeedreamSequentialImageGeneration = "disabled" | "auto";

export type SeedreamResponseFormat = "url" | "b64_json";

export type SeedreamImageSize = string; // e.g. "2K" or "2048x2048"

export type SeedreamSequentialOptions = {
  max_images?: number;
};

export type GenerateSeedreamImagesRequest = {
  model: SeedreamModel;
  prompt: string;
  /**
   * Single image URL or array of image URLs.
   * Backend helpers will always pass URLs (never base64) to the API.
   */
  image?: string | string[];
  size?: SeedreamImageSize;
  sequential_image_generation?: SeedreamSequentialImageGeneration;
  sequential_image_generation_options?: SeedreamSequentialOptions;
  response_format?: SeedreamResponseFormat;
  watermark?: boolean;
  stream?: boolean;
  optimize_prompt_options?: {
    mode?: "standard" | "fast";
  };
};

export type SeedreamImageData = {
  url?: string;
  b64_json?: string;
  size?: string;
};

export type GenerateSeedreamImagesResponse = {
  data: SeedreamImageData[];
  usage?: {
    total_tokens?: number;
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

async function seedreamFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<T> {
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const { method = "POST", body, headers: restHeaders } = options;

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
    let errorMessage = `Seedream API error: ${response.status} ${response.statusText}`;
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
 * Call the Seedream image generation endpoint.
 */
export async function generateSeedreamImages(
  request: GenerateSeedreamImagesRequest
): Promise<GenerateSeedreamImagesResponse> {
  return seedreamFetch<GenerateSeedreamImagesResponse>("/images/generations", {
    method: "POST",
    body: request,
  });
}

/**
 * Upload an image file and return a URL.
 * This uploads to the internal upload endpoint to get a public URL.
 */
export async function uploadImageForSeedream(
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

  const uploadUrl = process.env.API_URL;
  if (!uploadUrl) {
    throw new Error("API_URL is not configured for image upload");
  }

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
