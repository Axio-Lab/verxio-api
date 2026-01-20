import type { NodeExecutor } from "../types";
import { geminiChannel } from "@/inngest/channels/gemini";
import { NonRetriableError } from "inngest";
import Handlebars from "handlebars";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { getCredential } from "@/services/credentialService";
import { CredentialType } from "@/services/credentialService";
import { basePrismaClient } from "@/lib/prisma";

const prisma = basePrismaClient as any;

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
  variables?: string; // Support both field names
  credentialId?: string; // ID of the credential to use
};

// Helper to convert node name to camelCase variable name
function toCamelCase(str: string): string {
  return str
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, "") // Remove special characters
    .split(/\s+/)
    .map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toLowerCase() + word.slice(1).toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");
}

// Helper to get variable name with priority: variablesName > variables > node.name > default
async function getVariableName(
  data: GeminiTriggerData,
  nodeId: string,
  defaultName: string,
  step: any
): Promise<string> {
  // Priority 1: Check variablesName field
  if (data.variablesName) {
    return data.variablesName;
  }

  // Priority 2: Check variables field (for compatibility with system prompt)
  if (data.variables) {
    return data.variables;
  }

  // Priority 3: Fetch node and use its name (convert to camelCase)
  try {
    const node = await step.run(`get-node-${nodeId}`, async () => {
      return await prisma.node.findUnique({
        where: { id: nodeId },
        select: { name: true },
      });
    });

    if (node?.name) {
      const camelCaseName = toCamelCase(node.name);
      if (camelCaseName) {
        return camelCaseName;
      }
    }
  } catch (error) {
    // If fetching node fails, continue to default
    console.warn(`Failed to fetch node ${nodeId} for variable name:`, error);
  }

  // Priority 4: Use default (node type)
  return defaultName;
}

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

    const variablesName = await getVariableName(data, nodeId, "gemini", step);
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
