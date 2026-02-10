import type { NodeExecutor } from "../types";
import { markdownChannel } from "@/inngest/channels/markdown";

type MarkdownData = {
  variables?: string;
  textSource?: string;
  outputFilename?: string;
};

/**
 * MARKDOWN node executor - display-only pass-through (like OUTPUT).
 *
 * Displays text/markdown from a previous node (e.g. {{gemini.text}}).
 * Resolution and rendering happen on the frontend; this executor just
 * publishes status and passes context so the Markdown node can show
 * and offer download of the resolved content.
 */
export const markdownExecutor: NodeExecutor<MarkdownData> = async ({
  data,
  nodeId,
  context,
  publish,
}) => {
  await publish(
    markdownChannel().status({
      nodeId,
      status: "loading",
    })
  );

  await publish(
    markdownChannel().status({
      nodeId,
      status: "success",
    })
  );

  await publish(
    markdownChannel().output({
      nodeId,
      output: context,
    })
  );

  return context;
};
