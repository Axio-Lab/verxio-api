import type { NodeExecutor } from "../types";
import { whatsappTriggerChannel } from "@/inngest/channels/whatsapp-trigger";
import { NonRetriableError } from "inngest";

type WhatsAppTriggerData = Record<string, unknown>;

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    whatsappTriggerChannel().status({
      nodeId,
      status,
    })
  );
};

export const whatsappTriggerExecutor: NodeExecutor<WhatsAppTriggerData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  try {
    // Publish loading status
    await publishStatus(publish, nodeId, "loading");

    // WhatsApp trigger receives data from WhatsApp webhook
    // The context should contain whatsappPayload from the webhook/route
    // Extract message data and make it available to subsequent nodes
    const result = await step.run("whatsapp-trigger", async () => {
      // Extract WhatsApp payload from context (set by webhook/route)
      const whatsappPayload = (context as any).whatsappPayload || {};

      // Make message data available in context for subsequent nodes
      // Use the variable name from node data, default to "whatsapp"
      const variableName = "whatsapp";

      return {
        ...context,
        [variableName]: {
          payload: whatsappPayload,
        },
      };
    });

    // Publish success status before returning
    await publishStatus(publish, nodeId, "success");

    // Publish node output to realtime channel
    await publish(
      whatsappTriggerChannel().output({
        nodeId,
        output: result,
      })
    );

    return result;
  } catch (error) {
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
    await publish(
      whatsappTriggerChannel().output({
        nodeId,
        output: {
          ...context,
          error: {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
          },
        },
      })
    );

    if (error instanceof NonRetriableError) {
      throw error;
    }
    throw new NonRetriableError(
      `WhatsApp trigger failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
