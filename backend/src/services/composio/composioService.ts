import { Composio } from "@composio/core";

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;

let composioClient: Composio | null = null;

/**
 * Resolve the correct tool slug directly from Composio's toolkit registry.
 * Queries the toolkit's available tools and picks the best match by token overlap.
 */
async function resolveToolSlug(client: Composio, requestedSlug: string): Promise<string | null> {
  try {
    const rawClient = client.getClient();
    const toolkitPrefix = requestedSlug.split("_")[0]?.toLowerCase();
    if (!toolkitPrefix) return null;

    const response: any = await rawClient.tools
      .list({
        toolkit_slug: toolkitPrefix,
        limit: 1000,
        include_deprecated: false,
      })
      .catch(() => null);

    const tools = Array.isArray(response?.items) ? response.items : [];
    if (tools.length === 0) return null;

    const upper = requestedSlug.toUpperCase();

    // Exact match first
    const exact = tools.find((t: any) => String(t?.slug || "").toUpperCase() === upper);
    if (exact) return String(exact.slug).toUpperCase();

    // Fuzzy: score candidates by shared token overlap
    const reqTokens = new Set(
      upper
        .replace(/[^A-Z0-9]+/g, " ")
        .split(" ")
        .filter(Boolean)
    );

    let best: { slug: string; score: number } | null = null;
    for (const tool of tools) {
      const slug = String(tool?.slug || "").toUpperCase();
      if (!slug) continue;
      const candTokens = new Set(
        `${slug} ${String(tool?.name || "")}`
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, " ")
          .split(" ")
          .filter(Boolean)
      );

      let score = 0;
      for (const t of reqTokens) if (candTokens.has(t)) score += 3;
      if (slug.includes(upper)) score += 6;
      if (upper.includes(slug)) score += 4;

      if (!best || score > best.score) best = { slug, score };
    }

    if (!best || best.score < 6) return null;
    return best.slug;
  } catch {
    return null;
  }
}

function getClient(): Composio | null {
  if (!COMPOSIO_API_KEY) {
    return null;
  }
  if (!composioClient) {
    composioClient = new Composio({ apiKey: COMPOSIO_API_KEY });
  }
  return composioClient;
}

function requireClient(): Composio {
  const client = getClient();
  if (!client) {
    throw new Error("Composio is not configured. Set COMPOSIO_API_KEY in your environment.");
  }
  return client;
}

/**
 * Get a Composio MCP URL scoped to a specific user.
 * Returns null if COMPOSIO_API_KEY is not configured or if the service is unavailable.
 */
export async function getComposioMcpUrl(userId: string): Promise<string | null> {
  try {
    const client = getClient();
    if (!client) {
      return null;
    }

    const session = await client.create(userId);
    const mcpUrl = session.mcp?.url;
    if (!mcpUrl) {
      console.warn("[Composio] Session created but no MCP URL returned for user:", userId);
      return null;
    }

    return mcpUrl;
  } catch (error) {
    console.error("[Composio] Failed to get MCP URL for user:", userId, error);
    return null;
  }
}

/**
 * Execute a single Composio action on behalf of a user.
 * Resolves tool slugs directly from Composio's registry on TOOL_NOT_FOUND,
 * so we never need a static alias map.
 */
export async function executeComposioAction(
  userId: string,
  actionName: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const client = requireClient();
  const slug = actionName.toUpperCase();

  try {
    return await (client as any).tools.execute(slug, {
      userId,
      arguments: params,
      dangerouslySkipVersionCheck: true,
    });
  } catch (error: any) {
    const isNotFound = String(error?.code || "").includes("TOOL_NOT_FOUND");
    if (!isNotFound) {
      console.error(`[Composio] Action "${slug}" failed for user ${userId}:`, error);
      throw error;
    }

    // Slug not found — resolve the correct one from Composio's toolkit registry
    const resolved = await resolveToolSlug(client, slug);
    if (!resolved || resolved === slug) {
      console.error(
        `[Composio] Action "${slug}" not found and no matching tool discovered for user ${userId}`
      );
      throw error;
    }

    console.warn(`[Composio] Resolved "${slug}" → "${resolved}" for user ${userId}`);
    return await (client as any).tools.execute(resolved, {
      userId,
      arguments: params,
      dangerouslySkipVersionCheck: true,
    });
  }
}

// ============================================
// Connected Accounts Management
// ============================================

export interface ComposioConnectedAccount {
  id: string;
  appSlug: string;
  status: string;
  createdAt?: string;
}

/**
 * List a user's connected Composio accounts (ACTIVE only by default).
 */
export async function listConnectedAccounts(userId: string): Promise<ComposioConnectedAccount[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const response = await client.connectedAccounts.list({
      userIds: [userId],
      statuses: ["ACTIVE"],
    });
    return (response.items || []).map((item: any) => ({
      id: item.id,
      appSlug: item.toolkit?.slug || "unknown",
      status: item.status || "UNKNOWN",
      createdAt: item.createdAt,
    }));
  } catch (error) {
    console.error("[Composio] Failed to list connected accounts for user:", userId, error);
    return [];
  }
}

/**
 * Get a single connected account by ID.
 */
export async function getConnectedAccount(accountId: string): Promise<any> {
  const client = requireClient();
  return client.connectedAccounts.get(accountId);
}

/**
 * Delete (disconnect) a connected account.
 */
