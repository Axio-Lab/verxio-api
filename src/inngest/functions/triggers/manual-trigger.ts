import type { NodeExecutor } from "../types";

type ManualTriggerData = Record<string, unknown>;

export const manualTriggerExecutor: NodeExecutor<ManualTriggerData> = async (
    {
        data,
        nodeId,
        context,
        step,
    }) => {

    // Publish "loading" state for the manual trigger 
    const result = await step.run(
        "manual-trigger", async () => context
    )

    // Publish "success" state for the manual trigger

    return result;


}