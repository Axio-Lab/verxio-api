import { channel, topic } from "@inngest/realtime";

export const VALYU_CHANNEL = "valyu-execution";
export const valyuChannel = channel(VALYU_CHANNEL)
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
