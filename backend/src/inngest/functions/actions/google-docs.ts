import type { NodeExecutor } from "../types";
import { googleDocsChannel } from "@/inngest/channels/google-docs";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { getValidAccessToken } from "@/services/googleOAuthService";
import { google } from "googleapis";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type GoogleDocsData = {
  variables?: string;
  action?: "createDocument" | "readDocument" | "insertText" | "updateText" | "exportDocument";
  // Create Document
  title?: string;
  // Read/Insert/Update/Export
  documentId?: string;
  // Insert/Update Text
  text?: string;
  index?: number;
  // Export
  mimeType?: string; // application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, etc.
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    googleDocsChannel().status({
      nodeId,
      status,
    })
  );
};

// Helper to get authenticated Google Docs client
const getDocsClient = async (accessToken: string) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.docs({ version: "v1", auth });
};

// Helper to get authenticated Google Drive client (for creating/exporting documents)
const getDriveClient = async (accessToken: string) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
};

export const googleDocsExecutor: NodeExecutor<GoogleDocsData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "googleDocs";

    if (!data.action) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Google Docs node: Action is required");
      await publish(
        googleDocsChannel().output({
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
          : "Google Docs node: Failed to get access token. Please connect your Google account."
      );
      await publish(
        googleDocsChannel().output({
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

    const docs = await getDocsClient(accessToken);
    const drive = await getDriveClient(accessToken);
    let result: any;

    // Compile Handlebars templates
    const compileTemplate = (template: string) => {
      if (!template) return template;
      return Handlebars.compile(template)(context);
    };

    // Execute action
    switch (data.action) {
      case "createDocument": {
        if (!data.title) {
          throw new NonRetriableError("Google Docs node: Document title is required");
        }

        const title = compileTemplate(data.title);

        result = await step.run("create-document", async () => {
          // Create document using Drive API
          const fileMetadata = {
            name: title,
            mimeType: "application/vnd.google-apps.document",
          };

          const driveResponse = await drive.files.create({
            requestBody: fileMetadata,
            fields: "id,name,webViewLink",
          });

          return {
            documentId: driveResponse.data.id,
            title: driveResponse.data.name,
            webViewLink: driveResponse.data.webViewLink,
          };
        });
        break;
      }

      case "readDocument": {
        if (!data.documentId) {
          throw new NonRetriableError("Google Docs node: Document ID is required");
        }

        const documentId = compileTemplate(data.documentId);

        result = await step.run("read-document", async () => {
          const response = await docs.documents.get({
            documentId,
          });

          // Extract text content
          const content = response.data.body?.content || [];
          let text = "";
          const extractText = (elements: any[]) => {
            for (const element of elements) {
              if (element.paragraph) {
                const paragraph = element.paragraph;
                if (paragraph.elements) {
                  for (const paraElement of paragraph.elements) {
                    if (paraElement.textRun) {
                      text += paraElement.textRun.content || "";
                    }
                  }
                }
              }
              if (element.table) {
                // Handle tables if needed
              }
            }
          };
          extractText(content);

          return {
            documentId: response.data.documentId,
            title: response.data.title,
            content: text,
            fullDocument: response.data,
          };
        });
        break;
      }

      case "insertText": {
        if (!data.documentId) {
          throw new NonRetriableError("Google Docs node: Document ID is required");
        }
        if (!data.text) {
          throw new NonRetriableError("Google Docs node: Text is required");
        }

        const documentId = compileTemplate(data.documentId);
        const text = compileTemplate(data.text);
        const index = data.index !== undefined ? parseInt(compileTemplate(String(data.index))) : 1;

        result = await step.run("insert-text", async () => {
          const response = await docs.documents.batchUpdate({
            documentId,
            requestBody: {
              requests: [
                {
                  insertText: {
                    location: {
                      index,
                    },
                    text,
                  },
                },
              ],
            },
          });

          return {
            documentId,
            revisionId: (response.data as any).revisionId || null,
          };
        });
        break;
      }

      case "updateText": {
        if (!data.documentId) {
          throw new NonRetriableError("Google Docs node: Document ID is required");
        }
        if (!data.text) {
          throw new NonRetriableError("Google Docs node: Text is required");
        }
        if (data.index === undefined) {
          throw new NonRetriableError("Google Docs node: Index is required for update");
        }

        const documentId = compileTemplate(data.documentId);
        const text = compileTemplate(data.text);
        const startIndex = parseInt(compileTemplate(String(data.index)));
        const endIndex = startIndex + (data.text.length || 0);

        result = await step.run("update-text", async () => {
          const response = await docs.documents.batchUpdate({
            documentId,
            requestBody: {
              requests: [
                {
                  deleteContentRange: {
                    range: {
                      startIndex,
                      endIndex,
                    },
                  },
                },
                {
                  insertText: {
                    location: {
                      index: startIndex,
                    },
                    text,
                  },
                },
              ],
            },
          });

          return {
            documentId,
            revisionId: (response.data as any).revisionId || null,
          };
        });
        break;
      }

      case "exportDocument": {
        if (!data.documentId) {
          throw new NonRetriableError("Google Docs node: Document ID is required");
        }

        const documentId = compileTemplate(data.documentId);
        const mimeType = data.mimeType || "application/pdf";

        result = await step.run("export-document", async () => {
          const file = await drive.files.get(
            {
              fileId: documentId,
              alt: "media",
            },
            {
              responseType: "arraybuffer",
            }
          );

          // Export using Drive API
          const exportResponse = await drive.files.export(
            {
              fileId: documentId,
              mimeType,
            },
            {
              responseType: "arraybuffer",
            }
          );

          // Convert to base64 for transmission
          const buffer = Buffer.from(exportResponse.data as ArrayBuffer);
          const base64 = buffer.toString("base64");

          return {
            documentId,
            mimeType,
            content: base64,
            size: buffer.length,
          };
        });
        break;
      }

      default:
        throw new NonRetriableError(`Google Docs node: Unknown action: ${data.action}`);
    }

    await publishStatus(publish, nodeId, "success");

    // Publish node output to realtime channel
    await publish(
      googleDocsChannel().output({
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
      googleDocsChannel().output({
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
      `Google Docs action failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
