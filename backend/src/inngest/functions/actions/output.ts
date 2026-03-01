import type { NodeExecutor } from "../types";
import { outputChannel } from "@/inngest/channels/output";

type OutputData = {
  variables?: string;
  contentType?: "image" | "video" | "audio";
  imageSource?: string;
  videoSource?: string;
  audioSource?: string;
  outputFilename?: string;
};

/**
 * OUTPUT node executor - a minimal pass-through node
 *
 * The OUTPUT node is a display-only node that shows content from previous nodes.
 * It doesn't perform any processing - it just:
 * 1. Publishes "loading" status immediately
 * 2. Publishes "success" status immediately
 * 3. Passes through the context unchanged
 *
 * The actual content resolution and display happens on the frontend,
 * which parses the source template (e.g., {{designPro.imageUrl}}) and
 * directly accesses the previous node's output from the execution store.
 *
 * Each publish is wrapped in step.run() with a unique ID per nodeId to avoid
 * Inngest duplicate step ID warnings when multiple OUTPUT nodes run (e.g. in
 * parallel branches or in workflows with several output nodes).
 */
export const outputExecutor: NodeExecutor<OutputData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  // Publish loading status (unique step ID per node to avoid AUTOMATIC_PARALLEL_INDEXING)
  await step.run(`publish-output-status-loading-${nodeId}`, async () => {
    await publish(
      outputChannel().status({
        nodeId,
        status: "loading",
      })
    );
  });

  // Immediately publish success - no processing needed
  await step.run(`publish-output-status-success-${nodeId}`, async () => {
    await publish(
      outputChannel().status({
        nodeId,
        status: "success",
      })
    );
  });

  // Publish output (just pass through the context)
  await step.run(`publish-output-data-${nodeId}`, async () => {
    await publish(
      outputChannel().output({
        nodeId,
        output: context,
      })
    );
  });

  // Return context unchanged - the frontend handles display
  return context;
};
