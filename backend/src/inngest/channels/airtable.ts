import { channel, topic } from "@inngest/realtime";

export const AIRTABLE_CHANNEL = "airtable-execution";
export const airtableChannel = channel(AIRTABLE_CHANNEL)
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
