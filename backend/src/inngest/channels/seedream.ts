import { channel, topic } from "@inngest/realtime";

export const SEEDREAM_CHANNEL = "seedream-execution";
export const seedreamChannel = channel(SEEDREAM_CHANNEL)
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
