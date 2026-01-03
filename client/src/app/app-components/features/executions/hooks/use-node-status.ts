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

// Shared token cache to avoid redundant requests
let tokenCache: {
    tokens: Record<string, Realtime.Subscribe.Token> | null;
    timestamp: number;
} = {
    tokens: null,
    timestamp: 0,
};

const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fetch all subscription tokens from backend (with caching)
const fetchTokens = async (): Promise<Record<string, Realtime.Subscribe.Token>> => {
    const now = Date.now();
    
    // Return cached tokens if still valid
    if (tokenCache.tokens && (now - tokenCache.timestamp) < TOKEN_CACHE_TTL) {
        return tokenCache.tokens;
    }
    
    const response = await authenticatedGet<{ 
        success: boolean; 
        tokens: Record<string, Realtime.Subscribe.Token>;
        channelNames: Record<string, string>;
    }>("/workflow/subscription-token");
    
    // Update cache
    tokenCache = {
        tokens: response.tokens,
        timestamp: now,
    };
    
    return response.tokens;
};

export function useNodeStatus({ nodeId }: useNodeStatusOptions) {
    const [status, setStatus] = useState<NodeStatus>("initial");

    // Create refresh token function for a specific channel (uses shared cache)
    const createRefreshToken = (channelKey: string) => async (): Promise<Realtime.Subscribe.Token> => {
        const tokens = await fetchTokens();
        const token = tokens[channelKey];
        if (!token) {
            throw new Error(`Token not found for channel: ${channelKey}`);
        }
        return token;
    };

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

    const stripeTriggerSub = useInngestSubscription({
        refreshToken: createRefreshToken("stripeTrigger"),
        enabled: true
    });

    const openaiSub = useInngestSubscription({
        refreshToken: createRefreshToken("openai"),
        enabled: true
    });

    const anthropicSub = useInngestSubscription({
        refreshToken: createRefreshToken("anthropic"),
        enabled: true
    });

    const geminiSub = useInngestSubscription({
        refreshToken: createRefreshToken("gemini"),
        enabled: true
    });

    // Merge all messages from all subscriptions
    const allMessages = useMemo(() => {
        return [
            ...(httpRequestSub.data || []),
            ...(manualTriggerSub.data || []),
            ...(webhookSub.data || []),
            ...(googleFormSub.data || []),
            ...(stripeTriggerSub.data || []),
            ...(openaiSub.data || []),
            ...(anthropicSub.data || []),
            ...(geminiSub.data || [])
        ];
    }, [httpRequestSub.data, manualTriggerSub.data, webhookSub.data, googleFormSub.data, stripeTriggerSub.data, openaiSub.data, anthropicSub.data, geminiSub.data]);

    // Filter and update status for this specific node
    useEffect(() => {
        if (!allMessages.length) {
            return;
        }

        // Filter messages for this node
        // We check nodeId first, then verify it's a status message
        // This ensures we catch all messages for this node regardless of channel
        const nodeMessages = allMessages.filter((msg): msg is Extract<typeof msg, { kind: "data" }> => {
            if (msg.kind !== "data") return false;
            if (msg.topic !== "status") return false;
            // Check if this message is for our node
            if (msg.data?.nodeId !== nodeId) return false;
            return true;
        });

        if (nodeMessages.length === 0) {
            return;
        }

        // Get latest message (most recent first)
        const latest = nodeMessages.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        if (latest?.data?.status) {
            const newStatus = mapInngestStatusToNodeStatus(latest.data.status);
            // Always update status, even if it's the same (to handle rapid updates)
            setStatus(newStatus);
        }
    }, [allMessages, nodeId]);

    return status;
}
