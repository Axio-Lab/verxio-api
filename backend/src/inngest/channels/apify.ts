import { channel, topic } from "@inngest/realtime";

export const APIFY_CHANNEL = "apify-execution";
export const apifyChannel = channel(APIFY_CHANNEL)
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
