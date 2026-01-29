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
 */
export const outputExecutor: NodeExecutor<OutputData> = async ({
  data,
  nodeId,
  context,
  publish,
}) => {
  // Publish loading status
  await publish(
    outputChannel().status({
      nodeId,
      status: "loading",
    })
  );

  // Immediately publish success - no processing needed
  await publish(
    outputChannel().status({
      nodeId,
      status: "success",
    })
  );

  // Publish output (just pass through the context)
  await publish(
    outputChannel().output({
      nodeId,
      output: context,
    })
  );

  // Return context unchanged - the frontend handles display
  return context;
};
