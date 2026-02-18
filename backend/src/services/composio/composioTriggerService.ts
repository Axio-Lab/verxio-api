import { Composio } from "@composio/core";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { basePrismaClient } from "@/lib/prisma";
import { NodeType } from "@/lib/node-types";

const prisma = basePrismaClient as any;
const COMPOSIO_API_BASE = "https://backend.composio.dev/api/v3";
const WEBHOOK_SCOPE = "global";
const ENABLED_EVENTS = ["composio.trigger.message"];

type ComposioTriggerNodeData = {
  variables?: string;
  composioTriggerSlug?: string;
  triggerConfig?: Record<string, unknown>;
  connectedAccountId?: string;
  enabled?: boolean;
  composioTriggerId?: string;
  composioTriggerStatus?: "active" | "disabled" | "sync_error" | "provisioning";
  composioTriggerError?: string;
  composioTriggerConfigHash?: string;
  composioLastSyncedAt?: string;
};

type WebhookSubscriptionRecord = {
  id: string;
  scope: string;
  subscriptionId: string | null;
  webhookUrl: string | null;
  secret: string | null;
  enabled: boolean;
  enabledEvents: unknown;
};

let composioClient: Composio | null = null;

function getComposioClient(): Composio | null {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return null;
  if (!composioClient) {
    composioClient = new Composio({ apiKey });
  }
  return composioClient;
}

function getWebhookEncryptionKey(): Buffer | null {
  const raw =
    process.env.COMPOSIO_WEBHOOK_SECRET_ENCRYPTION_KEY ||
    process.env.CHAT_CONVERSATION_ENCRYPTION_KEY ||
    "";
  if (!raw || raw.length < 16) return null;
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return scryptSync(raw, "verxio-composio-webhook-secret-salt", 32);
}

