import { channel, topic } from "@inngest/realtime";

export const GOOGLE_DOCS_CHANNEL = "google-docs-execution";
export const googleDocsChannel = channel(GOOGLE_DOCS_CHANNEL)
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
