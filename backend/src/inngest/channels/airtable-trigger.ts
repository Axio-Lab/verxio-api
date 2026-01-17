import { channel, topic } from "@inngest/realtime";

export const AIRTABLE_TRIGGER_CHANNEL = "airtable-trigger-execution";
export const airtableTriggerChannel = channel(AIRTABLE_TRIGGER_CHANNEL)
  .addTopic(
    topic("status").type<{
      nodeId: string;
      status: "loading" | "success" | "error";
    }>()
  )
  .addTopic(
    topic("output").type<{
      nodeId: string;
      output: Record<string, unknown>;
    }>()
  );
