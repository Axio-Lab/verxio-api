import type { NodeExecutor } from "../types";
import { airtableChannel } from "@/inngest/channels/airtable";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { getCredential } from "@/services/credentialService";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type AirtableData = {
  variables?: string;
  credentialId?: string;
  action?:
    | "listBases"
    | "listTables"
    | "getRecords"
    | "getRecord"
    | "createRecord"
    | "updateRecord"
    | "deleteRecord"
    | "listFields";
  // Base and Table
  baseId?: string;
  tableId?: string;
  // Get Records
  maxRecords?: number;
  view?: string;
  filterByFormula?: string;
  sort?: string; // JSON array of sort objects
  fields?: string; // Comma-separated field names
  // Get Record
  recordId?: string;
  // Create/Update Record
  fieldsData?: string; // JSON object with field values
  // List Fields
  // (no additional fields needed)
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    airtableChannel().status({
      nodeId,
      status,
    })
  );
};

// Helper to compile template strings
const compileTemplate = (template: string, context: Record<string, unknown> = {}): string => {
  try {
    const compiled = Handlebars.compile(template);
    return compiled(context);
  } catch (error) {
    throw new NonRetriableError(
      `Template compilation error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

// Helper to make Airtable API request
const airtableRequest = async (
  url: string,
  apiKey: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>
): Promise<any> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PATCH")) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Airtable API error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      // Airtable API error format
      if (errorJson.error) {
        errorMessage = errorJson.error.message || errorJson.error.type || errorMessage;
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      // If response is not JSON, use the text or default message
      if (errorText && errorText.trim()) {
        errorMessage = errorText.trim();
      }
    }

    // Provide more helpful error messages for common issues
    if (response.status === 401) {
      errorMessage =
        "Airtable authentication failed. Please check your Personal Access Token is valid and has the required permissions.";
    } else if (response.status === 403) {
      errorMessage =
        "Airtable access forbidden. Your token may not have permission to access this base or table.";
    } else if (response.status === 404) {
      errorMessage =
        "Airtable resource not found. Please check that the base ID, table ID, or record ID is correct.";
    }

    throw new NonRetriableError(errorMessage);
  }

  return await response.json();
};

export const airtableExecutor: NodeExecutor<AirtableData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "airtable";

    if (!data.credentialId) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Airtable node: Credential is required");
      await publish(
        airtableChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: error.message,
            },
          },
        })
      );
      throw error;
    }

    if (!data.action) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Airtable node: Action is required");
      await publish(
        airtableChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: error.message,
            },
          },
        })
      );
      throw error;
    }

    // Get credential
    const credential = await step.run("get-airtable-credential", async () => {
      return await getCredential(data.credentialId!, userId!);
    });

    if (!credential) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Airtable node: Credential not found");
      await publish(
        airtableChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: error.message,
            },
          },
        })
      );
      throw error;
    }

    // Parse credential value - can be JSON or plain token string
    let apiKey: string;
    try {
      // Try parsing as JSON first (for backward compatibility)
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
      await publishStatus(publish, nodeId, "error");
      const errorMessage = new NonRetriableError(
        "Airtable node: Invalid credential format. Expected Personal Access Token (starts with 'pat') or JSON with apiKey/accessToken."
      );
      await publish(
        airtableChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: errorMessage.message,
            },
          },
        })
      );
      throw errorMessage;
    }

    let result: any;

    // Execute action
    switch (data.action) {
      case "listBases": {
        result = await step.run("list-bases", async () => {
          const url = "https://api.airtable.com/v0/meta/bases";
          const response = await airtableRequest(url, apiKey);
          return {
            bases: response.bases || [],
            count: response.bases?.length || 0,
          };
        });
        break;
      }

      case "listTables": {
        if (!data.baseId) {
          throw new NonRetriableError("Airtable node: Base ID is required for listTables");
        }

        const baseId = compileTemplate(data.baseId, context);

        result = await step.run("list-tables", async () => {
          const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
          const response = await airtableRequest(url, apiKey);
          return {
            baseId,
            tables: response.tables || [],
            count: response.tables?.length || 0,
          };
        });
        break;
      }

      case "listFields": {
        if (!data.baseId || !data.tableId) {
          throw new NonRetriableError(
            "Airtable node: Base ID and Table ID are required for listFields"
          );
        }

        const baseId = compileTemplate(data.baseId, context);
        const tableId = compileTemplate(data.tableId, context);

        result = await step.run("list-fields", async () => {
          const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}`;
          const response = await airtableRequest(url, apiKey);
          return {
            baseId,
            tableId,
            fields: response.fields || [],
            count: response.fields?.length || 0,
          };
        });
        break;
      }

      case "getRecords": {
        if (!data.baseId || !data.tableId) {
          throw new NonRetriableError(
            "Airtable node: Base ID and Table ID are required for getRecords"
          );
        }

        const baseId = compileTemplate(data.baseId, context);
        const tableId = compileTemplate(data.tableId, context);
        const maxRecords = data.maxRecords || 100;
        const view = data.view ? compileTemplate(data.view, context) : undefined;
        const filterByFormula = data.filterByFormula
          ? compileTemplate(data.filterByFormula, context)
          : undefined;
        const fields = data.fields ? compileTemplate(data.fields, context) : undefined;

        // Parse sort if provided
        let sortArray: Array<{ field: string; direction?: "asc" | "desc" }> | undefined;
        if (data.sort) {
          try {
            sortArray = JSON.parse(compileTemplate(data.sort, context));
          } catch {
            // Invalid sort format, ignore
          }
        }

        result = await step.run("get-records", async () => {
          const params = new URLSearchParams();
          if (maxRecords) params.append("maxRecords", maxRecords.toString());
          if (view) params.append("view", view);
          if (filterByFormula) params.append("filterByFormula", filterByFormula);
          if (fields) {
            // Airtable expects multiple fields[] parameters
            fields.split(",").forEach((field) => {
              params.append("fields[]", field.trim());
            });
          }
          if (sortArray) {
            sortArray.forEach((sort, index) => {
              params.append(`sort[${index}][field]`, sort.field);
              if (sort.direction) {
                params.append(`sort[${index}][direction]`, sort.direction);
              }
            });
          }

          const url = `https://api.airtable.com/v0/${baseId}/${tableId}?${params.toString()}`;
          const response = await airtableRequest(url, apiKey);
          return {
            baseId,
            tableId,
            records: response.records || [],
            count: response.records?.length || 0,
            offset: response.offset || null,
          };
        });
        break;
      }

      case "getRecord": {
        if (!data.baseId || !data.tableId || !data.recordId) {
          throw new NonRetriableError(
            "Airtable node: Base ID, Table ID, and Record ID are required for getRecord"
          );
        }

        const baseId = compileTemplate(data.baseId, context);
        const tableId = compileTemplate(data.tableId, context);
        const recordId = compileTemplate(data.recordId, context);

        result = await step.run("get-record", async () => {
          const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;
          const response = await airtableRequest(url, apiKey);
          return {
            baseId,
            tableId,
            record: response,
          };
        });
        break;
      }

      case "createRecord": {
        if (!data.baseId || !data.tableId) {
          throw new NonRetriableError(
            "Airtable node: Base ID and Table ID are required for createRecord"
          );
        }

        if (!data.fieldsData) {
          throw new NonRetriableError("Airtable node: Fields data is required for createRecord");
        }

        const baseId = compileTemplate(data.baseId, context);
        const tableId = compileTemplate(data.tableId, context);
        let fieldsData: Record<string, unknown>;
        try {
          const compiledFields = compileTemplate(data.fieldsData, context);
          fieldsData = JSON.parse(compiledFields);
        } catch (error) {
          throw new NonRetriableError(
            `Airtable node: Invalid fields data format. Expected valid JSON: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        result = await step.run("create-record", async () => {
          const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
          const response = await airtableRequest(url, apiKey, "POST", {
            fields: fieldsData,
          });
          return {
            baseId,
            tableId,
            record: response,
          };
        });
        break;
      }

      case "updateRecord": {
        if (!data.baseId || !data.tableId || !data.recordId) {
          throw new NonRetriableError(
            "Airtable node: Base ID, Table ID, and Record ID are required for updateRecord"
          );
        }

        if (!data.fieldsData) {
          throw new NonRetriableError("Airtable node: Fields data is required for updateRecord");
        }

        const baseId = compileTemplate(data.baseId, context);
        const tableId = compileTemplate(data.tableId, context);
        const recordId = compileTemplate(data.recordId, context);
        let fieldsData: Record<string, unknown>;
        try {
          const compiledFields = compileTemplate(data.fieldsData, context);
          fieldsData = JSON.parse(compiledFields);
        } catch (error) {
          throw new NonRetriableError(
            `Airtable node: Invalid fields data format. Expected valid JSON: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        result = await step.run("update-record", async () => {
          const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;
          const response = await airtableRequest(url, apiKey, "PATCH", {
            fields: fieldsData,
          });
          return {
            baseId,
            tableId,
            recordId,
            record: response,
          };
        });
        break;
      }

      case "deleteRecord": {
        if (!data.baseId || !data.tableId || !data.recordId) {
          throw new NonRetriableError(
            "Airtable node: Base ID, Table ID, and Record ID are required for deleteRecord"
          );
        }

        const baseId = compileTemplate(data.baseId, context);
        const tableId = compileTemplate(data.tableId, context);
        const recordId = compileTemplate(data.recordId, context);

        result = await step.run("delete-record", async () => {
          const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;
          await airtableRequest(url, apiKey, "DELETE");
          return {
            baseId,
            tableId,
            recordId,
            deleted: true,
          };
        });
        break;
      }

      default:
        throw new NonRetriableError(`Airtable node: Unknown action: ${data.action}`);
    }

    // Publish success status and output
    await publishStatus(publish, nodeId, "success");
    await publish(
      airtableChannel().output({
        nodeId,
        output: {
          ...context,
          [variablesName]: result,
        },
      })
    );

    return {
      ...context,
      [variablesName]: result,
    };
  } catch (error) {
    await publishStatus(publish, nodeId, "error");
    const errorMessage = error instanceof Error ? error.message : String(error);
    await publish(
      airtableChannel().output({
        nodeId,
        output: {
          ...context,
          error: {
            message: errorMessage,
          },
        },
      })
    );
    throw error;
  }
};
