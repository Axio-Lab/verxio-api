import { channel, topic } from "@inngest/realtime";

export const TELEGRAM_TRIGGER_CHANNEL = "telegram-trigger-execution";
export const telegramTriggerChannel = channel(TELEGRAM_TRIGGER_CHANNEL)
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
