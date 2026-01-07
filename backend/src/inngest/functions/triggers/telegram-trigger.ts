import type { NodeExecutor } from "../types";
import { telegramTriggerChannel } from "@/inngest/channels/telegram-trigger";
import { NonRetriableError } from "inngest";

type TelegramTriggerData = Record<string, unknown>;

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    telegramTriggerChannel().status({
      nodeId,
      status,
    })
  );
};

export const telegramTriggerExecutor: NodeExecutor<TelegramTriggerData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  try {
    // Publish loading status
    await publishStatus(publish, nodeId, "loading");

    // Telegram trigger receives data from Telegram webhook
    // The context should contain telegramPayload from the webhook/route
    // Extract message data and make it available to subsequent nodes
    const result = await step.run("telegram-trigger", async () => {
      // Extract Telegram payload from context (set by webhook/route)
      const telegramPayload = (context as any).telegramPayload || {};

      // Make message data available in context for subsequent nodes
      // Use the variable name from node data, default to "telegram"
      const variableName = "telegram";

      return {
        ...context,
        [variableName]: {
          payload: telegramPayload,
          message: telegramPayload.message || {},
          chat: telegramPayload.message?.chat || {},
          from: telegramPayload.message?.from || {},
        },
      };
    });

    // Publish success status before returning
    await publishStatus(publish, nodeId, "success");

    // Publish node output to realtime channel
    await publish(
      telegramTriggerChannel().output({
        nodeId,
        output: result,
      })
    );

    return result;
  } catch (error) {
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
    await publish(
      telegramTriggerChannel().output({
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
      `Telegram trigger failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
