import { channel, topic } from "@inngest/realtime";

export const GOOGLE_SHEETS_CHANNEL = "google-sheets-execution";
export const googleSheetsChannel = channel(GOOGLE_SHEETS_CHANNEL)
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
