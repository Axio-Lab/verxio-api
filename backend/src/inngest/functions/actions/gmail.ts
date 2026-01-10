import type { NodeExecutor } from "../types";
import { gmailChannel } from "@/inngest/channels/gmail";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { getValidAccessToken } from "@/services/googleOAuthService";
import { google } from "googleapis";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type GmailData = {
  variables?: string;
  action?:
    | "sendEmail"
    | "sendEmailWithAttachment"
    | "listEmails"
    | "getEmail"
    | "createDraft"
    | "sendDraft"
    | "replyToEmail"
    | "forwardEmail"
    | "deleteEmail"
    | "addLabel";
  // Send Email
  to?: string; // Comma-separated email addresses
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string; // Plain text or HTML
  isHtml?: boolean;
  // Send Email With Attachment
  attachmentUrl?: string; // URL to download attachment
  attachmentDriveFileId?: string; // Drive file ID
  attachmentName?: string;
  // List Emails
  query?: string; // Gmail search query
  maxResults?: number;
  // Get Email / Reply / Forward / Delete
  emailId?: string;
  // Create Draft
  draftId?: string; // For sendDraft
  // Reply To Email
  replyAll?: boolean;
  // Forward Email
  forwardTo?: string;
  // Add Label
  labelId?: string;
  labelName?: string; // Create label if doesn't exist
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    gmailChannel().status({
      nodeId,
      status,
    })
  );
};

// Helper to get authenticated Gmail client
const getGmailClient = async (accessToken: string) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
};

