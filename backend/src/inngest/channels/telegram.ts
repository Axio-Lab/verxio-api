import { channel, topic } from "@inngest/realtime";

export const TELEGRAM_CHANNEL = "telegram-execution";
export const telegramChannel = channel(TELEGRAM_CHANNEL)
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
