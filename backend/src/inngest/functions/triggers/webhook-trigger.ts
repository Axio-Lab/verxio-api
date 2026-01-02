import type { NodeExecutor } from "../types";
import { webhookChannel } from "@/inngest/channels/webhook";

type WebhookTriggerData = {
    variables?: string;
    secret?: string;
};

// Helper to publish status updates
const publishStatus = async (
    publish: any,
    nodeId: string,
    status: "loading" | "error" | "success"
) => {
    await publish(
        webhookChannel().status({
            nodeId,
            status,
        })
    );
};

export const webhookTriggerExecutor: NodeExecutor<WebhookTriggerData> = async (
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

        // Webhook trigger receives data from external HTTP request
        // The context should contain webhookPayload from the webhook route
        // Extract webhook data and make it available to subsequent nodes
        const result = await step.run(
            "webhook-trigger", 
            async () => {
                // Extract webhook payload from context (set by webhook route)
                const webhookPayload = (context as any).webhookPayload || {};
                const webhookHeaders = (context as any).webhookHeaders || {};
                
                // Make webhook data available in context for subsequent nodes
                // Use the variable name from node data, default to "webhook"
                const variableName = data.variables || "webhook";
                
                return {
                    ...context,
                    [variableName]: {
                        payload: webhookPayload,
                        headers: webhookHeaders,
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

