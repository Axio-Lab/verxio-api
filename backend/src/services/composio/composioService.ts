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
    const session = await client.create(userId);
    const tools = await session.tools();

    const tool = tools.find(
      (t: any) => (t.name || t.function?.name || "").toUpperCase() === actionName.toUpperCase()
    );
    if (!tool) {
      throw new Error(
        `Composio action "${actionName}" not found. Ensure the user has connected the required app.`
      );
    }

    const result = await (tool as any).execute(params);
    return result;
  } catch (error) {
    console.error(`[Composio] Failed to execute action "${actionName}" for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Check if Composio is configured and available.
 */
export function isComposioConfigured(): boolean {
  return !!COMPOSIO_API_KEY;
}
