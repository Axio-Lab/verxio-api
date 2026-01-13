import type { NodeExecutor } from "../types";
import { googleSheetsChannel } from "@/inngest/channels/google-sheets";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { getValidAccessToken } from "@/services/googleOAuthService";
import { google } from "googleapis";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type GoogleSheetsData = {
  variables?: string;
  action?:
    | "readRange"
    | "writeRange"
    | "appendRow"
    | "updateCells"
    | "clearRange"
    | "createSheet"
    | "createSpreadsheet";
  // Spreadsheet/Sheet IDs
  spreadsheetId?: string;
  sheetName?: string;
  // Read/Write/Update/Clear
  range?: string;
  // Write/Append/Update
  values?: string; // JSON array of arrays
  // Create Spreadsheet
  title?: string;
  // Create Sheet
  sheetTitle?: string;
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    googleSheetsChannel().status({
      nodeId,
      status,
    })
  );
};

// Helper to get authenticated Google Sheets client
const getSheetsClient = async (accessToken: string) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
};

// Helper to get authenticated Google Drive client (for creating spreadsheets)
const getDriveClient = async (accessToken: string) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
};

export const googleSheetsExecutor: NodeExecutor<GoogleSheetsData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "googleSheets";

    if (!data.action) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Google Sheets node: Action is required");
      await publish(
        googleSheetsChannel().output({
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

    // Get valid access token (automatically refreshes if expired)
    // Uses env-based GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
    let accessToken: string;
    try {
      accessToken = await step.run("get-valid-access-token", async () => {
        if (!userId) {
          throw new Error("User ID is required");
        }
        return await getValidAccessToken(userId);
      });
    } catch (error) {
      await publishStatus(publish, nodeId, "error");
      const err = new NonRetriableError(
        error instanceof Error
          ? error.message
          : "Google Sheets node: Failed to get access token. Please connect your Google account."
      );
      await publish(
        googleSheetsChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: err.message,
            },
          },
        })
      );
      throw err;
    }

    const sheets = await getSheetsClient(accessToken);
    const drive = await getDriveClient(accessToken);
    let result: any;

    // Compile Handlebars templates
    const compileTemplate = (template: string) => {
      if (!template) return template;
      try {
        return Handlebars.compile(template)(context);
      } catch (error) {
        throw new NonRetriableError(
          `Template compilation error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    };

    // Execute action
    switch (data.action) {
      case "createSpreadsheet": {
        if (!data.title) {
          throw new NonRetriableError("Google Sheets node: Spreadsheet title is required");
        }

        const title = compileTemplate(data.title);

        result = await step.run("create-spreadsheet", async () => {
          // Create spreadsheet using Drive API
          const fileMetadata = {
            name: title,
            mimeType: "application/vnd.google-apps.spreadsheet",
          };

          const driveResponse = await drive.files.create({
            requestBody: fileMetadata,
            fields: "id,name,webViewLink",
          });

          return {
            spreadsheetId: driveResponse.data.id,
            title: driveResponse.data.name,
            webViewLink: driveResponse.data.webViewLink,
          };
        });
        break;
      }

      case "readRange": {
        if (!data.spreadsheetId) {
          throw new NonRetriableError("Google Sheets node: Spreadsheet ID is required");
        }
        if (!data.range) {
          throw new NonRetriableError("Google Sheets node: Range is required");
        }

        const spreadsheetId = compileTemplate(data.spreadsheetId);
        const range = compileTemplate(data.range);

        result = await step.run("read-range", async () => {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
          });

          return {
            range: response.data.range,
            values: response.data.values || [],
            majorDimension: response.data.majorDimension,
          };
        });
        break;
      }

      case "writeRange": {
        if (!data.spreadsheetId) {
          throw new NonRetriableError("Google Sheets node: Spreadsheet ID is required");
        }
        if (!data.range) {
          throw new NonRetriableError("Google Sheets node: Range is required");
        }
        if (!data.values) {
          throw new NonRetriableError("Google Sheets node: Values are required");
        }

        const spreadsheetId = compileTemplate(data.spreadsheetId);
        const range = compileTemplate(data.range);

        let values: any[][];
        try {
          const valuesStr = compileTemplate(data.values);
          if (!valuesStr || valuesStr.trim().length === 0) {
            throw new NonRetriableError(
              "Google Sheets node: Values are required and cannot be empty after templating. Please check that your template variables are available and contain values."
            );
          }
          values = JSON.parse(valuesStr);
          if (!Array.isArray(values) || values.length === 0) {
            throw new NonRetriableError(
              "Google Sheets node: Values must be a non-empty JSON array of arrays"
            );
          }
        } catch (error) {
          if (error instanceof NonRetriableError) {
            throw error;
          }
          throw new NonRetriableError(
            "Google Sheets node: Values must be a valid JSON array of arrays"
          );
        }

        result = await step.run("write-range", async () => {
          const response = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: "RAW",
            requestBody: {
              values,
            },
          });

          return {
            updatedRange: response.data.updatedRange,
            updatedCells: response.data.updatedCells,
            updatedRows: response.data.updatedRows,
            updatedColumns: response.data.updatedColumns,
          };
        });
        break;
      }

      case "appendRow": {
        if (!data.spreadsheetId) {
          throw new NonRetriableError("Google Sheets node: Spreadsheet ID is required");
        }
        if (!data.range) {
          throw new NonRetriableError("Google Sheets node: Range is required");
        }
        if (!data.values) {
          throw new NonRetriableError("Google Sheets node: Values are required");
        }

        const spreadsheetId = compileTemplate(data.spreadsheetId);
        const range = compileTemplate(data.range);

        let values: any[][];
        try {
          const valuesStr = compileTemplate(data.values);
          if (!valuesStr || valuesStr.trim().length === 0) {
            throw new NonRetriableError(
              "Google Sheets node: Values are required and cannot be empty after templating. Please check that your template variables are available and contain values."
            );
          }
          values = JSON.parse(valuesStr);
          if (!Array.isArray(values) || values.length === 0) {
            throw new NonRetriableError(
              "Google Sheets node: Values must be a non-empty JSON array of arrays"
            );
          }
        } catch (error) {
          if (error instanceof NonRetriableError) {
            throw error;
          }
          throw new NonRetriableError(
            "Google Sheets node: Values must be a valid JSON array of arrays"
          );
        }

        result = await step.run("append-row", async () => {
          const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: {
              values,
            },
          });

          return {
            updatedRange: response.data.updates?.updatedRange,
            updatedCells: response.data.updates?.updatedCells,
            updatedRows: response.data.updates?.updatedRows,
            updatedColumns: response.data.updates?.updatedColumns,
          };
        });
        break;
      }

      case "updateCells": {
        if (!data.spreadsheetId) {
          throw new NonRetriableError("Google Sheets node: Spreadsheet ID is required");
        }
        if (!data.range) {
          throw new NonRetriableError("Google Sheets node: Range is required");
        }
        if (!data.values) {
          throw new NonRetriableError("Google Sheets node: Values are required");
        }

        const spreadsheetId = compileTemplate(data.spreadsheetId);
        const range = compileTemplate(data.range);

        let values: any[][];
        try {
          const valuesStr = compileTemplate(data.values);
          if (!valuesStr || valuesStr.trim().length === 0) {
            throw new NonRetriableError(
              "Google Sheets node: Values are required and cannot be empty after templating. Please check that your template variables are available and contain values."
            );
          }
          values = JSON.parse(valuesStr);
          if (!Array.isArray(values) || values.length === 0) {
            throw new NonRetriableError(
              "Google Sheets node: Values must be a non-empty JSON array of arrays"
            );
          }
        } catch (error) {
          if (error instanceof NonRetriableError) {
            throw error;
          }
          throw new NonRetriableError(
            "Google Sheets node: Values must be a valid JSON array of arrays"
          );
        }

        result = await step.run("update-cells", async () => {
          const response = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: "RAW",
            requestBody: {
              values,
            },
          });

          return {
            updatedRange: response.data.updatedRange,
            updatedCells: response.data.updatedCells,
          };
        });
        break;
      }

      case "clearRange": {
        if (!data.spreadsheetId) {
          throw new NonRetriableError("Google Sheets node: Spreadsheet ID is required");
        }
        if (!data.range) {
          throw new NonRetriableError("Google Sheets node: Range is required");
        }

        const spreadsheetId = compileTemplate(data.spreadsheetId);
        const range = compileTemplate(data.range);

        result = await step.run("clear-range", async () => {
          const response = await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range,
          });

          return {
            clearedRange: response.data.clearedRange,
          };
        });
        break;
      }

      case "createSheet": {
        if (!data.spreadsheetId) {
          throw new NonRetriableError("Google Sheets node: Spreadsheet ID is required");
        }
        if (!data.sheetTitle) {
          throw new NonRetriableError("Google Sheets node: Sheet title is required");
        }

        const spreadsheetId = compileTemplate(data.spreadsheetId);
        const sheetTitle = compileTemplate(data.sheetTitle);

        result = await step.run("create-sheet", async () => {
          const response = await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: sheetTitle,
                    },
                  },
                },
              ],
            },
          });

          const sheet = response.data.replies?.[0]?.addSheet?.properties;

          return {
            sheetId: sheet?.sheetId,
            title: sheet?.title,
          };
        });
        break;
      }

      default:
        throw new NonRetriableError(`Google Sheets node: Unknown action: ${data.action}`);
    }

    await publishStatus(publish, nodeId, "success");

    // Publish node output to realtime channel
    await publish(
      googleSheetsChannel().output({
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

    // Publish error output to realtime channel
    await publish(
      googleSheetsChannel().output({
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

    if (error instanceof NonRetriableError) {
      throw error;
    }
    throw new NonRetriableError(
      `Google Sheets action failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
