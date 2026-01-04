import { channel, topic } from "@inngest/realtime";

export const WHATSAPP_CHANNEL = "whatsapp-execution";
export const whatsappChannel = channel(WHATSAPP_CHANNEL).addTopic(
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>()
);
