import { channel, topic } from "@inngest/realtime";

export const COMPOSIO_ACTION_CHANNEL = "composio-action-execution";
export const composioActionChannel = channel(COMPOSIO_ACTION_CHANNEL)
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
