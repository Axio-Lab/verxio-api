import type { NodeExecutor } from "../types";
import { whatsappChannel } from "@/inngest/channels/whatsapp";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { sendWhatsAppMessage } from "@/services/whatsappConnectorClient";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type WhatsAppData = {
  variables?: string;
  phoneNumber?: string;
  message?: string;
  credentialId?: string;
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
    const sessionRef =
      data.credentialId ??
      (context as any).whatsappSessionRef ??
      (context as any).whatsappPayload?.__integrationId;

    if (!sessionRef) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        "WhatsApp node: No session. Attach a WhatsApp credential to this node, or run this workflow from a WhatsApp trigger."
      );
      await publish(
        whatsappChannel().output({
          nodeId,
          output: { ...context, error: { message: error.message } },
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
          output: { ...context, error: { message: error.message } },
        })
      );
      throw error;
    }

    const phoneNumberRaw = data.phoneNumber?.trim();
    const toJid =
      phoneNumberRaw ?
        Handlebars.compile(phoneNumberRaw)(context)
      : (context as any).whatsappPayload?.from;
    if (!toJid) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        "WhatsApp node: Phone number is required, or use a workflow triggered by WhatsApp (reply to sender)."
      );
      await publish(
        whatsappChannel().output({
          nodeId,
          output: { ...context, error: { message: error.message } },
        })
      );
      throw error;
    }

    const message = Handlebars.compile(data.message)(context);

    const result = await step.run("send-whatsapp-message", async () => {
      const response = await sendWhatsAppMessage({
        sessionRef,
        toJid: String(toJid).trim(),
        text: message,
      });
      if (!response.success) {
        throw new NonRetriableError(response.error || "Failed to send WhatsApp message");
      }
      return {
        ...context,
        [variablesName]: {
          response: {
            success: response.success,
            messageId: response.messageId,
            toJid: String(toJid).trim(),
            message,
          },
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