export async function deleteConnectedAccount(accountId: string): Promise<any> {
  const client = requireClient();
  return client.connectedAccounts.delete(accountId);
}

export interface ComposioApp {
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
  categories: string[];
  noAuth: boolean;
}

function normalizeCategories(categories: unknown): string[] {
  if (!Array.isArray(categories)) return [];
  return categories
    .map((category: any) => {
      if (typeof category === "string") return category;
      if (category && typeof category === "object") {
        return category.name || category.slug || "";
      }
      return "";
    })
    .filter((value: string) => value.length > 0);
}

/**
 * List all available Composio apps/toolkits for connection.
 * The SDK returns a plain array with no pagination metadata,
 * so we request a high limit to fetch everything in one call.
 */
export async function listAvailableApps(): Promise<ComposioApp[]> {
  const client = requireClient();
  const response: any = await client.toolkits.get({ limit: 2000 });
  const items = Array.from(response || []);
  return items.map((item: any) => ({
    slug: item.slug,
    name: item.name,
    description: item.meta?.description || "",
    logoUrl: item.meta?.logo || null,
    categories: normalizeCategories(item.meta?.categories),
    noAuth: !!item.noAuth,
  }));
}

/**
 * Get detailed information for a specific Composio toolkit/app.
 */
export async function getAppDetails(appSlug: string): Promise<any> {
  const client = requireClient();
  const rawClient = client.getClient();
  const normalizedSlug = appSlug.toUpperCase();

  const toolkit =
    (await client.toolkits.get(appSlug).catch(async () => {
      if (normalizedSlug !== appSlug) {
        return client.toolkits.get(normalizedSlug);
      }
      throw new Error(`Toolkit not found for slug: ${appSlug}`);
    })) || null;

  const toolkitSlug = String(toolkit?.slug || normalizedSlug).toLowerCase();

  // Try @composio/core wrapper APIs first.
  let toolItems = await (client as any).tools
    ?.getRawComposioTools?.({
      toolkits: [toolkitSlug],
      limit: 1000,
      important: false,
    })
    .catch(() => []);

  let triggerItems = await (client as any).triggers
    ?.listTypes?.({
      toolkits: [toolkitSlug],
      limit: 1000,
    })
    .then((response: any) => response?.items || [])
    .catch(() => []);

  // Fallback for toolkits where wrapper APIs can return empty but metadata has counts.
  if (
    (!Array.isArray(toolItems) || toolItems.length === 0) &&
    (toolkit?.meta?.toolsCount || 0) > 0
  ) {
    const rawToolsResponse: any = await rawClient.tools
      .list({
        toolkit_slug: toolkitSlug,
        limit: 1000,
        include_deprecated: false,
      })
      .catch(() => null);
    if (Array.isArray(rawToolsResponse?.items)) {
      toolItems = rawToolsResponse.items;
    }
  }

  if (
    (!Array.isArray(triggerItems) || triggerItems.length === 0) &&
    (toolkit?.meta?.triggersCount || 0) > 0
  ) {
    const rawTriggersResponse: any = await rawClient.triggersTypes
      .list({
        toolkit_slugs: [toolkitSlug],
        limit: 1000,
      })
      .catch(() => null);
    if (Array.isArray(rawTriggersResponse?.items)) {
      triggerItems = rawTriggersResponse.items;
    }
  }

  const safeToolItems = Array.isArray(toolItems) ? toolItems : [];
  const safeTriggerItems = Array.isArray(triggerItems) ? triggerItems : [];

  const authSchemes = toolkit?.composioManagedAuthSchemes || [];
  const isMcpToolkit = toolkitSlug.endsWith("_mcp") || authSchemes.includes("DCR_OAUTH");

  return {
    toolkit,
    isMcpToolkit,
    tools: {
      count: toolkit?.meta?.toolsCount ?? safeToolItems.length,
      items: safeToolItems.map((tool: any) => ({
        slug: tool.slug,
        name: tool.name,
        description: tool.description || "",
      })),
    },
    triggers: {
      count: toolkit?.meta?.triggersCount ?? safeTriggerItems.length,
      items: safeTriggerItems.map((trigger: any) => ({
        slug: trigger.slug,
        name: trigger.name,
        description: trigger.description || "",
      })),
    },
  };
}

/**
 * Initiate an OAuth/connection flow for a Composio app.
 * Uses session.authorize() so we can control the callbackUrl and
 * always return users to the /connections page in the dashboard UI.
 */
export async function initiateAppConnection(
  userId: string,
  appSlug: string
): Promise<{ redirectUrl: string | null; connectionId: string }> {
  const client = requireClient();

  const appBaseUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  // Ensure no trailing slash before appending the route.
  const normalizedBase = appBaseUrl.replace(/\/+$/, "");
  const callbackUrl = `${normalizedBase}/connections`;

  // Create a session for this user and authorize the specific toolkit/app.
  const session: any = await (client as any).create(userId, {
    manageConnections: false,
  });

  const connectionRequest = await session.authorize(appSlug.toLowerCase(), {
    callbackUrl,
  });

  return {
    redirectUrl: connectionRequest.redirectUrl || null,
    connectionId: connectionRequest.id,
  };
}

/**
 * Check if Composio is configured and available.
 */
export function isComposioConfigured(): boolean {
  return !!COMPOSIO_API_KEY;
}
