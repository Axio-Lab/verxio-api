const TINYFISH_API_KEY = process.env.TINYFISH_API_KEY;
const BASE_URL = "https://agent.tinyfish.ai";

export interface TinyfishRunResult {
  run_id: string | null;
  status: "COMPLETED" | "FAILED";
  started_at: string | null;
  finished_at: string | null;
  num_of_steps: number;
  result: Record<string, unknown> | null;
  error: { message: string } | null;
}

export interface TinyfishOptions {
  browserProfile?: "lite" | "stealth";
  proxyCountry?: string;
}

function buildBody(url: string, goal: string, options?: TinyfishOptions) {
  const body: Record<string, unknown> = { url, goal };
  if (options?.browserProfile) {
    body.browser_profile = options.browserProfile;
  }
  if (options?.proxyCountry) {
    body.proxy_config = { enabled: true, country_code: options.proxyCountry };
  }
  return body;
}

function getHeaders(apiKeyOverride?: string): Record<string, string> {
  const key = apiKeyOverride || TINYFISH_API_KEY;
  if (!key) {
    throw new Error(
      "TinyFish API key is not configured. Provide a user credential or set TINYFISH_API_KEY."
    );
  }
  return {
    "Content-Type": "application/json",
    "X-API-Key": key,
  };
}

/**
 * Run a web automation synchronously. Blocks until the result is ready.
 * Best for workflow node execution where we need the final result.
 */
export async function runWebAutomation(
  url: string,
  goal: string,
  options?: TinyfishOptions,
  apiKeyOverride?: string
): Promise<TinyfishRunResult> {
  const res = await fetch(`${BASE_URL}/v1/automation/run`, {
    method: "POST",
    headers: getHeaders(apiKeyOverride),
    body: JSON.stringify(buildBody(url, goal, options)),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `TinyFish API error ${res.status}`;
    throw new Error(msg);
  }
  return data as TinyfishRunResult;
}

/**
 * Start a web automation asynchronously. Returns a run_id immediately.
 * Best for chat agent usage where we can poll for results.
 */
export async function runWebAutomationAsync(
  url: string,
  goal: string,
  options?: TinyfishOptions,
  apiKeyOverride?: string
): Promise<{ run_id: string }> {
  const res = await fetch(`${BASE_URL}/v1/automation/run-async`, {
    method: "POST",
    headers: getHeaders(apiKeyOverride),
    body: JSON.stringify(buildBody(url, goal, options)),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `TinyFish API error ${res.status}`;
    throw new Error(msg);
  }
  if (!data.run_id) {
    throw new Error(data.error?.message || "TinyFish did not return a run_id");
  }
  return { run_id: data.run_id };
}

/**
 * Get the status / result of a previously started async run.
 */
export async function getRunStatus(runId: string): Promise<TinyfishRunResult> {
  const res = await fetch(`${BASE_URL}/v1/runs/${encodeURIComponent(runId)}`, {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `TinyFish API error ${res.status}`;
    throw new Error(msg);
  }
  return data as TinyfishRunResult;
}

export function isTinyfishConfigured(): boolean {
  return !!TINYFISH_API_KEY;
}
