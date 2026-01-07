import { channel, topic } from "@inngest/realtime";

export const GOOGLE_CALENDAR_CHANNEL = "google-calendar-execution";
export const googleCalendarChannel = channel(GOOGLE_CALENDAR_CHANNEL)
  .addTopic(
    topic("status").type<{
      nodeId: string;
      status: "loading" | "error" | "success";
    }>()
  )
  .addTopic(
    topic("output").type<{
      nodeId: string;
      output: Record<string, unknown>;
    }>()
  );
