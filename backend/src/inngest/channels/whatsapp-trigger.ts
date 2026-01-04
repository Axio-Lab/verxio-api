import { channel, topic } from "@inngest/realtime";

export const WHATSAPP_TRIGGER_CHANNEL = "whatsapp-trigger-execution";
export const whatsappTriggerChannel = channel(WHATSAPP_TRIGGER_CHANNEL).addTopic(
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>()
);
