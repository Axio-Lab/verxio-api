import * as workflowService from "./workflowService";
import { getCredential } from "./credentialService";

/**
 * Validates that a workflow contains an Airtable trigger node
 * @param workflowId - The ID of the workflow to validate
 * @returns The Airtable trigger node if found
 * @throws Error if workflow or Airtable trigger node is not found
 */
export const validateAirtableTrigger = async (workflowId: string) => {
  // Get workflow without user validation (webhooks are public)
  const workflow = await workflowService.getWorkflowById(workflowId);

  // Find the Airtable trigger node in the workflow
  const airtableNode = workflow.nodes.find((node: any) => node.type === "AIRTABLE_TRIGGER");

  if (!airtableNode) {
    throw new Error("Airtable trigger node not found in workflow");
  }

  return {
    workflow,
    airtableNode,
  };
};

/**
 * Prepares Airtable webhook payload for workflow execution
 * @param airtablePayload - The raw payload from Airtable webhook
 * @returns Formatted payload ready for workflow context
 */
export const prepareAirtablePayload = (airtablePayload: any) => {
  // Airtable webhook payload structure:
  // {
  //   base: { id: "...", name: "..." },
  //   webhook: { id: "...", ... },
  //   eventTimestamp: "...",
  //   eventType: "create" | "update" | "delete",
  //   payload: {
  //     changedTablesById: { ... },
  //     changedFieldsById: { ... },
  //     createdRecordsById: { ... },
  //     changedRecordsById: { ... },
  //     destroyedRecordIds: { ... }
  //   }
  // }

  return {
    base: airtablePayload.base,
    webhook: airtablePayload.webhook,
    eventTimestamp: airtablePayload.eventTimestamp,
    eventType: airtablePayload.eventType, // "create", "update", or "delete"
    payload: airtablePayload.payload,
    raw: airtablePayload,
  };
};

/**
 * Gets Airtable API token from credential
 */
const getAirtableToken = async (credentialId: string, userId: string): Promise<string> => {
  const credential = await getCredential(credentialId, userId);
  if (!credential || credential.type !== "AIRTABLE") {
    throw new Error("Invalid Airtable credential");
  }

  // Parse credential value (can be JSON or plain token)
  let apiKey: string;
  try {
    try {
      const credentialData = JSON.parse(credential.value);
      apiKey = credentialData.apiKey || credentialData.accessToken;
    } catch {
      // If not JSON, treat the entire value as the token
      apiKey = credential.value.trim();
    }
    if (!apiKey) {
      throw new Error("Missing API key or access token in credential");
    }
  } catch (error) {
    throw new Error(
      `Invalid credential format: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return apiKey;
};

/**
 * Creates an Airtable webhook
 */
export const createAirtableWebhook = async (
  credentialId: string,
  userId: string,
  baseId: string,
  notificationUrl: string,
  tableId?: string
) => {
  const apiKey = await getAirtableToken(credentialId, userId);

  const specification: any = {
    options: {
      filters: {
        dataTypes: ["tableData"],
      },
    },
  };

  // Add table filter if specified
  if (tableId) {
    specification.options.filters.recordChangeScope = tableId;
  }

  const response = await fetch(`https://api.airtable.com/v0/bases/${baseId}/webhooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notificationUrl,
      specification,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Airtable API error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  return await response.json();
};

/**
 * Refreshes an Airtable webhook
 */
export const refreshAirtableWebhook = async (
  credentialId: string,
  userId: string,
  baseId: string,
  webhookId: string
) => {
  const apiKey = await getAirtableToken(credentialId, userId);

  const response = await fetch(
    `https://api.airtable.com/v0/bases/${baseId}/webhooks/${webhookId}/refresh`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Airtable API error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  return await response.json();
};

/**
 * Lists Airtable webhooks for a base
 */
export const listAirtableWebhooks = async (
  credentialId: string,
  userId: string,
  baseId: string
) => {
  const apiKey = await getAirtableToken(credentialId, userId);

  const response = await fetch(`https://api.airtable.com/v0/bases/${baseId}/webhooks`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Airtable API error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  return await response.json();
};

/**
 * Lists Airtable bases
 */
export const listAirtableBases = async (credentialId: string, userId: string) => {
  const apiKey = await getAirtableToken(credentialId, userId);

  const response = await fetch("https://api.airtable.com/v0/meta/bases", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Airtable API error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  return await response.json();
};

/**
 * Lists tables in an Airtable base
 */
export const listAirtableTables = async (credentialId: string, userId: string, baseId: string) => {
  const apiKey = await getAirtableToken(credentialId, userId);

  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Airtable API error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  return await response.json();
};

/**
 * Fetches webhook payloads from Airtable
 * @param credentialId - Airtable credential ID
 * @param userId - User ID
 * @param baseId - Airtable base ID
 * @param webhookId - Airtable webhook ID
 * @returns Webhook payloads array
 */
export const fetchAirtableWebhookPayloads = async (
  credentialId: string,
  userId: string,
  baseId: string,
  webhookId: string
) => {
  const apiKey = await getAirtableToken(credentialId, userId);
  const url = `https://api.airtable.com/v0/bases/${baseId}/webhooks/${webhookId}/payloads`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Airtable API error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  const rawResult = await response.json();

  // Handle different response formats
  let payloads: any[] = [];
  if (Array.isArray(rawResult)) {
    payloads = rawResult;
  } else if (rawResult && typeof rawResult === "object") {
    if (rawResult.payloads && Array.isArray(rawResult.payloads)) {
      payloads = rawResult.payloads;
    } else if (rawResult.records && Array.isArray(rawResult.records)) {
      payloads = rawResult.records;
    } else if (rawResult.data && Array.isArray(rawResult.data)) {
      payloads = rawResult.data;
    } else {
      // If it's an object but doesn't have a known array property, treat the object itself as a single payload
      payloads = [rawResult];
    }
  }
  return payloads;
};

/**
 * Deletes an Airtable webhook
 */
export const deleteAirtableWebhook = async (
  credentialId: string,
  userId: string,
  baseId: string,
  webhookId: string
) => {
  const apiKey = await getAirtableToken(credentialId, userId);

  const response = await fetch(
    `https://api.airtable.com/v0/bases/${baseId}/webhooks/${webhookId}/`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Airtable API error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage);
  }

  // DELETE requests typically return 204 No Content, but Airtable might return JSON
  if (response.status === 204) {
    return { success: true };
  }

  return await response.json();
};
