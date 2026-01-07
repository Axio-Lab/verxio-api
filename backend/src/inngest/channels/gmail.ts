import { channel, topic } from "@inngest/realtime";

export const GMAIL_CHANNEL = "gmail-execution";
export const gmailChannel = channel(GMAIL_CHANNEL)
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
