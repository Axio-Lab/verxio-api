import { channel, topic } from "@inngest/realtime";

export const FIRECRAWL_CHANNEL = "firecrawl-execution";
export const firecrawlChannel = channel(FIRECRAWL_CHANNEL)
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
