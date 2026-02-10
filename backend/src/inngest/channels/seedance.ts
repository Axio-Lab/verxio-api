import { channel, topic } from "@inngest/realtime";

export const SEEDANCE_CHANNEL = "seedance-execution";
export const seedanceChannel = channel(SEEDANCE_CHANNEL)
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
