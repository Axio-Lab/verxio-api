import { channel, topic } from "@inngest/realtime";

export const DECIDER_CHANNEL = "decider-execution";
export const deciderChannel = channel(DECIDER_CHANNEL)
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
