import type { NodeExecutor } from "../types";
import { whatsappChannel } from "@/inngest/channels/whatsapp";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type WhatsAppData = {
  variables?: string;
  phoneNumber?: string;
  message?: string;
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    whatsappChannel().status({
      nodeId,
      status,
    })
  );
};

export const whatsappExecutor: NodeExecutor<WhatsAppData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "whatsapp";
    if (!data.phoneNumber) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("WhatsApp node: Phone number is required");
      await publish(
        whatsappChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: error.message,
            },
          },
        })
      );
      throw error;
    }
    if (!data.message) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("WhatsApp node: Message is required");
      await publish(
        whatsappChannel().output({
          nodeId,
          output: {
            ...context,
            error: {
              message: error.message,
            },
          },
        })
      );
      throw error;
    }

    const phoneNumber = Handlebars.compile(data.phoneNumber)(context);
    const message = Handlebars.compile(data.message)(context);

    // TODO: Implement actual WhatsApp API integration
    // For now, we'll simulate the API call
    const result = await step.run("send-whatsapp-message", async () => {
      // Simulate WhatsApp API call
      // Replace this with actual WhatsApp API integration (e.g., Twilio, WhatsApp Business API)
      const response = {
        success: true,
        messageId: `msg_${Date.now()}`,
        phoneNumber,
        message,
      };

      return {
        ...context,
        [variablesName]: {
          response,
        },
      };
    });

    await publishStatus(publish, nodeId, "success");

    // Publish node output to realtime channel
    await publish(
      whatsappChannel().output({
        nodeId,
        output: result,
      })
    );

    return result;
  } catch (error) {
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
    await publish(
      whatsappChannel().output({
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
      `WhatsApp request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
