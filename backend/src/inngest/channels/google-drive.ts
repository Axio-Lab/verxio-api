import { channel, topic } from "@inngest/realtime";

export const GOOGLE_DRIVE_CHANNEL = "google-drive-execution";
export const googleDriveChannel = channel(GOOGLE_DRIVE_CHANNEL)
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
