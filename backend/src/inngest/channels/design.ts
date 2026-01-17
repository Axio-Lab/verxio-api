import { channel, topic } from "@inngest/realtime";

export const DESIGN_CHANNEL = "design-execution";
export const designChannel = channel(DESIGN_CHANNEL)
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
