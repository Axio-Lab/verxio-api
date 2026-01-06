import { channel, topic } from "@inngest/realtime";

export const OPENAI_CHANNEL = "openai-execution";
export const openaiChannel = channel(OPENAI_CHANNEL)
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
