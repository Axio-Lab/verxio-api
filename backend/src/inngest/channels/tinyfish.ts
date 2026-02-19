import { channel, topic } from "@inngest/realtime";

export const TINYFISH_CHANNEL = "tinyfish-execution";
export const tinyfishChannel = channel(TINYFISH_CHANNEL)
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
