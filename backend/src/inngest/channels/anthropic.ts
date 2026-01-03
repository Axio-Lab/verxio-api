import { channel, topic } from "@inngest/realtime";

export const ANTHROPIC_CHANNEL = "anthropic-execution";
export const anthropicChannel = channel(ANTHROPIC_CHANNEL)
.addTopic(topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
}>()
);

