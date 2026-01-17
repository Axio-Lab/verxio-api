import { channel, topic } from "@inngest/realtime";

export const GOOGLE_MEET_CHANNEL = "google-meet-execution";
export const googleMeetChannel = channel(GOOGLE_MEET_CHANNEL)
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
