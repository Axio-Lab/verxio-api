import type { NodeExecutor } from "../types";
import { geminiChannel } from "@/inngest/channels/gemini";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
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

// Helper to automatically stringify objects when used directly
Handlebars.registerHelper("stringify", (context) => {
  if (context === null || context === undefined) {
    return "";
  }
  if (typeof context === "string") {
    return context;
  }
  if (typeof context === "object") {
    return JSON.stringify(context, null, 2);
  }
  return String(context);
});

type GeminiTriggerData = {
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
    geminiChannel().status({
      nodeId,
      status,
    })
  );
};

export const geminiTriggerExecutor: NodeExecutor<GeminiTriggerData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variablesName || "gemini";
    if (!data.userPrompt) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("Gemini node: User prompt is required");
      await publish(
        geminiChannel().output({
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
      // Find all Handlebars expressions that might contain objects
      const handlebarsRegex = /\{\{([^}]+)\}\}/g;
      const matches: Array<{ fullMatch: string; expression: string; index: number }> = [];
      let match;

      // Collect all matches first
      while ((match = handlebarsRegex.exec(str)) !== null) {
        const expression = match[1].trim();
        // Skip if it's already using a helper (like json, stringify, etc.)
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

      // Process matches in reverse order to preserve indices
      let result = str;
      for (let i = matches.length - 1; i >= 0; i--) {
        const { fullMatch, expression } = matches[i];
        // Try to evaluate the expression and check if it's an object or array
        try {
          const value = expression.split(".").reduce((obj: any, key) => obj?.[key], context);
          if (value !== null && value !== undefined && typeof value === "object") {
            // Replace the expression with JSON.stringify version (handles both objects and arrays)
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

    // Pre-process prompts to automatically stringify objects
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
      const error = new NonRetriableError("Gemini node: Credential ID is required");
      await publish(
        geminiChannel().output({
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
      const error = new NonRetriableError("Gemini node: Credential not found");
      await publish(
        geminiChannel().output({
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

    if (credential.type !== CredentialType.GEMINI) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        "Gemini node: Credential type mismatch. Expected GEMINI credential."
      );
      await publish(
        geminiChannel().output({
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

    const google = createGoogleGenerativeAI({
      apiKey: credentialValue,
    });

    try {
      const { steps } = await step.ai.wrap("generate-genrate-text", generateText, {
        model: google(data.model || "gemini-pro-latest"),
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
        [variablesName]: {
          text,
        },
      };

      // Publish node output to realtime channel
      await publish(
        geminiChannel().output({
          nodeId,
          output: result,
        })
      );

      return result;
    } catch (error) {
      await publishStatus(publish, nodeId, "error");

      // Publish error output to realtime channel
      await publish(
        geminiChannel().output({
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
        `Gemini request failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  } catch (error) {
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
    await publish(
      geminiChannel().output({
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
      `Gemini request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