function encryptSecret(secret: string): string {
  const key = getWebhookEncryptionKey();
  if (!key) return secret;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1$${Buffer.concat([iv, tag, encrypted]).toString("base64url")}`;
}

function decryptSecret(secret: string | null): string | null {
  if (!secret) return null;
  if (!secret.startsWith("v1$")) return secret;
  const key = getWebhookEncryptionKey();
  if (!key) return null;
  try {
    const payload = Buffer.from(secret.slice(3), "base64url");
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
  } catch {
    return null;
  }
}

function getComposioWebhookUrl(): string | null {
  const apiUrl = process.env.API_URL?.trim();
  if (!apiUrl) return null;
  return `${apiUrl.replace(/\/$/, "")}/api/webhooks/composio`;
}

function normalizeTriggerConfig(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function stableHash(value: unknown): string {
  const normalize = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(normalize);
    if (obj && typeof obj === "object") {
      return Object.keys(obj)
        .sort()
        .reduce((acc: Record<string, unknown>, key) => {
          acc[key] = normalize(obj[key]);
          return acc;
        }, {});
    }
    return obj;
  };
  return JSON.stringify(normalize(value));
}

async function composioApiRequest(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>
): Promise<any> {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) throw new Error("COMPOSIO_API_KEY is not configured.");
  const response = await fetch(`${COMPOSIO_API_BASE}${path}`, {
    method,
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Composio API ${method} ${path} failed (${response.status}): ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function getGlobalWebhookSubscriptionRecord(): Promise<WebhookSubscriptionRecord | null> {
  return prisma.composioWebhookSubscription.findUnique({
    where: { scope: WEBHOOK_SCOPE },
  });
}

async function upsertGlobalWebhookSubscriptionRecord(
  data: Partial<WebhookSubscriptionRecord>
): Promise<void> {
  await prisma.composioWebhookSubscription.upsert({
    where: { scope: WEBHOOK_SCOPE },
    update: data,
    create: {
      scope: WEBHOOK_SCOPE,
      enabledEvents: ENABLED_EVENTS,
      ...data,
    },
  });
}

export async function ensureComposioWebhookSubscription(): Promise<{
  ok: boolean;
  subscriptionId?: string;
  webhookUrl?: string;
  error?: string;
}> {
  try {
    const webhookUrl = getComposioWebhookUrl();
    if (!webhookUrl) {
      return {
        ok: false,
        error: "API_URL is missing. Cannot create Composio webhook subscription endpoint.",
      };
    }

    const existing = await getGlobalWebhookSubscriptionRecord();

    // Create if missing
    if (!existing?.subscriptionId) {
      const created = await composioApiRequest("/webhook_subscriptions", "POST", {
        webhook_url: webhookUrl,
        enabled_events: ENABLED_EVENTS,
      });

      const subscriptionId = created?.id || created?.data?.id;
      const secret = created?.secret || created?.data?.secret;

      if (!subscriptionId || !secret) {
        throw new Error("Composio webhook subscription response missing id/secret.");
      }

      await upsertGlobalWebhookSubscriptionRecord({
        subscriptionId,
        webhookUrl,
        secret: encryptSecret(secret),
        enabled: true,
        enabledEvents: ENABLED_EVENTS,
      });

      return { ok: true, subscriptionId, webhookUrl };
    }

    // Keep webhook URL synced
    if (existing.webhookUrl !== webhookUrl) {
      await composioApiRequest(`/webhook_subscriptions/${existing.subscriptionId}`, "PATCH", {
        webhook_url: webhookUrl,
        enabled_events: ENABLED_EVENTS,
      });
      await upsertGlobalWebhookSubscriptionRecord({
        webhookUrl,
        enabledEvents: ENABLED_EVENTS,
      });
    }

    // Ensure secret exists; rotate if lost
    const decrypted = decryptSecret(existing.secret);
    if (!decrypted) {
      const rotated = await composioApiRequest(
        `/webhook_subscriptions/${existing.subscriptionId}/rotate_secret`,
        "POST"
      );
      const rotatedSecret = rotated?.secret || rotated?.data?.secret;
      if (!rotatedSecret) {
        throw new Error("Failed to rotate Composio webhook secret.");
      }
      await upsertGlobalWebhookSubscriptionRecord({
        secret: encryptSecret(rotatedSecret),
      });
    }

    return { ok: true, subscriptionId: existing.subscriptionId, webhookUrl };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown Composio webhook error",
    };
  }
}

export async function verifyComposioWebhook(rawBody: string, headers: Record<string, string>) {
  const client = getComposioClient();
  if (!client) {
    throw new Error("Composio client is not configured.");
  }

  const record = await getGlobalWebhookSubscriptionRecord();
  const secret = decryptSecret(record?.secret || null);
  if (!secret) {
    throw new Error("Composio webhook secret is not configured.");
  }

  return (client as any).triggers.verifyWebhook({
    id: headers["webhook-id"],
    payload: rawBody,
    signature: headers["webhook-signature"],
    timestamp: headers["webhook-timestamp"],
    secret,
  });
}

async function deleteActiveTrigger(triggerId: string): Promise<void> {
  const client = getComposioClient();
  if (!client || !triggerId) return;
  try {
    await (client as any).triggers.delete(triggerId);
  } catch (error) {
    console.warn(`[Composio Trigger] Failed to delete trigger ${triggerId}:`, error);
  }
}

async function disableActiveTrigger(triggerId: string): Promise<void> {
  const client = getComposioClient();
  if (!client || !triggerId) return;
  try {
    await (client as any).triggers.disable(triggerId);
  } catch (error) {
    console.warn(`[Composio Trigger] Failed to disable trigger ${triggerId}:`, error);
  }
}

async function upsertNodeData(nodeId: string, data: Record<string, unknown>): Promise<void> {
  await prisma.node.update({
    where: { id: nodeId },
    data: { data: data as any },
  });
}

async function provisionTriggerForNode(
  userId: string,
  nodeId: string,
  nodeData: ComposioTriggerNodeData
): Promise<ComposioTriggerNodeData> {
  const client = getComposioClient();
  if (!client) {
    return {
      ...nodeData,
      composioTriggerStatus: "sync_error",
      composioTriggerError: "Composio is not configured. Set COMPOSIO_API_KEY.",
      composioLastSyncedAt: new Date().toISOString(),
    };
  }

  const slug = (nodeData.composioTriggerSlug || "").trim();
  const triggerConfig = normalizeTriggerConfig(nodeData.triggerConfig);
  const configHash = stableHash({ slug, triggerConfig, connectedAccountId: nodeData.connectedAccountId });
  const existingTriggerId = nodeData.composioTriggerId;

  if (!slug) {
    return {
      ...nodeData,
      composioTriggerStatus: "sync_error",
      composioTriggerError: "composioTriggerSlug is required.",
      composioLastSyncedAt: new Date().toISOString(),
    };
  }

  try {
    await (client as any).triggers.getType(slug);
  } catch (error) {
    return {
      ...nodeData,
      composioTriggerStatus: "sync_error",
      composioTriggerError: `Unknown trigger slug: ${slug}`,
      composioLastSyncedAt: new Date().toISOString(),
    };
  }

  try {
    // Fast path: existing trigger with unchanged config
    if (existingTriggerId && nodeData.composioTriggerConfigHash === configHash) {
      await (client as any).triggers.enable(existingTriggerId);
      return {
        ...nodeData,
        composioTriggerStatus: "active",
        composioTriggerError: undefined,
        composioLastSyncedAt: new Date().toISOString(),
      };
    }

    if (existingTriggerId) {
      await deleteActiveTrigger(existingTriggerId);
    }

    const createArgs: Record<string, unknown> = {
      triggerConfig,
    };
    if (nodeData.connectedAccountId?.trim()) {
      createArgs.connectedAccountId = nodeData.connectedAccountId.trim();
    }

    const created = await (client as any).triggers.create(userId, slug, createArgs);
    const triggerId = created?.triggerId || created?.trigger_id || created?.id;
    if (!triggerId) {
      throw new Error("Composio trigger create response missing triggerId.");
    }

    return {
      ...nodeData,
      composioTriggerId: triggerId,
      composioTriggerStatus: "active",
      composioTriggerError: undefined,
      composioTriggerConfigHash: configHash,
      composioLastSyncedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ...nodeData,
      composioTriggerStatus: "sync_error",
      composioTriggerError:
        error instanceof Error ? error.message : "Failed to provision Composio trigger.",
      composioLastSyncedAt: new Date().toISOString(),
    };
  }
}

export async function reconcileWorkflowComposioTriggers(params: {
  workflowId: string;
  userId: string;
  nodes: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
  staleTriggerIds?: string[];
}): Promise<void> {
  const { userId, nodes, staleTriggerIds = [] } = params;

  const subscription = await ensureComposioWebhookSubscription();
  if (!subscription.ok) {
    // Persist sync errors to all composio trigger nodes and stop.
    const composioNodes = nodes.filter((n) => n.type === NodeType.COMPOSIO_TRIGGER);
    await Promise.all(
      composioNodes.map((node) =>
        upsertNodeData(node.id, {
          ...(node.data || {}),
          composioTriggerStatus: "sync_error",
          composioTriggerError: subscription.error || "Composio webhook setup failed.",
          composioLastSyncedAt: new Date().toISOString(),
        })
      )
    );
    return;
  }

  const activeTriggerIds = new Set<string>();

  for (const node of nodes) {
    if (node.type !== NodeType.COMPOSIO_TRIGGER) continue;
    const data = (node.data || {}) as ComposioTriggerNodeData;
    const enabled = data.enabled !== false;
    if (!enabled) {
      if (data.composioTriggerId) {
        await disableActiveTrigger(data.composioTriggerId);
      }
      await upsertNodeData(node.id, {
        ...data,
        composioTriggerStatus: "disabled",
        composioTriggerError: undefined,
        composioLastSyncedAt: new Date().toISOString(),
      });
      continue;
    }

    const updated = await provisionTriggerForNode(userId, node.id, data);
    if (updated.composioTriggerId && updated.composioTriggerStatus === "active") {
      activeTriggerIds.add(updated.composioTriggerId);
    }
    await upsertNodeData(node.id, updated as Record<string, unknown>);
  }

  for (const staleId of staleTriggerIds) {
    if (!staleId || activeTriggerIds.has(staleId)) continue;
    await deleteActiveTrigger(staleId);
  }
}

export async function cleanupWorkflowComposioTriggers(triggerIds: string[]): Promise<void> {
  await Promise.all(triggerIds.filter(Boolean).map((id) => deleteActiveTrigger(id)));
}
