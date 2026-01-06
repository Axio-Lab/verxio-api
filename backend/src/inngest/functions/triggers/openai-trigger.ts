import type { NodeExecutor } from "../types";
import { openaiChannel } from "@/inngest/channels/openai";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getCredential } from "@/services/credentialService";
import { CredentialType } from "@/services/credentialService";

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  if (context === null || context === undefined) {
    return "";
  }
  // If it's already a string, return as-is
  if (typeof context === "string") {
    return new Handlebars.SafeString(context);
  }
  // Otherwise, stringify the object
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

type OpenAITriggerData = {
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  variablesName?: string;
  credentialId?: string; // ID of the credential to use
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    openaiChannel().status({
      nodeId,
      status,
    })
  );
};

export const openaiTriggerExecutor: NodeExecutor<OpenAITriggerData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    if (!data.variablesName) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("OpenAI node: Variable name is required");
      await publish(
        openaiChannel().output({
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
    if (!data.userPrompt) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("OpenAI node: User prompt is required");
      await publish(
        openaiChannel().output({
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

    // Helper function to automatically stringify objects in Handlebars expressions
    const stringifyObjects = (str: string, context: Record<string, unknown>): string => {
      const handlebarsRegex = /\{\{([^}]+)\}\}/g;
      const matches: Array<{ fullMatch: string; expression: string; index: number }> = [];
      let match;

      while ((match = handlebarsRegex.exec(str)) !== null) {
        const expression = match[1].trim();
        if (
          !expression.includes("json") &&
          !expression.includes("stringify") &&
          !expression.includes(" ")
        ) {
          matches.push({
            fullMatch: match[0],
            expression,
            index: match.index,
          });
        }
      }

      let result = str;
      for (let i = matches.length - 1; i >= 0; i--) {
        const { fullMatch, expression } = matches[i];
        try {
          const value = expression.split(".").reduce((obj: any, key) => obj?.[key], context);
          if (
            value !== null &&
            value !== undefined &&
            typeof value === "object" &&
            !Array.isArray(value)
          ) {
            result =
              result.substring(0, matches[i].index) +
              `{{json ${expression}}}` +
              result.substring(matches[i].index + fullMatch.length);
          }
        } catch (e) {
          // If evaluation fails, leave as-is
        }
      }

      return result;
    };

    const processedSystemPrompt = data.systemPrompt
      ? stringifyObjects(data.systemPrompt, context)
      : "You are a helpful assistant.";

    const processedUserPrompt = stringifyObjects(data.userPrompt, context);

    const systemPrompt = data.systemPrompt
      ? Handlebars.compile(processedSystemPrompt)(context)
      : "You are a helpful assistant.";

    const userPrompt = Handlebars.compile(processedUserPrompt)(context);

    if (!data.credentialId) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("OpenAI node: Credential ID is required");
      await publish(
        openaiChannel().output({
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

    const credential = await step.run("get-credential", async () => {
      return await getCredential(data.credentialId!, userId);
    });

    if (!credential) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("OpenAI node: Credential not found");
      await publish(
        openaiChannel().output({
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

    if (credential.type !== CredentialType.OPENAI) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        "OpenAI node: Credential type mismatch. Expected OPENAI credential."
      );
      await publish(
        openaiChannel().output({
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

    const credentialValue = credential.value;

    const openai = createOpenAI({
      apiKey: credentialValue,
    });

    try {
      const { steps } = await step.ai.wrap("generate-genrate-text", generateText, {
        model: openai(data.model || "gpt-3.5-turbo"),
        prompt: userPrompt,
        system: systemPrompt,
        experimental_telemetry: {
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true,
        },
      });
      const text = steps[0].content[0].type === "text" ? steps[0].content[0].text : "";

      await publishStatus(publish, nodeId, "success");
      const result = {
        ...context,
        [data.variablesName]: {
          text,
        },
      };

      // Publish node output to realtime channel
      await publish(
        openaiChannel().output({
          nodeId,
          output: result,
        })
      );

      return result;
    } catch (error) {
      await publishStatus(publish, nodeId, "error");

      // Publish error output to realtime channel
      await publish(
        openaiChannel().output({
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

      throw new NonRetriableError(
        `OpenAI request failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  } catch (error) {
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
    await publish(
      openaiChannel().output({
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
      `OpenAI request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
