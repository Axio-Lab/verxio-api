import { channel, topic } from "@inngest/realtime";

export const COMPOSIO_TRIGGER_CHANNEL = "composio-trigger-execution";
export const composioTriggerChannel = channel(COMPOSIO_TRIGGER_CHANNEL)
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