// Helper to create email message
const createEmailMessage = (
  to: string,
  subject: string,
  body: string,
  isHtml: boolean,
  cc?: string,
  bcc?: string
) => {
  const messageParts: string[] = [];

  messageParts.push(`To: ${to}`);
  if (cc) messageParts.push(`Cc: ${cc}`);
  if (bcc) messageParts.push(`Bcc: ${bcc}`);
  messageParts.push(`Subject: ${subject}`);
  messageParts.push(`Content-Type: ${isHtml ? "text/html" : "text/plain"}; charset=utf-8`);
  messageParts.push("");
  messageParts.push(body);

  const message = messageParts.join("\n");
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

// Helper to create email message with attachment
const createEmailMessageWithAttachment = async (
  to: string,
  subject: string,
  body: string,
  isHtml: boolean,
  attachmentUrl: string,
  attachmentName: string,
  cc?: string,
  bcc?: string
) => {
  // Download attachment
  const attachmentResponse = await fetch(attachmentUrl);
  if (!attachmentResponse.ok) {
    throw new Error(`Failed to download attachment from ${attachmentUrl}`);
  }
  const attachmentBuffer = Buffer.from(await attachmentResponse.arrayBuffer());
  const attachmentBase64 = attachmentBuffer.toString("base64");

  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const messageParts: string[] = [];
  messageParts.push(`To: ${to}`);
  if (cc) messageParts.push(`Cc: ${cc}`);
  if (bcc) messageParts.push(`Bcc: ${bcc}`);
  messageParts.push(`Subject: ${subject}`);
  messageParts.push(`MIME-Version: 1.0`);
  messageParts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  messageParts.push("");
  messageParts.push(`--${boundary}`);
  messageParts.push(`Content-Type: ${isHtml ? "text/html" : "text/plain"}; charset=utf-8`);
  messageParts.push(`Content-Transfer-Encoding: 7bit`);
  messageParts.push("");
  messageParts.push(body);
  messageParts.push("");
  messageParts.push(`--${boundary}`);
  messageParts.push(`Content-Type: application/octet-stream; name="${attachmentName}"`);
  messageParts.push(`Content-Transfer-Encoding: base64`);
  messageParts.push(`Content-Disposition: attachment; filename="${attachmentName}"`);
  messageParts.push("");
  messageParts.push(attachmentBase64);
  messageParts.push(`--${boundary}--`);

  const message = messageParts.join("\n");
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

export const gmailExecutor: NodeExecutor<GmailData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "gmail";

    if (!data.action) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Gmail node: Action is required");
      await publish(
        gmailChannel().output({
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
          : "Gmail node: Failed to get access token. Please connect your Google account."
      );
      await publish(
        gmailChannel().output({
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

    const gmail = await getGmailClient(accessToken);
    let result: any;

    // Compile Handlebars templates
    const compileTemplate = (template: string) => {
      if (!template) return template;
      return Handlebars.compile(template)(context);
    };

    // Execute action
    switch (data.action) {
      case "sendEmail": {
        if (!data.to) {
          throw new NonRetriableError("Gmail node: 'To' email address is required");
        }
        if (!data.subject) {
          throw new NonRetriableError("Gmail node: Subject is required");
        }
        if (!data.body) {
          throw new NonRetriableError("Gmail node: Email body is required");
        }

        const to = compileTemplate(data.to);
        const subject = compileTemplate(data.subject);
        const body = compileTemplate(data.body);
        const isHtml = data.isHtml || false;
        const cc = data.cc ? compileTemplate(data.cc) : undefined;
        const bcc = data.bcc ? compileTemplate(data.bcc) : undefined;

        result = await step.run("send-email", async () => {
          const rawMessage = createEmailMessage(to, subject, body, isHtml, cc, bcc);

          const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
              raw: rawMessage,
            },
          });

          return {
            id: response.data.id,
            threadId: response.data.threadId,
            labelIds: response.data.labelIds,
          };
        });
        break;
      }

      case "sendEmailWithAttachment": {
        if (!data.to) {
          throw new NonRetriableError("Gmail node: 'To' email address is required");
        }
        if (!data.subject) {
          throw new NonRetriableError("Gmail node: Subject is required");
        }
        if (!data.body) {
          throw new NonRetriableError("Gmail node: Email body is required");
        }
        if (!data.attachmentUrl && !data.attachmentDriveFileId) {
          throw new NonRetriableError("Gmail node: Attachment URL or Drive File ID is required");
        }
        if (!data.attachmentName) {
          throw new NonRetriableError("Gmail node: Attachment name is required");
        }

        const to = compileTemplate(data.to);
        const subject = compileTemplate(data.subject);
        const body = compileTemplate(data.body);
        const isHtml = data.isHtml || false;
        const cc = data.cc ? compileTemplate(data.cc) : undefined;
        const bcc = data.bcc ? compileTemplate(data.bcc) : undefined;
        const attachmentName = compileTemplate(data.attachmentName);

        let attachmentUrl: string;
        if (data.attachmentUrl) {
          attachmentUrl = compileTemplate(data.attachmentUrl);
        } else if (data.attachmentDriveFileId) {
          // Convert Drive file ID to download URL
          attachmentUrl = `https://drive.google.com/uc?export=download&id=${compileTemplate(data.attachmentDriveFileId)}`;
        } else {
          throw new NonRetriableError("Gmail node: Attachment URL or Drive File ID is required");
        }

        result = await step.run("send-email-with-attachment", async () => {
          const rawMessage = await createEmailMessageWithAttachment(
            to,
            subject,
            body,
            isHtml,
            attachmentUrl,
            attachmentName,
            cc,
            bcc
          );

          const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
              raw: rawMessage,
            },
          });

          return {
            id: response.data.id,
            threadId: response.data.threadId,
            labelIds: response.data.labelIds,
          };
        });
        break;
      }

      case "listEmails": {
        const query = data.query ? compileTemplate(data.query) : "";
        const maxResults = data.maxResults || 10;

        result = await step.run("list-emails", async () => {
          const response = await gmail.users.messages.list({
            userId: "me",
            q: query,
            maxResults,
          });

          const messages = response.data.messages || [];

          // Get full details for each message
          const messageDetails = await Promise.all(
            messages.map(async (msg) => {
              const message = await gmail.users.messages.get({
                userId: "me",
                id: msg.id!,
                format: "metadata",
                metadataHeaders: ["From", "To", "Subject", "Date"],
              });

              const headers = message.data.payload?.headers || [];
              const getHeader = (name: string) =>
                headers.find((h: any) => h.name === name)?.value || "";

              return {
                id: message.data.id,
                threadId: message.data.threadId,
                snippet: message.data.snippet,
                from: getHeader("From"),
                to: getHeader("To"),
                subject: getHeader("Subject"),
                date: getHeader("Date"),
                labelIds: message.data.labelIds,
              };
            })
          );

          return {
            messages: messageDetails,
            resultSizeEstimate: response.data.resultSizeEstimate,
          };
        });
        break;
      }

      case "getEmail": {
        if (!data.emailId) {
          throw new NonRetriableError("Gmail node: Email ID is required");
        }

        const emailId = compileTemplate(data.emailId);

        result = await step.run("get-email", async () => {
          const response = await gmail.users.messages.get({
            userId: "me",
            id: emailId,
            format: "full",
          });

          const headers = response.data.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: any) => h.name === name)?.value || "";

          // Extract body
          let body = "";
          const extractBody = (part: any) => {
            if (part.body?.data) {
              body += Buffer.from(part.body.data, "base64").toString("utf-8");
            }
            if (part.parts) {
              part.parts.forEach(extractBody);
            }
          };
          extractBody(response.data.payload);

          return {
            id: response.data.id,
            threadId: response.data.threadId,
            from: getHeader("From"),
            to: getHeader("To"),
            subject: getHeader("Subject"),
            date: getHeader("Date"),
            body,
            labelIds: response.data.labelIds,
            snippet: response.data.snippet,
          };
        });
        break;
      }

      case "createDraft": {
        if (!data.to) {
          throw new NonRetriableError("Gmail node: 'To' email address is required");
        }
        if (!data.subject) {
          throw new NonRetriableError("Gmail node: Subject is required");
        }
        if (!data.body) {
          throw new NonRetriableError("Gmail node: Email body is required");
        }

        const to = compileTemplate(data.to);
        const subject = compileTemplate(data.subject);
        const body = compileTemplate(data.body);
        const isHtml = data.isHtml || false;
        const cc = data.cc ? compileTemplate(data.cc) : undefined;
        const bcc = data.bcc ? compileTemplate(data.bcc) : undefined;

        result = await step.run("create-draft", async () => {
          const rawMessage = createEmailMessage(to, subject, body, isHtml, cc, bcc);

          const response = await gmail.users.drafts.create({
            userId: "me",
            requestBody: {
              message: {
                raw: rawMessage,
              },
            },
          });

          return {
            id: response.data.id,
            message: {
              id: response.data.message?.id,
              threadId: response.data.message?.threadId,
            },
          };
        });
        break;
      }

      case "sendDraft": {
        if (!data.draftId) {
          throw new NonRetriableError("Gmail node: Draft ID is required");
        }

        const draftId = compileTemplate(data.draftId);

        result = await step.run("send-draft", async () => {
          const response = await gmail.users.drafts.send({
            userId: "me",
            requestBody: {
              id: draftId,
            },
          });

          return {
            id: response.data.id,
            threadId: response.data.threadId,
            labelIds: response.data.labelIds,
          };
        });
        break;
      }

      case "replyToEmail": {
        if (!data.emailId) {
          throw new NonRetriableError("Gmail node: Email ID is required");
        }
        if (!data.body) {
          throw new NonRetriableError("Gmail node: Reply body is required");
        }

        const emailId = compileTemplate(data.emailId);
        const body = compileTemplate(data.body);
        const isHtml = data.isHtml || false;
        const replyAll = data.replyAll || false;

        result = await step.run("reply-to-email", async () => {
          // Get the original message to extract headers
          const originalMessage = await gmail.users.messages.get({
            userId: "me",
            id: emailId,
            format: "metadata",
            metadataHeaders: ["From", "To", "Subject", "Message-ID"],
          });

          const headers = originalMessage.data.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: any) => h.name === name)?.value || "";

          const from = getHeader("From");
          const subject = getHeader("Subject");
          const messageId = getHeader("Message-ID");

          // Create reply message
          const replyTo = replyAll ? getHeader("To") : from;
          const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

          const rawMessage = createEmailMessage(replyTo, replySubject, body, isHtml);

          const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
              raw: rawMessage,
              threadId: originalMessage.data.threadId,
            },
          });

          return {
            id: response.data.id,
            threadId: response.data.threadId,
            labelIds: response.data.labelIds,
          };
        });
        break;
      }

      case "forwardEmail": {
        if (!data.emailId) {
          throw new NonRetriableError("Gmail node: Email ID is required");
        }
        if (!data.forwardTo) {
          throw new NonRetriableError("Gmail node: Forward To email address is required");
        }

        const emailId = compileTemplate(data.emailId);
        const forwardTo = compileTemplate(data.forwardTo);

        result = await step.run("forward-email", async () => {
          // Get the original message
          const originalMessage = await gmail.users.messages.get({
            userId: "me",
            id: emailId,
            format: "full",
          });

          const headers = originalMessage.data.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: any) => h.name === name)?.value || "";

          const subject = getHeader("Subject");
          const forwardSubject = subject.startsWith("Fwd:") ? subject : `Fwd: ${subject}`;

          // Extract original message body
          let originalBody = "";
          const extractBody = (part: any) => {
            if (part.body?.data) {
              originalBody += Buffer.from(part.body.data, "base64").toString("utf-8");
            }
            if (part.parts) {
              part.parts.forEach(extractBody);
            }
          };
          extractBody(originalMessage.data.payload);

          // Create forward message
          const forwardBody = `---------- Forwarded message ----------\nFrom: ${getHeader("From")}\nDate: ${getHeader("Date")}\nSubject: ${subject}\nTo: ${getHeader("To")}\n\n${originalBody}`;

          const rawMessage = createEmailMessage(forwardTo, forwardSubject, forwardBody, false);

          const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
              raw: rawMessage,
            },
          });

          return {
            id: response.data.id,
            threadId: response.data.threadId,
            labelIds: response.data.labelIds,
          };
        });
        break;
      }

      case "deleteEmail": {
        if (!data.emailId) {
          throw new NonRetriableError("Gmail node: Email ID is required");
        }

        const emailId = compileTemplate(data.emailId);

        result = await step.run("delete-email", async () => {
          await gmail.users.messages.delete({
            userId: "me",
            id: emailId,
          });

          return {
            success: true,
            emailId,
          };
        });
        break;
      }

      default:
        throw new NonRetriableError(`Gmail node: Unknown action: ${data.action}`);
    }

    // Publish success status and output
    await publishStatus(publish, nodeId, "success");
    await publish(
      gmailChannel().output({
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
      gmailChannel().output({
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
      `Gmail action failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
