import type { NodeExecutor } from "../types";
import { airtableTriggerChannel } from "@/inngest/channels/airtable-trigger";
import { fetchAirtableWebhookPayloads, listAirtableTables } from "@/services/airtableService";
import { NonRetriableError } from "inngest";

type AirtableTriggerData = Record<string, unknown>;

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    airtableTriggerChannel().status({
      nodeId,
      status,
    })
  );
};

export const airtableTriggerExecutor: NodeExecutor<AirtableTriggerData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    // Publish loading status
    await publishStatus(publish, nodeId, "loading");

    // Extract Airtable payload from context (set by webhook/route)
    const airtablePayload = (context as any).airtablePayload || {};

    // Get node configuration (credentialId, baseId, webhookId)
    const credentialId = data?.credentialId as string | undefined;
    const baseId = (data?.baseId as string | undefined) || airtablePayload.base?.id;
    const webhookId = (data?.webhookId as string | undefined) || airtablePayload.webhook?.id;

    // STEP 1: Fetch webhook payloads from Airtable API (REQUIRED - webhook only sends minimal data)
    // This is the ONLY way to get changedTablesById and createdRecordsById
    let webhookPayloads: any[] = [];
    if (credentialId && baseId && webhookId && userId) {
      try {
        webhookPayloads = await step.run("fetch-webhook-payloads", async () => {
          const payloads = await fetchAirtableWebhookPayloads(
            credentialId,
            userId,
            baseId,
            webhookId
          );
          return payloads;
        });
      } catch (error) {
        await publishStatus(publish, nodeId, "error");
        throw new Error(
          `Failed to fetch webhook payloads: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    if (!Array.isArray(webhookPayloads) || webhookPayloads.length === 0) {
      await publishStatus(publish, nodeId, "error");
      throw new NonRetriableError(
        "No webhook payloads found. The webhook may not have any payloads yet."
      );
    }

    // STEP 2: Filter payloads by baseTransactionNumber (only process new ones)
    // Get the last processed baseTransactionNumber from node data
    const lastProcessedTransactionNumber = (data?.lastProcessedTransactionNumber as number) || 0;

    // Filter to only include payloads with baseTransactionNumber > last processed
    const newPayloads = webhookPayloads.filter((payload: any) => {
      const transactionNumber = payload.baseTransactionNumber || 0;
      return transactionNumber > lastProcessedTransactionNumber;
    });

    if (newPayloads.length === 0) {
      // No new payloads to process
      await publishStatus(publish, nodeId, "success");
      return {
        airtable: {
          baseId: baseId || airtablePayload.base?.id || "",
        },
      };
    }

    // Get the latest new payload (highest baseTransactionNumber)
    const matchingPayload = newPayloads.reduce((latest: any, current: any) => {
      const latestNum = latest.baseTransactionNumber || 0;
      const currentNum = current.baseTransactionNumber || 0;
      return currentNum > latestNum ? current : latest;
    }, newPayloads[0]);

    // STEP 2.5: Check source early - only process form submissions
    const source = matchingPayload?.actionMetadata?.source || null;
    if (source !== "formPageSubmission") {
      await publishStatus(publish, nodeId, "error");
      await publish(
        airtableTriggerChannel().output({
          nodeId,
          output: {
            ...context,
            skipped: true,
            message: `Workflow only processes form submissions}`,
          },
        })
      );
      throw new NonRetriableError(`Workflow only processes form submissions}`);
    }

    // STEP 3: Extract created records from changedTablesById
    const allCreatedRecords: Record<string, any> = {};
    if (matchingPayload?.changedTablesById) {
      for (const tableId in matchingPayload.changedTablesById) {
        const tableChanges = matchingPayload.changedTablesById[tableId];
        if (tableChanges.createdRecordsById) {
          Object.assign(allCreatedRecords, tableChanges.createdRecordsById);
        }
      }
    }

    // STEP 5: Get table schema to map field IDs to names
    let fieldIdToNameMap: Record<string, string> = {};
    if (matchingPayload?.changedTablesById && credentialId && baseId && userId) {
      const tableIds = Object.keys(matchingPayload.changedTablesById);
      if (tableIds.length > 0) {
        try {
          const tablesData = await step.run("fetch-tables-schema", async () => {
            return await listAirtableTables(credentialId, userId, baseId);
          });

          if (tablesData?.tables && Array.isArray(tablesData.tables)) {
            const targetTableId = tableIds[0];
            const targetTable = tablesData.tables.find((table: any) => table.id === targetTableId);

            if (targetTable?.fields && Array.isArray(targetTable.fields)) {
              for (const field of targetTable.fields) {
                if (field.id && field.name) {
                  fieldIdToNameMap[field.id] = field.name;
                }
              }
            }
          }
        } catch (error) {
          // Silently fail - will use field IDs if mapping fails
        }
      }
    }

    // STEP 6: Process the first created record and build clean output
    const result = await step.run("airtable-trigger", async () => {
      const variableName = "airtable";

      // Start with base structure
      const airtableData: any = {
        baseId: baseId || airtablePayload.base?.id || "",
      };

      // If we have created records, process the first one
      if (Object.keys(allCreatedRecords).length > 0) {
        // Get the first created record (most recent)
        const recordIds = Object.keys(allCreatedRecords);
        const firstRecordId = recordIds[0];
        const record = allCreatedRecords[firstRecordId];

        // Extract fields with human-readable names
        const fields: Record<string, any> = {};
        if (record.cellValuesByFieldId) {
          for (const [fieldId, value] of Object.entries(record.cellValuesByFieldId)) {
            const fieldName = fieldIdToNameMap[fieldId] || fieldId;
            fields[fieldName] = value;
          }
        }

        // Build clean output structure
        airtableData.recordId = firstRecordId;
        airtableData.source = source;
        airtableData.webhookId = webhookId;
        airtableData.airtableNodeId = nodeId;
        airtableData.createdTime = record.createdTime;
        airtableData.fields = fields;
      }

      // Return only the airtable object (clean output)
      return {
        [variableName]: airtableData,
      };
    });

    // Publish success status before returning
    await publishStatus(publish, nodeId, "success");

    // Publish node output to realtime channel
    await publish(
      airtableTriggerChannel().output({
        nodeId,
        output: result,
      })
    );

    return result;
  } catch (error) {
    // Publish error status if something goes wrong
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
    await publish(
      airtableTriggerChannel().output({
        nodeId,
        output: {
          ...context,
          error: {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
          },
        },
      })
    );

    throw error;
  }
};
