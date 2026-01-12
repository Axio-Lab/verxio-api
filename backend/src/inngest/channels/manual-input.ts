import { channel, topic } from "@inngest/realtime";

export const MANUAL_INPUT_CHANNEL = "manual-input-execution";
export const manualInputChannel = channel(MANUAL_INPUT_CHANNEL)
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
