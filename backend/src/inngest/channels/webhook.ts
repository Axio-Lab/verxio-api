import { channel, topic } from "@inngest/realtime";

export const WEBHOOK_CHANNEL = "webhook-execution";
export const webhookChannel = channel(WEBHOOK_CHANNEL)
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
