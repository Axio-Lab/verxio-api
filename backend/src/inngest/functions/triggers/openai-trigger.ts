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

// Helper to access array elements: {{arrayIndex array 0}}
Handlebars.registerHelper("arrayIndex", (array: any, index: number | string) => {
  if (!Array.isArray(array)) {
    return "";
  }
  const idx = typeof index === "string" ? parseInt(index, 10) : index;
  if (isNaN(idx) || idx < 0 || idx >= array.length) {
    return "";
  }
  const value = array[idx];
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return new Handlebars.SafeString(JSON.stringify(value, null, 2));
  }
  return String(value);
});

// Helper to safely access nested properties: {{get parsedContent result contentPieces 0 imageDescription}}
Handlebars.registerHelper("get", (obj: any, ...args: any[]) => {
  if (!obj || typeof obj !== "object") {
    return "";
  }
  try {
    let value = obj;
    for (let i = 0; i < args.length - 1; i++) {
      const key = args[i];
      if (Array.isArray(value) && typeof key === "number") {
        value = value[key];
      } else if (Array.isArray(value) && typeof key === "string") {
        const idx = parseInt(key, 10);
        if (!isNaN(idx)) {
          value = value[idx];
        } else {
          return "";
        }
      } else if (value && typeof value === "object") {
        value = value[key];
      } else {
        return "";
      }
      if (value === null || value === undefined) {
        return "";
      }
    }
    const finalKey = args[args.length - 1];
    if (Array.isArray(value) && typeof finalKey === "number") {
      value = value[finalKey];
    } else if (value && typeof value === "object") {
      value = value[finalKey];
    } else {
      return "";
    }
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "object") {
      return new Handlebars.SafeString(JSON.stringify(value, null, 2));
    }
    return String(value);
  } catch (e) {
    return "";
  }
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
