"use client";

import type { Realtime } from "@inngest/realtime";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import { useEffect, useState } from "react";
import type { NodeStatus } from "@/components/node-status-indicator";
import { authenticatedGet } from "@/lib/api-client";

interface useNodeStatusOptions {
    nodeId: string;
}

// Map Inngest status strings to NodeStatus type
const mapInngestStatusToNodeStatus = (inngestStatus: string): NodeStatus => {
    switch (inngestStatus) {
        case "loading":
            return "loading";
        case "success":
            return "success";
        case "error":
            return "error";
        default:
            return "initial";
    }
};

export function useNodeStatus({ nodeId }: useNodeStatusOptions) {
    const [status, setStatus] = useState<NodeStatus>("initial");

    // Fetch subscription token from backend
    const refreshToken = async (): Promise<Realtime.Subscribe.Token> => {
        const response = await authenticatedGet<{ success: boolean; token: Realtime.Subscribe.Token }>(
            "/workflow/subscription-token"
        );
        return response.token;
    };

    const { data } = useInngestSubscription({
        refreshToken,
        enabled: true
    });

    useEffect(() => {
        if (!data?.length) {
            return;
        }

        // Find messages for this specific node
        const nodeMessages = data.filter(
            (msg) => msg.kind === "data" &&
                msg.channel === "http-request-execution" &&
                msg.topic === "status" &&
                msg.data?.nodeId === nodeId
        );

        if (nodeMessages.length === 0) {
            return;
        }

        // Get the latest message (most recent by createdAt)
        const latestMessage = nodeMessages.sort((a, b) => {
            if (a.kind === "data" && b.kind === "data") {
                return (
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
            }
            return 0;
        })[0];

        // Update status only if we have a valid message with status
        if (latestMessage?.kind === "data" && latestMessage.data?.status) {
            const mappedStatus = mapInngestStatusToNodeStatus(latestMessage.data.status);
            setStatus(mappedStatus);
        }
    }, [data, nodeId]);

    return status;
}

