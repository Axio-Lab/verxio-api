import { channel, topic } from "@inngest/realtime";

export const GOOGLE_FORM_TRIGGER_CHANNEL = "google-form-trigger-execution";
export const googleFormTriggerChannel = channel(GOOGLE_FORM_TRIGGER_CHANNEL)
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
