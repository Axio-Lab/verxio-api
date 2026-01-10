import type { NodeExecutor } from "../types";
import { googleMeetChannel } from "@/inngest/channels/google-meet";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { getValidAccessToken } from "@/services/googleOAuthService";
import { google } from "googleapis";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type GoogleMeetData = {
  variables?: string;
  action?: "createMeeting" | "getMeetingLink";
  // Create Meeting (via Calendar)
  calendarId?: string;
  summary?: string;
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
  timeZone?: string;
  attendees?: string; // JSON array of email addresses
  location?: string;
  // Get Meeting Link
  eventId?: string;
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    googleMeetChannel().status({
      nodeId,
      status,
    })
  );
};

// Helper to get authenticated Google Calendar client
const getCalendarClient = async (accessToken: string) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
};

export const googleMeetExecutor: NodeExecutor<GoogleMeetData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "googleMeet";

    if (!data.action) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Google Meet node: Action is required");
      await publish(
        googleMeetChannel().output({
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
          : "Google Meet node: Failed to get access token. Please connect your Google account."
      );
      await publish(
        googleMeetChannel().output({
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

    const calendar = await getCalendarClient(accessToken);
    let result: any;

    // Compile Handlebars templates
    const compileTemplate = (template: string) => {
      if (!template) return template;
      return Handlebars.compile(template)(context);
    };

    // Execute action
    switch (data.action) {
      case "createMeeting": {
        if (!data.summary) {
          throw new NonRetriableError("Google Meet node: Meeting title is required");
        }
        if (!data.startDateTime) {
          throw new NonRetriableError("Google Meet node: Start date/time is required");
        }
        if (!data.endDateTime) {
          throw new NonRetriableError("Google Meet node: End date/time is required");
        }

        const calendarId = compileTemplate(data.calendarId || "primary");
        const summary = compileTemplate(data.summary);
        const description = data.description ? compileTemplate(data.description) : undefined;
        const startDateTime = compileTemplate(data.startDateTime);
        const endDateTime = compileTemplate(data.endDateTime);
        const timeZone = compileTemplate(data.timeZone || "UTC");

        let attendees: string[] = [];
        if (data.attendees) {
          try {
            const attendeesStr = compileTemplate(data.attendees);
            attendees = JSON.parse(attendeesStr);
          } catch (error) {
            // If not JSON, treat as comma-separated
            attendees = compileTemplate(data.attendees)
              .split(",")
              .map((email: string) => email.trim())
              .filter((email: string) => email);
          }
        }

        result = await step.run("create-meeting", async () => {
          const event = {
            summary,
            description,
            start: {
              dateTime: startDateTime,
              timeZone,
            },
            end: {
              dateTime: endDateTime,
              timeZone,
            },
            conferenceData: {
              createRequest: {
                requestId: `meet-${Date.now()}`,
                conferenceSolutionKey: {
                  type: "hangoutsMeet",
                },
              },
            },
            ...(attendees.length > 0 && {
              attendees: attendees.map((email) => ({ email })),
            }),
          };

          const response = await calendar.events.insert({
            calendarId,
            requestBody: event,
            conferenceDataVersion: 1,
          });

          return {
            eventId: response.data.id,
            summary: response.data.summary,
            start: response.data.start,
            end: response.data.end,
            htmlLink: response.data.htmlLink,
            meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri,
            hangoutLink: response.data.hangoutLink,
            attendees: response.data.attendees,
          };
        });
        break;
      }

      case "getMeetingLink": {
        if (!data.eventId) {
          throw new NonRetriableError("Google Meet node: Event ID is required");
        }

        const calendarId = compileTemplate(data.calendarId || "primary");
        const eventId = compileTemplate(data.eventId);

        result = await step.run("get-meeting-link", async () => {
          const response = await calendar.events.get({
            calendarId,
            eventId,
          });

          return {
            eventId: response.data.id,
            summary: response.data.summary,
            meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri,
            hangoutLink: response.data.hangoutLink,
            htmlLink: response.data.htmlLink,
          };
        });
        break;
      }

      default:
        throw new NonRetriableError(`Google Meet node: Unknown action: ${data.action}`);
    }

    await publishStatus(publish, nodeId, "success");

    // Publish node output to realtime channel
    await publish(
      googleMeetChannel().output({
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
      googleMeetChannel().output({
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
      `Google Meet action failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
