import { channel, topic } from "@inngest/realtime";

export const DISCORD_CHANNEL = "discord-execution";
export const discordChannel = channel(DISCORD_CHANNEL).addTopic(
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>()
);
