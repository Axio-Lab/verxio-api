import type { NodeExecutor } from "../types";
import { googleCalendarChannel } from "@/inngest/channels/google-calendar";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { getValidAccessToken } from "@/services/googleOAuthService";
import { google } from "googleapis";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type GoogleCalendarData = {
  variables?: string;

  action?:
    | "createEvent"
    | "listEvents"
    | "updateEvent"
    | "deleteEvent"
    | "getEvent"
    | "findFreeBusy";
  // Create/Update Event
  calendarId?: string;
  summary?: string;
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
  timeZone?: string;
  attendees?: string; // JSON array of email addresses
  location?: string;
  /** When true, creates a Google Meet link for the event (virtual meeting). Only for createEvent. */
  addMeetLink?: boolean;
  // List Events
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  // Update/Delete/Get Event
  eventId?: string;
  // Find Free/Busy
  items?: string; // JSON array of {id: calendarId}
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    googleCalendarChannel().status({
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

export const googleCalendarExecutor: NodeExecutor<GoogleCalendarData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "googleCalendar";

    if (!data.action) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Google Calendar node: Action is required");
      await publish(
        googleCalendarChannel().output({
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
          : "Google Calendar node: Failed to get access token. Please connect your Google account."
      );
      await publish(
        googleCalendarChannel().output({
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
      case "createEvent": {
        if (!data.summary) {
          throw new NonRetriableError("Google Calendar node: Event summary is required");
        }
        if (!data.startDateTime) {
          throw new NonRetriableError("Google Calendar node: Start date/time is required");
        }
        if (!data.endDateTime) {
          throw new NonRetriableError("Google Calendar node: End date/time is required");
        }

        const calendarId = compileTemplate(data.calendarId || "primary");
        const summary = compileTemplate(data.summary);
        const description = data.description ? compileTemplate(data.description) : undefined;
        const startDateTime = compileTemplate(data.startDateTime);
        const endDateTime = compileTemplate(data.endDateTime);
        const timeZone = compileTemplate(data.timeZone || "UTC");
        const location = data.location ? compileTemplate(data.location) : undefined;

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

        const addMeetLink = Boolean(data.addMeetLink);

        result = await step.run("create-event", async () => {
          const event: Record<string, unknown> = {
            summary,
            description,
            location,
            start: {
              dateTime: startDateTime,
              timeZone,
            },
            end: {
              dateTime: endDateTime,
              timeZone,
            },
            ...(attendees.length > 0 && {
              attendees: attendees.map((email) => ({ email })),
            }),
          };

          if (addMeetLink) {
            event.conferenceData = {
              createRequest: {
                requestId: `verxio-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            };
          }

          const response = await calendar.events.insert({
            calendarId,
            conferenceDataVersion: addMeetLink ? 1 : 0,
            requestBody: event,
          });

          return {
            eventId: response.data.id,
            summary: response.data.summary,
            start: response.data.start,
            end: response.data.end,
            htmlLink: response.data.htmlLink,
            hangoutLink: response.data.hangoutLink ?? undefined,
            conferenceData: response.data.conferenceData ?? undefined,
            attendees: response.data.attendees,
          };
        });
        break;
      }

      case "listEvents": {
        const calendarId = compileTemplate(data.calendarId || "primary");
        const timeMin = data.timeMin ? compileTemplate(data.timeMin) : new Date().toISOString();
        const timeMax = data.timeMax ? compileTemplate(data.timeMax) : undefined;
        const maxResults = data.maxResults || 10;

        result = await step.run("list-events", async () => {
          const response = await calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            maxResults,
            singleEvents: true,
            orderBy: "startTime",
          });

          return {
            events: response.data.items || [],
            count: response.data.items?.length || 0,
          };
        });
        break;
      }

      case "updateEvent": {
        if (!data.eventId) {
          throw new NonRetriableError("Google Calendar node: Event ID is required");
        }

        const calendarId = compileTemplate(data.calendarId || "primary");
        const eventId = compileTemplate(data.eventId);

        result = await step.run("get-event", async () => {
          const existingEvent = await calendar.events.get({
            calendarId,
            eventId,
          });

          const updates: any = {};
          if (data.summary) updates.summary = compileTemplate(data.summary);
          if (data.description) updates.description = compileTemplate(data.description);
          if (data.location) updates.location = compileTemplate(data.location);
          if (data.startDateTime) {
            updates.start = {
              dateTime: compileTemplate(data.startDateTime),
              timeZone: compileTemplate(data.timeZone || "UTC"),
            };
          }
          if (data.endDateTime) {
            updates.end = {
              dateTime: compileTemplate(data.endDateTime),
              timeZone: compileTemplate(data.timeZone || "UTC"),
            };
          }

          const response = await calendar.events.update({
            calendarId,
            eventId,
            requestBody: {
              ...existingEvent.data,
              ...updates,
            },
          });

          return {
            eventId: response.data.id,
            summary: response.data.summary,
            start: response.data.start,
            end: response.data.end,
            htmlLink: response.data.htmlLink,
          };
        });
        break;
      }

      case "deleteEvent": {
        if (!data.eventId) {
          throw new NonRetriableError("Google Calendar node: Event ID is required");
        }

        const calendarId = compileTemplate(data.calendarId || "primary");
        const eventId = compileTemplate(data.eventId);

        result = await step.run("delete-event", async () => {
          await calendar.events.delete({
            calendarId,
            eventId,
          });

          return {
            eventId,
            deleted: true,
          };
        });
        break;
      }

      case "getEvent": {
        if (!data.eventId) {
          throw new NonRetriableError("Google Calendar node: Event ID is required");
        }

        const calendarId = compileTemplate(data.calendarId || "primary");
        const eventId = compileTemplate(data.eventId);

        result = await step.run("get-event", async () => {
          const response = await calendar.events.get({
            calendarId,
            eventId,
          });

          return {
            ...response.data,
          };
        });
        break;
      }

      case "findFreeBusy": {
        if (!data.items) {
          throw new NonRetriableError(
            "Google Calendar node: Calendar items are required for findFreeBusy"
          );
        }

        const timeMin = data.timeMin ? compileTemplate(data.timeMin) : new Date().toISOString();
        const timeMax = data.timeMax ? compileTemplate(data.timeMax) : undefined;

        let items: Array<{ id: string }>;
        try {
          const itemsStr = compileTemplate(data.items);
          items = JSON.parse(itemsStr);
        } catch (error) {
          // If not JSON, treat as comma-separated calendar IDs
          items = compileTemplate(data.items)
            .split(",")
            .map((id: string) => ({ id: id.trim() }))
            .filter((item: { id: string }) => item.id);
        }

        result = await step.run("find-free-busy", async () => {
          const response = await calendar.freebusy.query({
            requestBody: {
              timeMin,
              timeMax,
              items,
            },
          });

          return {
            calendars: response.data.calendars,
          };
        });
        break;
      }

      default:
        throw new NonRetriableError(`Google Calendar node: Unknown action: ${data.action}`);
    }

    await publishStatus(publish, nodeId, "success");

    // Publish node output to realtime channel
    await publish(
      googleCalendarChannel().output({
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
      googleCalendarChannel().output({
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
      `Google Calendar action failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
