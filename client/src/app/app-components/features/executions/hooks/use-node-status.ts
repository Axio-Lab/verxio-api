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
    const [tokensCache, setTokensCache] = useState<{
        httpRequest: Realtime.Subscribe.Token | null;
        manualTrigger: Realtime.Subscribe.Token | null;
    }>({ httpRequest: null, manualTrigger: null });

    // Fetch subscription tokens from backend (both HTTP request and manual trigger)
    // Cache them to avoid multiple API calls
    const fetchTokens = async () => {
        if (tokensCache.httpRequest && tokensCache.manualTrigger) {
            return tokensCache;
        }
        const response = await authenticatedGet<{ 
            success: boolean; 
            tokens: {
                httpRequest: Realtime.Subscribe.Token;
                manualTrigger: Realtime.Subscribe.Token;
            }
        }>(
            "/workflow/subscription-token"
        );
        setTokensCache(response.tokens);
        return response.tokens;
    };

    const refreshHttpRequestToken = async (): Promise<Realtime.Subscribe.Token> => {
        const tokens = await fetchTokens();
        if (!tokens.httpRequest) {
            throw new Error("Failed to fetch HTTP request subscription token");
        }
        return tokens.httpRequest;
    };

    const refreshManualTriggerToken = async (): Promise<Realtime.Subscribe.Token> => {
        const tokens = await fetchTokens();
        if (!tokens.manualTrigger) {
            throw new Error("Failed to fetch manual trigger subscription token");
        }
        return tokens.manualTrigger;
    };

    // Subscribe to both channels
    const { data: httpRequestData } = useInngestSubscription({
        refreshToken: refreshHttpRequestToken,
        enabled: true
    });

    const { data: manualTriggerData } = useInngestSubscription({
        refreshToken: refreshManualTriggerToken,
        enabled: true
    });

    // Merge data from both subscriptions
    const data = [
        ...(httpRequestData || []),
        ...(manualTriggerData || [])
    ];

    useEffect(() => {
        if (!data?.length) {
            return;
        }

        // Find messages for this specific node from both HTTP request and manual trigger channels
        const nodeMessages = data.filter(
            (msg) => msg.kind === "data" &&
                (msg.channel === "http-request-execution" || msg.channel === "manual-trigger-execution") &&
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

