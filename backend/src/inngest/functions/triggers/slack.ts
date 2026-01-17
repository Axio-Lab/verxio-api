import type { NodeExecutor } from "../types";
import { slackChannel } from "@/inngest/channels/slack";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { decode } from "html-entities";
import ky from "ky";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type SlackData = {
  variables?: string;
  webhookUrl?: string;
  message?: string;
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    slackChannel().status({
      nodeId,
      status,
    })
  );
};

export const slackExecutor: NodeExecutor<SlackData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "slack";
    if (!data.webhookUrl) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Slack node: Webhook URL is required");
      await publish(
        slackChannel().output({
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
      const error = new NonRetriableError("Slack node: Message is required");
      await publish(
        slackChannel().output({
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

    const webhookUrl = Handlebars.compile(data.webhookUrl)(context);
    const rawMessage = Handlebars.compile(data.message)(context);
    const message = decode(rawMessage);

    const result = await step.run("send-slack-message", async () => {
      await ky.post(webhookUrl, {
        json: {
          message: message,
        },
      });

      const response = {
        success: true,
        ts: Date.now().toString(),
        webhookUrl,
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
      slackChannel().output({
        nodeId,
        output: result,
      })
    );

    return result;
  } catch (error) {
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
    await publish(
      slackChannel().output({
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
      `Slack request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
