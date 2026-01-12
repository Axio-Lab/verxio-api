import type { NodeExecutor } from "../types";
import { manualInputChannel } from "@/inngest/channels/manual-input";

type ManualInputData = {
  variables?: string;
  label?: string;
  prompt?: string; // User instruction/prompt text
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    manualInputChannel().status({
      nodeId,
      status,
    })
  );
};

export const manualInputExecutor: NodeExecutor<ManualInputData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  try {
    // Publish loading status
    await publishStatus(publish, nodeId, "loading");

    // Manual input node collects user instruction/prompt
    // The prompt is stored in data.prompt and will be shown to users
    // The user's response will be stored in the variable name specified
    const variablesName = data.variables || "input";
    const userPrompt = data.prompt || "";

    // Get user input from context (set when user provides input during execution)
    // For now, we pass through the prompt and any user-provided value
    const userInput = context[variablesName] || userPrompt;

    const result = await step.run("manual-input", async () => ({
      ...context,
      [variablesName]: userInput,
      prompt: userPrompt, // Also include the prompt for reference
    }));

    // Publish success status before returning
    await publishStatus(publish, nodeId, "success");

    // Publish node output to realtime channel
    await publish(
      manualInputChannel().output({
        nodeId,
        output: result,
      })
    );

    return result;
  } catch (error) {
    // Publish error status if something goes wrong
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
    await publish(
      manualInputChannel().output({
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

    throw error;
  }
};
