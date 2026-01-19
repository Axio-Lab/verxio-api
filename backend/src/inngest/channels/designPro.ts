import { channel, topic } from "@inngest/realtime";

export const DESIGN_PRO_CHANNEL = "design-pro-execution";
export const designProChannel = channel(DESIGN_PRO_CHANNEL)
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
  )
  .addTopic(
    topic("chat").type<{
      nodeId: string;
      message: string;
      imageUrl?: string;
    }>()
  );
