import type { NodeExecutor } from "../types";
import { stripeTriggerChannel } from "@/inngest/channels/stripe-trigger";

type StripeTriggerData = Record<string, unknown>;

// Helper to publish status updates
const publishStatus = async (
    publish: any,
    nodeId: string,
    status: "loading" | "error" | "success"
) => {
    await publish(
        stripeTriggerChannel().status({
            nodeId,
            status,
        })
    );
};

export const stripeTriggerExecutor: NodeExecutor<StripeTriggerData> = async (
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

        // Stripe trigger receives data from Stripe webhook
        // The context should contain stripePayload from the webhook/route
        // Extract webhook data and make it available to subsequent nodes
        const result = await step.run(
            "stripe-trigger", 
            async () => {
                // Extract Stripe payload from context (set by webhook/route)
                const stripePayload = (context as any).stripePayload || {};
                
                // Make webhook data available in context for subsequent nodes
                const variableName = "stripe";
                
                return {
                    ...context,
                    [variableName]: {
                        payload: stripePayload,
                        event: stripePayload.type || stripePayload.event?.type,
                        data: stripePayload.data || stripePayload.event?.data,
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

