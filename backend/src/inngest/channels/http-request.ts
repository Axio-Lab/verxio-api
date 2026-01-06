import { channel, topic } from "@inngest/realtime";

export const HTTP_REQUEST_CHANNEL = "http-request-execution";
export const httpRequestChannel = channel(HTTP_REQUEST_CHANNEL)
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
