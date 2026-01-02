import type { NodeExecutor } from "../types";
import { manualTriggerChannel } from "@/inngest/channels/manual-trigger";

type ManualTriggerData = Record<string, unknown>;

// Helper to publish status updates
const publishStatus = async (
    publish: any,
    nodeId: string,
    status: "loading" | "error" | "success"
) => {
    await publish(
        manualTriggerChannel().status({
            nodeId,
            status,
        })
    );
};

export const manualTriggerExecutor: NodeExecutor<ManualTriggerData> = async (
    {
        data,
        nodeId,
        context,
        step,
        publish,
    }) => {
    try {
        // Publish loading status
        await publishStatus(publish, nodeId, "loading");

        // Manual trigger just passes through the context
        // It's the entry point of the workflow, so it doesn't do any processing
        const result = await step.run(
            "manual-trigger", 
            async () => context
        );

        // Publish success status before returning
        await publishStatus(publish, nodeId, "success");

        return result;
    } catch (error) {
        // Publish error status if something goes wrong
        await publishStatus(publish, nodeId, "error");
        throw error;
    }
}