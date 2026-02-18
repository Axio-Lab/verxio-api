import type { NodeExecutor } from "../types";
import { composioTriggerChannel } from "@/inngest/channels/composio-trigger";

type ComposioTriggerData = {
  variables?: string;
};

const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    composioTriggerChannel().status({
      nodeId,
      status,
    })
  );
};

export const composioTriggerExecutor: NodeExecutor<ComposioTriggerData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  try {
    await publishStatus(publish, nodeId, "loading");

    const result = await step.run("composio-trigger", async () => {
      const variableName = data.variables || "composioTrigger";
      const composioEvent = (context as any).composioEvent || {};
      const composioMetadata = (context as any).composioMetadata || {};
      const composioType = (context as any).composioType || "composio.trigger.message";

      return {
        ...context,
        [variableName]: {
          event: composioEvent,
          metadata: composioMetadata,
          type: composioType,
        },
      };
    });

    await publishStatus(publish, nodeId, "success");
    await publish(
      composioTriggerChannel().output({
        nodeId,
        output: result,
      })
    );

    return result;
  } catch (error) {
    await publishStatus(publish, nodeId, "error");
    await publish(
      composioTriggerChannel().output({
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
