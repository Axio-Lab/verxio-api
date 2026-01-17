import type { NodeExecutor } from "../types";
import { googleDriveChannel } from "@/inngest/channels/google-drive";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { getValidAccessToken } from "@/services/googleOAuthService";
import { google } from "googleapis";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type GoogleDriveData = {
  variables?: string;

  action?:
    | "upload"
    | "download"
    | "list"
    | "createFolder"
    | "move"
    | "copy"
    | "delete"
    | "share"
    | "getMetadata";
  // Upload
  fileName?: string;
  fileContent?: string;
  mimeType?: string;
  parentFolderId?: string;
  // Download
  fileId?: string;
  // List
  folderId?: string;
  query?: string;
  // Move/Copy
  destinationFolderId?: string;
  // Share
  email?: string;
  role?: "reader" | "writer" | "commenter" | "owner";
  // Get Metadata
  fields?: string;
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    googleDriveChannel().status({
      nodeId,
      status,
    })
  );
};

// Helper to get authenticated Google Drive client
const getDriveClient = async (accessToken: string) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
};

export const googleDriveExecutor: NodeExecutor<GoogleDriveData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "googleDrive";

    if (!data.action) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Google Drive node: Action is required");
      await publish(
        googleDriveChannel().output({
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
          : "Google Drive node: Failed to get access token. Please connect your Google account."
      );
      await publish(
        googleDriveChannel().output({
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

    const drive = await getDriveClient(accessToken);
    let result: any;

    // Compile Handlebars templates
    const compileTemplate = (template: string) => {
      if (!template) return template;
      return Handlebars.compile(template)(context);
    };

    // Execute action
    switch (data.action) {
      case "upload": {
        if (!data.fileName) {
          throw new NonRetriableError("Google Drive node: File name is required for upload");
        }
        if (!data.fileContent) {
          throw new NonRetriableError("Google Drive node: File content is required for upload");
        }

        const fileName = compileTemplate(data.fileName);
        const fileContent = compileTemplate(data.fileContent);
        const mimeType = data.mimeType || "text/plain";
        const parentFolderId = data.parentFolderId
          ? compileTemplate(data.parentFolderId)
          : undefined;

        result = await step.run("upload-file", async () => {
          const fileMetadata = {
            name: fileName,
            ...(parentFolderId && { parents: [parentFolderId] }),
          };

          const media = {
            mimeType,
            body: fileContent,
          };

          const response = await drive.files.create({
            requestBody: fileMetadata,
            media,
            fields: "id,name,mimeType,webViewLink,size",
          });

          return {
            fileId: response.data.id,
            fileName: response.data.name,
            mimeType: response.data.mimeType,
            webViewLink: response.data.webViewLink,
            size: response.data.size,
          };
        });
        break;
      }

      case "download": {
        if (!data.fileId) {
          throw new NonRetriableError("Google Drive node: File ID is required for download");
        }

        const fileId = compileTemplate(data.fileId);

        result = await step.run("download-file", async () => {
          const fileMetadata = await drive.files.get({
            fileId,
            fields: "id,name,mimeType,size",
          });

          const fileContent = await drive.files.get(
            {
              fileId,
              alt: "media",
            },
            { responseType: "text" }
          );

          return {
            fileId: fileMetadata.data.id,
            fileName: fileMetadata.data.name,
            mimeType: fileMetadata.data.mimeType,
            size: fileMetadata.data.size,
            content: fileContent.data,
          };
        });
        break;
      }

      case "list": {
        const folderId = data.folderId ? compileTemplate(data.folderId) : undefined;
        const query = data.query ? compileTemplate(data.query) : undefined;

        result = await step.run("list-files", async () => {
          let q = "trashed=false";
          if (folderId) {
            q += ` and '${folderId}' in parents`;
          }
          if (query) {
            q += ` and ${query}`;
          }

          const response = await drive.files.list({
            q,
            fields: "files(id,name,mimeType,size,webViewLink,createdTime,modifiedTime)",
            pageSize: 100,
          });

          return {
            files: response.data.files || [],
            count: response.data.files?.length || 0,
          };
        });
        break;
      }

      case "createFolder": {
        if (!data.fileName) {
          throw new NonRetriableError("Google Drive node: Folder name is required");
        }

        const folderName = compileTemplate(data.fileName);
        const parentFolderId = data.parentFolderId
          ? compileTemplate(data.parentFolderId)
          : undefined;

        result = await step.run("create-folder", async () => {
          const fileMetadata = {
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            ...(parentFolderId && { parents: [parentFolderId] }),
          };

          const response = await drive.files.create({
            requestBody: fileMetadata,
            fields: "id,name,mimeType,webViewLink",
          });

          return {
            folderId: response.data.id,
            folderName: response.data.name,
            webViewLink: response.data.webViewLink,
          };
        });
        break;
      }

      case "move": {
        if (!data.fileId) {
          throw new NonRetriableError("Google Drive node: File ID is required for move");
        }
        if (!data.destinationFolderId) {
          throw new NonRetriableError(
            "Google Drive node: Destination folder ID is required for move"
          );
        }

        const fileId = compileTemplate(data.fileId);
        const destinationFolderId = compileTemplate(data.destinationFolderId);

        result = await step.run("move-file", async () => {
          // Get current parents
          const file = await drive.files.get({
            fileId,
            fields: "parents",
          });

          const previousParents = file.data.parents?.join(",") || "";

          // Move file
          const response = await drive.files.update({
            fileId,
            addParents: destinationFolderId,
            removeParents: previousParents,
            fields: "id,name,parents,webViewLink",
          });

          return {
            fileId: response.data.id,
            fileName: response.data.name,
            newParentId: destinationFolderId,
            webViewLink: response.data.webViewLink,
          };
        });
        break;
      }

      case "copy": {
        if (!data.fileId) {
          throw new NonRetriableError("Google Drive node: File ID is required for copy");
        }

        const fileId = compileTemplate(data.fileId);
        const destinationFolderId = data.destinationFolderId
          ? compileTemplate(data.destinationFolderId)
          : undefined;
        const newFileName = data.fileName ? compileTemplate(data.fileName) : undefined;

        result = await step.run("copy-file", async () => {
          const fileMetadata: any = {};
          if (newFileName) {
            fileMetadata.name = newFileName;
          }
          if (destinationFolderId) {
            fileMetadata.parents = [destinationFolderId];
          }

          const response = await drive.files.copy({
            fileId,
            requestBody: fileMetadata,
            fields: "id,name,mimeType,webViewLink",
          });

          return {
            newFileId: response.data.id,
            fileName: response.data.name,
            mimeType: response.data.mimeType,
            webViewLink: response.data.webViewLink,
          };
        });
        break;
      }

      case "delete": {
        if (!data.fileId) {
          throw new NonRetriableError("Google Drive node: File ID is required for delete");
        }

        const fileId = compileTemplate(data.fileId);

        result = await step.run("delete-file", async () => {
          await drive.files.delete({
            fileId,
          });

          return {
            fileId,
            deleted: true,
          };
        });
        break;
      }

      case "share": {
        if (!data.fileId) {
          throw new NonRetriableError("Google Drive node: File ID is required for share");
        }
        if (!data.email) {
          throw new NonRetriableError("Google Drive node: Email is required for share");
        }

        const fileId = compileTemplate(data.fileId);
        const email = compileTemplate(data.email);
        const role = data.role || "reader";

        result = await step.run("share-file", async () => {
          await drive.permissions.create({
            fileId,
            requestBody: {
              role,
              type: "user",
              emailAddress: email,
            },
          });

          return {
            fileId,
            sharedWith: email,
            role,
          };
        });
        break;
      }

      case "getMetadata": {
        if (!data.fileId) {
          throw new NonRetriableError("Google Drive node: File ID is required for get metadata");
        }

        const fileId = compileTemplate(data.fileId);
        const fields =
          data.fields || "id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents";

        result = await step.run("get-metadata", async () => {
          const response = await drive.files.get({
            fileId,
            fields,
          });

          return {
            ...response.data,
          };
        });
        break;
      }

      default:
        throw new NonRetriableError(`Google Drive node: Unknown action: ${data.action}`);
    }

    await publishStatus(publish, nodeId, "success");

    // Publish node output to realtime channel
    await publish(
      googleDriveChannel().output({
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
      googleDriveChannel().output({
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
      `Google Drive action failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
