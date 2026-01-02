"use client";

import type { Realtime } from "@inngest/realtime";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import { useEffect, useState, useMemo } from "react";
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
    const [tokens, setTokens] = useState<Record<string, Realtime.Subscribe.Token>>({});
    const [channelNames, setChannelNames] = useState<string[]>([]);

    // Fetch all subscription tokens from backend
    const fetchTokens = async () => {
        const response = await authenticatedGet<{ 
            success: boolean; 
            tokens: Record<string, Realtime.Subscribe.Token>;
            channelNames: Record<string, string>;
        }>("/workflow/subscription-token");
        
        setTokens(response.tokens);
        setChannelNames(Object.values(response.channelNames));
        
        return response.tokens;
    };

    // Create refresh token function for a specific channel
    const createRefreshToken = (channelKey: string) => async (): Promise<Realtime.Subscribe.Token> => {
        const response = await authenticatedGet<{ 
            success: boolean; 
            tokens: Record<string, Realtime.Subscribe.Token>;
            channelNames: Record<string, string>;
        }>("/workflow/subscription-token");
        
        const token = response.tokens[channelKey];
        if (!token) {
            throw new Error(`Token not found for channel: ${channelKey}`);
        }
        return token;
    };

    // Initialize tokens on mount
    useEffect(() => {
        fetchTokens();
    }, []);

    // Subscribe to all 4 known channels
    // Enable immediately - refreshToken will fetch tokens when needed
    const httpRequestSub = useInngestSubscription({
        refreshToken: createRefreshToken("httpRequest"),
        enabled: true
    });

    const manualTriggerSub = useInngestSubscription({
        refreshToken: createRefreshToken("manualTrigger"),
        enabled: true
    });

    const webhookSub = useInngestSubscription({
        refreshToken: createRefreshToken("webhook"),
        enabled: true
    });

    const googleFormSub = useInngestSubscription({
        refreshToken: createRefreshToken("googleFormTrigger"),
        enabled: true
    });

    // Merge all messages from all subscriptions
    const allMessages = useMemo(() => {
        return [
            ...(httpRequestSub.data || []),
            ...(manualTriggerSub.data || []),
            ...(webhookSub.data || []),
            ...(googleFormSub.data || [])
        ];
    }, [httpRequestSub.data, manualTriggerSub.data, webhookSub.data, googleFormSub.data]);

    // Filter and update status for this specific node
    useEffect(() => {
        if (!allMessages.length || !channelNames.length) {
            return;
        }

        // Filter messages for this node
        const nodeMessages = allMessages.filter((msg): msg is Extract<typeof msg, { kind: "data" }> => {
            if (msg.kind !== "data") return false;
            if (msg.topic !== "status") return false;
            if (!channelNames.includes(msg.channel)) return false;
            if (msg.data?.nodeId !== nodeId) return false;
            return true;
        });

        if (nodeMessages.length === 0) {
            return;
        }

        // Get latest message
        const latest = nodeMessages.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        if (latest?.data?.status) {
            const newStatus = mapInngestStatusToNodeStatus(latest.data.status);
            if (newStatus !== status) {
                setStatus(newStatus);
            }
        }
    }, [allMessages, nodeId, channelNames, status]);

    return status;
}
