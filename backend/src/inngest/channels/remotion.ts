import { channel, topic } from "@inngest/realtime";

export const REMOTION_CHANNEL = "remotion-execution";
export const remotionChannel = channel(REMOTION_CHANNEL)
  .addTopic(
    topic("status").type<{
      nodeId: string;
      status: "loading" | "rendering" | "error" | "success";
    }>()
  )
  .addTopic(
    topic("output").type<{
      nodeId: string;
      output: Record<string, unknown>;
    }>()
  );
