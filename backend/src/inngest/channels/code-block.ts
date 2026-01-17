import { channel, topic } from "@inngest/realtime";

export const CODE_BLOCK_CHANNEL = "code-block-execution";
export const codeBlockChannel = channel(CODE_BLOCK_CHANNEL)
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
