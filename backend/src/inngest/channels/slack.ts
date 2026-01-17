import { channel, topic } from "@inngest/realtime";

export const SLACK_CHANNEL = "slack-execution";
export const slackChannel = channel(SLACK_CHANNEL)
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
