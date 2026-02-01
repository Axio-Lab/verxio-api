import { channel, topic } from "@inngest/realtime";

export const KLING_CHANNEL = "kling-execution";
export const klingChannel = channel(KLING_CHANNEL)
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
