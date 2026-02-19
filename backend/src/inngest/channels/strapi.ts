import { channel, topic } from "@inngest/realtime";

export const STRAPI_CHANNEL = "strapi-execution";
export const strapiChannel = channel(STRAPI_CHANNEL)
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
