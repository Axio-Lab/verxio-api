import type { NodeExecutor } from "../types";
import { decode } from "html-entities";
import { discordChannel } from "@/inngest/channels/discord";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import ky from "ky";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type DiscordData = {
  variables?: string;
  webhookUrl?: string;
  username?: string;
  message?: string;
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    discordChannel().status({
      nodeId,
      status,
    })
  );
};

export const discordExecutor: NodeExecutor<DiscordData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    if (!data.variables) {
      await publishStatus(publish, nodeId, "error");
      throw new NonRetriableError("Discord node: Variable name is required");
    }
    if (!data.webhookUrl) {
      await publishStatus(publish, nodeId, "error");
      throw new NonRetriableError("Discord node: Webhook URL is required");
    }
    if (!data.message) {
      await publishStatus(publish, nodeId, "error");
      throw new NonRetriableError("Discord node: Message is required");
    }

    const webhookUrl = Handlebars.compile(data.webhookUrl)(context);
    const rawMessage = Handlebars.compile(data.message)(context);
    const message = decode(rawMessage);
    const username = data.username ? Handlebars.compile(data.username)(context) : undefined;
    const variablesName = data.variables;

    try {
      const result = await step.run("send-discord-message", async () => {
        await ky.post(webhookUrl, {
          json: {
            content: message.slice(0, 2000),
            username,
          },
        });
        return {
          ...context,
          [variablesName]: {
            response: {
              message: message.slice(0, 2000),
            },
          },
        };
      });
      await publishStatus(publish, nodeId, "success");
      return result;
    } catch (error) {
      await publishStatus(publish, nodeId, "error");
      throw new NonRetriableError("Discord node: Failed to send message");
    }
  } catch (error) {
    await publishStatus(publish, nodeId, "error");
    if (error instanceof NonRetriableError) {
      throw error;
    }
    throw new NonRetriableError(
      `Discord request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
