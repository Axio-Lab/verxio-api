import type { NodeExecutor } from "../types";
import { codeBlockChannel } from "@/inngest/channels/code-block";
import { NonRetriableError } from "inngest";
import { executeCodeInSandbox } from "@/services/codeExecutionService";
import { getCredential } from "@/services/credentialService";

type CodeBlockData = {
  variables?: string;
  code?: string;
  language?: string;
  dependencies?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  credentialIds?: string[]; // Array of credential IDs to use
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    codeBlockChannel().status({
      nodeId,
      status,
    })
  );
};

export const codeBlockExecutor: NodeExecutor<CodeBlockData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const variablesName = data.variables || "result";

    if (!data.code) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError("CODE_BLOCK node: Code is required");
      await publish(
        codeBlockChannel().output({
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

    // Fetch credentials if provided
    const credentials: Record<string, string> = {};
    if (data.credentialIds && data.credentialIds.length > 0) {
      await step.run("fetch-credentials", async () => {
        for (const credentialId of data.credentialIds || []) {
          try {
            const credential = await getCredential(credentialId, userId);
            // Use credential name as key, value as the credential value
            credentials[credential.name] = credential.value;
          } catch (error) {
            console.error(`Failed to fetch credential ${credentialId}:`, error);
            // Continue with other credentials even if one fails
          }
        }
        return credentials;
      });
    }

    // Prepare inputs for CODE_BLOCK execution
    // Context contains all previous node outputs, which will be passed to Daytona sandbox
    const inputsForExecution = {
      ...context,
      credentials, // Pass credentials as part of inputs
    };

    // Log inputs structure for debugging (sanitized - no sensitive data in values)
    const sanitizedInputs = Object.keys(inputsForExecution).reduce(
      (acc, key) => {
        if (key === "credentials") {
          const creds = inputsForExecution[key] as Record<string, string> | undefined;
          acc[key] = Object.keys(creds || {}).map((credName) => `[${credName}]`);
        } else {
          const value = (inputsForExecution as Record<string, unknown>)[key];
          if (value && typeof value === "object" && "httpResponse" in value) {
            const httpValue = value as {
              httpResponse?: { data?: unknown; status?: number; statusText?: string };
            };
            acc[key] = {
              httpResponse: {
                data: Array.isArray(httpValue.httpResponse?.data)
                  ? `[Array(${httpValue.httpResponse.data.length})]`
                  : typeof httpValue.httpResponse?.data === "object"
                    ? "[Object]"
                    : httpValue.httpResponse?.data,
                status: httpValue.httpResponse?.status,
                statusText: httpValue.httpResponse?.statusText,
              },
            };
          } else {
            acc[key] =
              typeof value === "object"
                ? "[Object]"
                : typeof value === "string"
                  ? `[String(${value.length} chars)]`
                  : value;
          }
        }
        return acc;
      },
      {} as Record<string, unknown>
    );

    console.log(
      `[CODE_BLOCK] Executing code for node ${nodeId} with inputs:`,
      JSON.stringify(sanitizedInputs, null, 2)
    );
    console.log(
      `[CODE_BLOCK] Available variables: ${Object.keys(inputsForExecution)
        .filter((k) => k !== "credentials")
        .join(", ")}`
    );

    // Execute code in Daytona sandbox with credentials
    const executionResult = await step.run("execute-code", async () => {
      return await executeCodeInSandbox({
        code: data.code || "",
        inputs: inputsForExecution,
        dependencies: data.dependencies,
        timeout: 300000, // 5 minutes
      });
    });

    if (!executionResult.success) {
      await publishStatus(publish, nodeId, "error");
      const error = new NonRetriableError(
        `CODE_BLOCK execution failed: ${executionResult.error || "Unknown error"}`
      );
      await publish(
        codeBlockChannel().output({
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

    // Publish success status and output
    // The output from code execution should be merged into context
    // This ensures all properties from the code execution result are available to subsequent nodes
    const codeOutput = executionResult.output || {};

    // Merge code output into context:
    // 1. Store under the variable name for explicit access: inputs.variableName
    // 2. Also spread properties directly into context for easier templating access
    const mergedOutput = {
      ...context,
      [variablesName]: codeOutput,
      // Spread code output properties directly into context (if it's an object)
      // This allows nodes to access properties directly: inputs.propertyName
      // instead of having to do: inputs.variableName.propertyName
      ...(typeof codeOutput === "object" &&
      codeOutput !== null &&
      !Array.isArray(codeOutput) &&
      !codeOutput.hasOwnProperty("error") // Don't spread error objects
        ? codeOutput
        : {}),
    };

    await publishStatus(publish, nodeId, "success");

    // Publish output to channel so it's available for subsequent nodes
    await publish(
      codeBlockChannel().output({
        nodeId,
        output: mergedOutput,
      })
    );

    // Return merged output to be passed to next node in execution chain
    return mergedOutput;
  } catch (error) {
    await publishStatus(publish, nodeId, "error");
    const errorMessage = error instanceof Error ? error.message : String(error);
    await publish(
      codeBlockChannel().output({
        nodeId,
        output: {
          ...context,
          error: {
            message: errorMessage,
          },
        },
      })
    );
    throw error;
  }
};
