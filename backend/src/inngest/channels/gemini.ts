import { channel, topic } from "@inngest/realtime";

export const GEMINI_CHANNEL = "gemini-execution";
export const geminiChannel = channel(GEMINI_CHANNEL)
.addTopic(topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
}>()
);

