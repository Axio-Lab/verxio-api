import { channel, topic } from "@inngest/realtime";

export const TIMED_TRIGGER_CHANNEL = "timed-trigger-execution";
export const timedTriggerChannel = channel(TIMED_TRIGGER_CHANNEL)
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
