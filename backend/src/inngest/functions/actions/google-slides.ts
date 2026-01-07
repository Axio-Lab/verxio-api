import type { NodeExecutor } from "../types";
import { googleSlidesChannel } from "@/inngest/channels/google-slides";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { getCredential, CredentialType } from "@/services/credentialService";
import { getValidAccessToken } from "@/services/googleOAuthService";
import { google } from "googleapis";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type GoogleSlidesData = {
  variables?: string;
  credentialId?: string;
  action?:
    | "createPresentation"
    | "listPresentations"
    | "createSlide"
    | "insertText"
    | "insertImage"
    | "insertShape"
    | "insertTable"
    | "replaceText"
    | "replaceImage"
    | "exportPresentation"
    | "getPresentation";
  // Create Presentation
  title?: string;
  // Create Slide / Insert Content
  presentationId?: string;
  // Insert Text
  text?: string;
  slideIndex?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // Insert Image
  imageUrl?: string;
  imageDriveFileId?: string;
  // Insert Shape
  shapeType?: "RECTANGLE" | "ROUND_RECTANGLE" | "ELLIPSE" | "LINE" | "ARROW";
  // Insert Table
  rows?: number;
  columns?: number;
  // Replace Text
  oldText?: string;
  newText?: string;
  // Replace Image
  objectId?: string;
  // Export
  mimeType?: string; // application/pdf, application/vnd.openxmlformats-officedocument.presentationml.presentation
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    googleSlidesChannel().status({
      nodeId,
      status,
    })
  );
};

// Helper to get authenticated Google Slides client
const getSlidesClient = async (accessToken: string) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.slides({ version: "v1", auth });
};

// Helper to get authenticated Google Drive client (for creating/exporting presentations)
const getDriveClient = async (accessToken: string) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
};

