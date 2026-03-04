import { Composio } from "@composio/core";

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;

let composioClient: Composio | null = null;

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
 * Used by the COMPOSIO_ACTION workflow node executor.
 */
export async function executeComposioAction(
  userId: string,
  actionName: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const client = getClient();
  if (!client) {
    throw new Error("Composio is not configured. Set COMPOSIO_API_KEY in your environment.");
  }

  try {
    const normalizedActionName = actionName.toUpperCase();
    const providerPrefix = normalizedActionName.split("_")[0];
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

    const connectedAccounts = await listConnectedAccounts(userId);
    const connectedToolkits = Array.from(
      new Set(
        connectedAccounts
          .map((account) => String(account.appSlug || "").toLowerCase())
          .filter(Boolean)
      )
    );

    const matchedToolkit =
      connectedToolkits.find((slug) => normalize(slug) === normalize(providerPrefix)) ||
      connectedToolkits.find((slug) => normalize(slug).startsWith(normalize(providerPrefix))) ||
      connectedToolkits.find((slug) => normalize(providerPrefix).startsWith(normalize(slug))) ||
      providerPrefix.toLowerCase();

    // IMPORTANT: include toolkits in the session, otherwise only COMPOSIO_* meta tools may be returned.
    let session = await client.create(userId, {
      manageConnections: true,
      toolkits: [matchedToolkit],
    });
    let tools = await session.tools();

    const tool = tools.find(
      (t: any) => (t.name || t.function?.name || "").toUpperCase() === normalizedActionName
    );

    // Fallback: if a targeted toolkit session doesn't include the action, load all connected toolkits.
    let resolvedTool = tool;
    if (!resolvedTool && connectedToolkits.length > 0) {
      session = await client.create(userId, {
        manageConnections: true,
        toolkits: connectedToolkits,
      });
      tools = await session.tools();
      resolvedTool = tools.find(
        (t: any) => (t.name || t.function?.name || "").toUpperCase() === normalizedActionName
      );
    }

    if (!resolvedTool) {
      const availableToolNames = tools
        .map((t: any) => (t.name || t.function?.name || "").toUpperCase())
        .filter(Boolean);
      const providerMatches = availableToolNames
        .filter((name: string) => name.startsWith(`${providerPrefix}_`))
        .slice(0, 12);
      const sampleActions = availableToolNames.slice(0, 12);

      throw new Error(
        providerMatches.length > 0
          ? `Composio action "${actionName}" not found. Similar available actions: ${providerMatches.join(", ")}`
          : `Composio action "${actionName}" not found. The user needs to connect their ${providerPrefix} account first in Settings > Connections. Available actions sample: ${sampleActions.join(", ")}`
      );
    }

    const result = await (resolvedTool as any).execute(params);
    return result;
  } catch (error) {
    console.error(`[Composio] Failed to execute action "${actionName}" for user ${userId}:`, error);
    throw error;
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
 * Uses toolkits.authorize() which auto-resolves auth config for managed apps.
 */
export async function initiateAppConnection(
  userId: string,
  appSlug: string
): Promise<{ redirectUrl: string | null; connectionId: string }> {
  const client = requireClient();
  const connectionRequest = await client.toolkits.authorize(userId, appSlug);
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
