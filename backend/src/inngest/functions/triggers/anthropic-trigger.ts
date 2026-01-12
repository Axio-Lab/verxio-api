import type { NodeExecutor } from "../types";
import { anthropicChannel } from "@/inngest/channels/anthropic";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createAnthropic } from "@ai-sdk/anthropic";
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

type AnthropicTriggerData = {
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  variablesName?: string;
  credentialId?: string;
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    anthropicChannel().status({
      nodeId,
      status,
    })
  );
};

export const anthropicTriggerExecutor: NodeExecutor<AnthropicTriggerData> = async ({
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
      const error = new NonRetriableError("Anthropic node: Variable name is required");
      await publish(
        anthropicChannel().output({
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
      const error = new NonRetriableError("Anthropic node: User prompt is required");
      await publish(
        anthropicChannel().output({
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

    // Helper function to automatically stringify objects and handle array access in Handlebars expressions
    const stringifyObjects = (str: string, context: Record<string, unknown>): string => {
      // Find all Handlebars expressions that might contain objects or array access
      const handlebarsRegex = /\{\{([^}]+)\}\}/g;
      const matches: Array<{ fullMatch: string; expression: string; index: number }> = [];
      let match;

      // Collect all matches first
      while ((match = handlebarsRegex.exec(str)) !== null) {
        const expression = match[1].trim();
        // Skip if it's already using a helper (like json, stringify, get, arrayIndex, etc.)
        if (
          !expression.includes("json") &&
          !expression.includes("stringify") &&
          !expression.includes("get ") &&
          !expression.includes("arrayIndex ") &&
          !expression.includes(" ")
        ) {
          matches.push({
            fullMatch: match[0],
            expression,
            index: match.index,
          });
        }
      }

      // Process matches in reverse order to preserve indices
      let result = str;
      for (let i = matches.length - 1; i >= 0; i--) {
        const { fullMatch, expression } = matches[i];

        // Check if expression contains array access like [0] or [index]
        const arrayAccessMatch = expression.match(/^(.+)\[(\d+)\]$/);
        if (arrayAccessMatch) {
          // Convert array access to use get helper: parsedContent.result.contentPieces[0].imageDescription
          // becomes: {{get parsedContent.result.contentPieces 0 imageDescription}}
          const basePath = arrayAccessMatch[1];
          const arrayIndex = arrayAccessMatch[2];
          const remainingPath = expression.substring(arrayAccessMatch[0].length);

          // Split the remaining path by dots
          const pathParts = remainingPath.split(".").filter((p: string) => p);

          // Build get helper call
          const getHelperCall = `{{get ${basePath} ${arrayIndex}${pathParts.length > 0 ? " " + pathParts.join(" ") : ""}}}`;

          result =
            result.substring(0, matches[i].index) +
            getHelperCall +
            result.substring(matches[i].index + fullMatch.length);
          continue;
        }

        // Try to evaluate the expression and check if it's an object
        try {
          const value = expression.split(".").reduce((obj: any, key) => {
            // Handle array access in path like "result.contentPieces[0]"
            if (key.includes("[")) {
              const [arrayKey, indexStr] = key.split("[");
              const index = parseInt(indexStr.replace("]", ""), 10);
              if (!isNaN(index) && Array.isArray(obj?.[arrayKey])) {
                return obj[arrayKey][index];
              }
              return undefined;
            }
            return obj?.[key];
          }, context);

          if (
            value !== null &&
            value !== undefined &&
            typeof value === "object" &&
            !Array.isArray(value)
          ) {
            // Replace the expression with JSON.stringify version
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
      const error = new NonRetriableError("Anthropic node: Credential ID is required");
      await publish(
        anthropicChannel().output({
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
      const error = new NonRetriableError("Anthropic node: Credential not found");
      await publish(
        anthropicChannel().output({
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

    if (credential.type !== CredentialType.ANTHROPIC) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        "Anthropic node: Credential type mismatch. Expected ANTHROPIC credential."
      );
      await publish(
        anthropicChannel().output({
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

    const anthropicClient = createAnthropic({
      apiKey: credentialValue,
    });

    try {
      const { steps } = await step.ai.wrap("generate-genrate-text", generateText, {
        model: anthropicClient(data.model || "claude-3-5-sonnet-20241022"),
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
        anthropicChannel().output({
          nodeId,
          output: result,
        })
      );
      return result;
    } catch (error) {
      await publishStatus(publish, nodeId, "error");

      // Publish error output to realtime channel
      await publish(
        anthropicChannel().output({
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
        `Anthropic request failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  } catch (error) {
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
    await publish(
      anthropicChannel().output({
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
      `Anthropic request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
