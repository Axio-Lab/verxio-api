import { channel, topic } from "@inngest/realtime";

export const ELEVENLABS_CHANNEL = "elevenlabs-execution";
export const elevenlabsChannel = channel(ELEVENLABS_CHANNEL)
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
