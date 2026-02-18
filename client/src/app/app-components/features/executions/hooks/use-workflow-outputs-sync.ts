"use client";

import type { Realtime } from "@inngest/realtime";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import { useEffect, useMemo } from "react";
import { authenticatedGet } from "@/lib/api-client";
import { useSetWorkflowOutputs } from "@/app/app-components/features/editor/workflow-outputs-store";

// Shared token cache (reuse from use-node-status)
let tokenCache: {
  tokens: Record<string, Realtime.Subscribe.Token> | null;
  timestamp: number;
} = {
  tokens: null,
  timestamp: 0,
};

let inFlightRequest: Promise<Record<string, Realtime.Subscribe.Token>> | null = null;

const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const fetchTokens = async (): Promise<Record<string, Realtime.Subscribe.Token>> => {
  const now = Date.now();

  if (tokenCache.tokens && now - tokenCache.timestamp < TOKEN_CACHE_TTL) {
    return tokenCache.tokens;
  }

  if (inFlightRequest) {
    return inFlightRequest;
  }

  inFlightRequest = (async () => {
    try {
      const response = await authenticatedGet<{
        success: boolean;
        tokens: Record<string, Realtime.Subscribe.Token>;
        channelNames: Record<string, string>;
      }>("/workflow/subscription-token");

      tokenCache = {
        tokens: response.tokens,
        timestamp: Date.now(),
      };

      return response.tokens;
    } finally {
      inFlightRequest = null;
    }
  })();

  return inFlightRequest;
};

const createRefreshToken = (channelKey: string) => async () => {
  const tokens = await fetchTokens();
  return tokens[channelKey] || null;
};

/**
 * Hook that subscribes to ALL node output messages and populates the global workflow outputs store.
 * This should be used once at the workflow execution level to aggregate all outputs.
 */
export function useWorkflowOutputsSync() {
  const setWorkflowOutputs = useSetWorkflowOutputs();

  // Subscribe to all channels that can publish outputs
  const designProSub = useInngestSubscription({
    refreshToken: createRefreshToken("designPro"),
    enabled: true,
  });

  const designSub = useInngestSubscription({
    refreshToken: createRefreshToken("design"),
    enabled: true,
  });

  const anthropicSub = useInngestSubscription({
    refreshToken: createRefreshToken("anthropic"),
    enabled: true,
  });

  const openaiSub = useInngestSubscription({
    refreshToken: createRefreshToken("openai"),
    enabled: true,
  });

  const geminiSub = useInngestSubscription({
    refreshToken: createRefreshToken("gemini"),
    enabled: true,
  });

  const veoSub = useInngestSubscription({
    refreshToken: createRefreshToken("veo"),
    enabled: true,
  });

  const remotionSub = useInngestSubscription({
    refreshToken: createRefreshToken("remotion"),
    enabled: true,
  });

  const httpRequestSub = useInngestSubscription({
    refreshToken: createRefreshToken("httpRequest"),
    enabled: true,
  });

  const codeBlockSub = useInngestSubscription({
    refreshToken: createRefreshToken("codeBlock"),
    enabled: true,
  });

  const outputSub = useInngestSubscription({
    refreshToken: createRefreshToken("output"),
    enabled: true,
  });
  const markdownSub = useInngestSubscription({
    refreshToken: createRefreshToken("markdown"),
    enabled: true,
  });
  const seedanceSub = useInngestSubscription({
    refreshToken: createRefreshToken("seedance"),
    enabled: true,
  });
  const seedreamSub = useInngestSubscription({
    refreshToken: createRefreshToken("seedream"),
    enabled: true,
  });
  const composioActionSub = useInngestSubscription({
    refreshToken: createRefreshToken("composioAction"),
    enabled: true,
  });
  const composioTriggerSub = useInngestSubscription({
    refreshToken: createRefreshToken("composioTrigger"),
    enabled: true,
  });

  // Merge all output messages
  const allMessages = useMemo(() => {
    return [
      ...(designProSub.data || []),
      ...(designSub.data || []),
      ...(anthropicSub.data || []),
      ...(openaiSub.data || []),
      ...(geminiSub.data || []),
      ...(veoSub.data || []),
      ...(remotionSub.data || []),
      ...(httpRequestSub.data || []),
      ...(codeBlockSub.data || []),
      ...(outputSub.data || []),
      ...(markdownSub.data || []),
      ...(seedanceSub.data || []),
      ...(seedreamSub.data || []),
      ...(composioActionSub.data || []),
      ...(composioTriggerSub.data || []),
    ];
  }, [
    designProSub.data,
    designSub.data,
    anthropicSub.data,
    openaiSub.data,
    geminiSub.data,
    veoSub.data,
    remotionSub.data,
    httpRequestSub.data,
    codeBlockSub.data,
    outputSub.data,
    markdownSub.data,
    seedanceSub.data,
    seedreamSub.data,
    composioActionSub.data,
    composioTriggerSub.data,
  ]);

  // Extract outputs from all messages and merge into global store
  useEffect(() => {
    if (!allMessages.length) return;

    // Filter for output messages
    const outputMessages = allMessages.filter(
      (msg): msg is Extract<typeof msg, { kind: "data" }> => {
        if (msg.kind !== "data") return false;
        if (msg.topic !== "output") return false;
        return true;
      }
    );

    // Sort by timestamp to ensure correct order
    const sortedOutputs = outputMessages.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Merge all outputs into global store
    for (const msg of sortedOutputs) {
      if (msg.data?.output && typeof msg.data.output === "object") {
        setWorkflowOutputs(msg.data.output as Record<string, unknown>);
      }
    }
  }, [allMessages, setWorkflowOutputs]);
}
