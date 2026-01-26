import { channel, topic } from "@inngest/realtime";

export const VEO_CHANNEL = "veo-execution";
export const veoChannel = channel(VEO_CHANNEL)
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
