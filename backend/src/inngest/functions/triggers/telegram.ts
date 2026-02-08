import type { NodeExecutor } from "../types";
import { telegramChannel } from "@/inngest/channels/telegram";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { getCredential } from "@/services/credentialService";
import { CredentialType } from "@/services/credentialService";
import { formatTelegramMessage } from "@/services/chatIntegrationService";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type TelegramData = {
  variables?: string;
  credentialId?: string;
  chatId?: string;
  message?: string;
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    telegramChannel().status({
      nodeId,
      status,
    })
  );
};

export const telegramExecutor: NodeExecutor<TelegramData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "telegram";

    if (!data.credentialId) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Telegram node: Bot token credential is required");
      await publish(
        telegramChannel().output({
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

    if (!data.chatId) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Telegram node: Chat ID is required");
      await publish(
        telegramChannel().output({
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
      const error = new NonRetriableError("Telegram node: Message is required");
      await publish(
        telegramChannel().output({
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

    // Get bot token from credential
    const credential = await step.run("get-telegram-credential", async () => {
      return await getCredential(data.credentialId!, userId!);
    });

    if (!credential) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Telegram node: Credential not found");
      await publish(
        telegramChannel().output({
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

    if (credential.type !== CredentialType.TELEGRAM) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        "Telegram node: Credential type mismatch. Expected TELEGRAM credential."
      );
      await publish(
        telegramChannel().output({
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

    const botToken = credential.value;

    // Compile Handlebars templates with workflow context
    const chatId = Handlebars.compile(data.chatId)(context);
    const messageRaw = Handlebars.compile(data.message)(context);
    const message = formatTelegramMessage(messageRaw);

    // Send message via Telegram Bot API (HTML formatting, same as agent replies)
    const result = await step.run("send-telegram-message", async () => {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new NonRetriableError(
          `Telegram API error: ${errorData.description || response.statusText} (${response.status})`
        );
      }

      const responseData = await response.json();

      if (!responseData.ok) {
        throw new NonRetriableError(
          `Telegram API error: ${responseData.description || "Unknown error"}`
        );
      }

      return {
        ...context,
        [variablesName]: {
          response: {
            messageId: responseData.result?.message_id,
            chatId: responseData.result?.chat?.id,
            text: responseData.result?.text,
            date: responseData.result?.date,
            from: responseData.result?.from,
          },
        },
      };
    });

    await publishStatus(publish, nodeId, "success");

    // Publish node output to realtime channel
    await publish(
      telegramChannel().output({
        nodeId,
        output: result,
      })
    );

    return result;
  } catch (error) {
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
    await publish(
      telegramChannel().output({
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
      `Telegram request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
