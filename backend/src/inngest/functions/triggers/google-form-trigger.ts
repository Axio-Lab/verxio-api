import type { NodeExecutor } from "../types";
import { googleFormTriggerChannel } from "@/inngest/channels/google-form-trigger";

type GoogleFormTriggerData = Record<string, unknown>;

// Helper to publish status updates
const publishStatus = async (
    publish: any,
    nodeId: string,
    status: "loading" | "error" | "success"
) => {
    await publish(
        googleFormTriggerChannel().status({
            nodeId,
            status,
        })
    );
};

export const googleFormTriggerExecutor: NodeExecutor<GoogleFormTriggerData> = async (
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

        // Google Form trigger receives data from Google Form submission
        // The context should contain googleFormPayload from the webhook/route
        // Extract form data and make it available to subsequent nodes
        const result = await step.run(
            "google-form-trigger", 
            async () => {
                // Extract Google Form payload from context (set by webhook/route)
                const googleFormPayload = (context as any).googleFormPayload || {};
                
                // Make form data available in context for subsequent nodes
                // Use the variable name from node data, default to "googleForm"
                const variableName = (data as any)?.variables || "googleForm";
                
                return {
                    ...context,
                    [variableName]: {
                        payload: googleFormPayload,
                    }
                };
            }
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