export const googleSlidesExecutor: NodeExecutor<GoogleSlidesData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "googleSlides";

    if (!data.credentialId) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        "Google Slides node: Google OAuth credential is required"
      );
      await publish(
        googleSlidesChannel().output({
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
      const error = new NonRetriableError("Google Slides node: Action is required");
      await publish(
        googleSlidesChannel().output({
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

    // Get OAuth token from credential
    const credential = await step.run("get-google-oauth-credential", async () => {
      return await getCredential(data.credentialId!, userId!);
    });

    if (!credential) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Google Slides node: Credential not found");
      await publish(
        googleSlidesChannel().output({
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

    if (credential.type !== CredentialType.GOOGLE_OAUTH) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        "Google Slides node: Credential type mismatch. Expected GOOGLE_OAUTH credential."
      );
      await publish(
        googleSlidesChannel().output({
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
    let accessToken: string;
    try {
      accessToken = await step.run("get-valid-access-token", async () => {
        return await getValidAccessToken(userId!, data.credentialId!);
      });
    } catch (error) {
      await publishStatus(publish, nodeId, "error");
      const err = new NonRetriableError(
        error instanceof Error
          ? error.message
          : "Google Slides node: Failed to get access token. Please connect your Google account."
      );
      await publish(
        googleSlidesChannel().output({
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

    const slides = await getSlidesClient(accessToken);
    const drive = await getDriveClient(accessToken);
    let result: any;

    // Compile Handlebars templates
    const compileTemplate = (template: string) => {
      if (!template) return template;
      return Handlebars.compile(template)(context);
    };

    // Execute action
    switch (data.action) {
      case "createPresentation": {
        if (!data.title) {
          throw new NonRetriableError("Google Slides node: Presentation title is required");
        }

        const title = compileTemplate(data.title);

        result = await step.run("create-presentation", async () => {
          const response = await slides.presentations.create({
            requestBody: {
              title,
            },
          });

          // Get webViewLink from Drive API
          const driveResponse = await drive.files.get({
            fileId: response.data.presentationId!,
            fields: "id,name,webViewLink",
          });

          return {
            presentationId: response.data.presentationId,
            title: response.data.title,
            webViewLink: driveResponse.data.webViewLink,
            revisionId: (response.data as any).revisionId || null,
          };
        });
        break;
      }

      case "createSlide": {
        if (!data.presentationId) {
          throw new NonRetriableError("Google Slides node: Presentation ID is required");
        }

        const presentationId = compileTemplate(data.presentationId);

        result = await step.run("create-slide", async () => {
          const response = await slides.presentations.batchUpdate({
            presentationId,
            requestBody: {
              requests: [
                {
                  createSlide: {
                    insertionIndex: 0,
                  },
                },
              ],
            },
          });

          const slideId = response.data.replies?.[0]?.createSlide?.objectId;

          return {
            presentationId,
            slideId,
            revisionId: (response.data as any).revisionId || null,
          };
        });
        break;
      }

      case "insertText": {
        if (!data.presentationId) {
          throw new NonRetriableError("Google Slides node: Presentation ID is required");
        }
        if (!data.text) {
          throw new NonRetriableError("Google Slides node: Text is required");
        }

        const presentationId = compileTemplate(data.presentationId);
        const text = compileTemplate(data.text);
        const slideIndex =
          data.slideIndex !== undefined ? parseInt(compileTemplate(String(data.slideIndex))) : 0;
        const x = data.x !== undefined ? parseFloat(compileTemplate(String(data.x))) : 100;
        const y = data.y !== undefined ? parseFloat(compileTemplate(String(data.y))) : 100;
        const width =
          data.width !== undefined ? parseFloat(compileTemplate(String(data.width))) : 400;
        const height =
          data.height !== undefined ? parseFloat(compileTemplate(String(data.height))) : 50;

        result = await step.run("insert-text", async () => {
          // First, get the slide ID
          const presentation = await slides.presentations.get({
            presentationId,
          });

          const slidesList = presentation.data.slides || [];
          if (slideIndex >= slidesList.length) {
            throw new NonRetriableError(
              `Google Slides node: Slide index ${slideIndex} is out of range`
            );
          }

          const slideId = slidesList[slideIndex]?.objectId;
          if (!slideId) {
            throw new NonRetriableError("Google Slides node: Could not find slide ID");
          }

          // Generate a unique object ID for the text box
          const objectId = `text_${Date.now()}`;

          const response = await slides.presentations.batchUpdate({
            presentationId,
            requestBody: {
              requests: [
                {
                  createShape: {
                    objectId,
                    shapeType: "TEXT_BOX",
                    elementProperties: {
                      pageObjectId: slideId,
                      size: {
                        height: { magnitude: height, unit: "PT" },
                        width: { magnitude: width, unit: "PT" },
                      },
                      transform: {
                        scaleX: 1,
                        scaleY: 1,
                        translateX: x,
                        translateY: y,
                        unit: "PT",
                      },
                    },
                  },
                },
                {
                  insertText: {
                    objectId,
                    insertionIndex: 0,
                    text,
                  },
                },
              ],
            },
          });

          return {
            presentationId,
            slideId,
            objectId,
            revisionId: (response.data as any).revisionId || null,
          };
        });
        break;
      }

      case "insertImage": {
        if (!data.presentationId) {
          throw new NonRetriableError("Google Slides node: Presentation ID is required");
        }
        if (!data.imageUrl && !data.imageDriveFileId) {
          throw new NonRetriableError("Google Slides node: Image URL or Drive File ID is required");
        }

        const presentationId = compileTemplate(data.presentationId);
        const imageUrl = data.imageUrl ? compileTemplate(data.imageUrl) : undefined;
        const imageDriveFileId = data.imageDriveFileId
          ? compileTemplate(data.imageDriveFileId)
          : undefined;
        const slideIndex =
          data.slideIndex !== undefined ? parseInt(compileTemplate(String(data.slideIndex))) : 0;
        const x = data.x !== undefined ? parseFloat(compileTemplate(String(data.x))) : 100;
        const y = data.y !== undefined ? parseFloat(compileTemplate(String(data.y))) : 100;
        const width =
          data.width !== undefined ? parseFloat(compileTemplate(String(data.width))) : 400;
        const height =
          data.height !== undefined ? parseFloat(compileTemplate(String(data.height))) : 300;

        result = await step.run("insert-image", async () => {
          // Get the slide ID
          const presentation = await slides.presentations.get({
            presentationId,
          });

          const slidesList = presentation.data.slides || [];
          if (slideIndex >= slidesList.length) {
            throw new NonRetriableError(
              `Google Slides node: Slide index ${slideIndex} is out of range`
            );
          }

          const slideId = slidesList[slideIndex]?.objectId;
          if (!slideId) {
            throw new NonRetriableError("Google Slides node: Could not find slide ID");
          }

          const objectId = `image_${Date.now()}`;

          const requests: any[] = [];

          if (imageUrl) {
            requests.push({
              createImage: {
                objectId,
                url: imageUrl,
                elementProperties: {
                  pageObjectId: slideId,
                  size: {
                    height: { magnitude: height, unit: "PT" },
                    width: { magnitude: width, unit: "PT" },
                  },
                  transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: x,
                    translateY: y,
                    unit: "PT",
                  },
                },
              },
            });
          } else if (imageDriveFileId) {
            // For Drive files, we need to use the sourceUrl property
            requests.push({
              createImage: {
                objectId,
                url: `https://drive.google.com/uc?export=download&id=${imageDriveFileId}`,
                elementProperties: {
                  pageObjectId: slideId,
                  size: {
                    height: { magnitude: height, unit: "PT" },
                    width: { magnitude: width, unit: "PT" },
                  },
                  transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: x,
                    translateY: y,
                    unit: "PT",
                  },
                },
              },
            });
          }

          const response = await slides.presentations.batchUpdate({
            presentationId,
            requestBody: {
              requests,
            },
          });

          return {
            presentationId,
            slideId,
            objectId,
            revisionId: (response.data as any).revisionId || null,
          };
        });
        break;
      }

      case "replaceText": {
        if (!data.presentationId) {
          throw new NonRetriableError("Google Slides node: Presentation ID is required");
        }
        if (!data.oldText) {
          throw new NonRetriableError("Google Slides node: Old text (placeholder) is required");
        }
        if (!data.newText) {
          throw new NonRetriableError("Google Slides node: New text is required");
        }

        const presentationId = compileTemplate(data.presentationId);
        const oldText = compileTemplate(data.oldText);
        const newText = compileTemplate(data.newText);

        result = await step.run("replace-text", async () => {
          const response = await slides.presentations.batchUpdate({
            presentationId,
            requestBody: {
              requests: [
                {
                  replaceAllText: {
                    containsText: {
                      text: oldText,
                      matchCase: false,
                    },
                    replaceText: newText,
                  },
                },
              ],
            },
          });

          return {
            presentationId,
            occurrencesChanged: response.data.replies?.[0]?.replaceAllText?.occurrencesChanged || 0,
            revisionId: (response.data as any).revisionId || null,
          };
        });
        break;
      }

      case "exportPresentation": {
        if (!data.presentationId) {
          throw new NonRetriableError("Google Slides node: Presentation ID is required");
        }

        const presentationId = compileTemplate(data.presentationId);
        const mimeType = data.mimeType || "application/pdf";

        result = await step.run("export-presentation", async () => {
          const response = await drive.files.export(
            {
              fileId: presentationId,
              mimeType,
            },
            { responseType: "stream" }
          );

          // Convert stream to buffer
          const chunks: Buffer[] = [];
          for await (const chunk of response.data) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString("base64");

          return {
            presentationId,
            mimeType,
            data: base64,
            size: buffer.length,
          };
        });
        break;
      }

      case "listPresentations": {
        result = await step.run("list-presentations", async () => {
          // Use Drive API to list all presentations
          const q = "mimeType='application/vnd.google-apps.presentation' and trashed=false";
          const response = await drive.files.list({
            q,
            fields: "files(id,name,webViewLink,createdTime,modifiedTime)",
            pageSize: 100,
            orderBy: "modifiedTime desc",
          });

          return {
            presentations: response.data.files || [],
            count: response.data.files?.length || 0,
          };
        });
        break;
      }

      case "getPresentation": {
        if (!data.presentationId) {
          throw new NonRetriableError("Google Slides node: Presentation ID is required");
        }

        const presentationId = compileTemplate(data.presentationId);

        result = await step.run("get-presentation", async () => {
          const response = await slides.presentations.get({
            presentationId,
          });

          // Get webViewLink from Drive API
          const driveResponse = await drive.files.get({
            fileId: presentationId,
            fields: "id,name,webViewLink",
          });

          return {
            presentationId: response.data.presentationId,
            title: response.data.title,
            webViewLink: driveResponse.data.webViewLink,
            slidesCount: response.data.slides?.length || 0,
            revisionId: (response.data as any).revisionId || null,
            locale: response.data.locale,
          };
        });
        break;
      }

      default:
        throw new NonRetriableError(`Google Slides node: Unknown action: ${data.action}`);
    }

    // Publish success status and output
    await publishStatus(publish, nodeId, "success");
    await publish(
      googleSlidesChannel().output({
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
    await publish(
      googleSlidesChannel().output({
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
      `Google Slides action failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
