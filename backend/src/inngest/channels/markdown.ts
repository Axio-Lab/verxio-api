import { channel, topic } from "@inngest/realtime";

export const MARKDOWN_CHANNEL = "markdown-execution";
export const markdownChannel = channel(MARKDOWN_CHANNEL)
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
