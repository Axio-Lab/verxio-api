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
    case "rendering": // Remotion-specific status
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

// Request deduplication: track in-flight requests
let inFlightRequest: Promise<Record<string, Realtime.Subscribe.Token>> | null = null;

const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fetch all subscription tokens from backend (with caching and request deduplication)
const fetchTokens = async (): Promise<Record<string, Realtime.Subscribe.Token>> => {
  const now = Date.now();

  // Return cached tokens if still valid
  if (tokenCache.tokens && now - tokenCache.timestamp < TOKEN_CACHE_TTL) {
    return tokenCache.tokens;
  }

  // If a request is already in flight, wait for it instead of making a new one
  if (inFlightRequest) {
    return inFlightRequest;
  }

  // Create new request and store it
  inFlightRequest = (async () => {
    try {
      const response = await authenticatedGet<{
        success: boolean;
        tokens: Record<string, Realtime.Subscribe.Token>;
        channelNames: Record<string, string>;
      }>("/workflow/subscription-token");

      // Update cache
      tokenCache = {
        tokens: response.tokens,
        timestamp: Date.now(),
      };

      return response.tokens;
    } finally {
      // Clear in-flight request after completion (success or error)
      inFlightRequest = null;
    }
  })();

  return inFlightRequest;
};

export function useNodeStatus({ nodeId }: useNodeStatusOptions) {
  const [status, setStatus] = useState<NodeStatus>("initial");
  const [nodeOutput, setNodeOutput] = useState<Record<string, unknown> | null>(null);

  // Create refresh token function for a specific channel (uses shared cache)
  const createRefreshToken =
    (channelKey: string) => async (): Promise<Realtime.Subscribe.Token> => {
      try {
        const tokens = await fetchTokens();
        const token = tokens[channelKey];
        if (!token) {
          throw new Error(`Token not found for channel: ${channelKey}`);
        }
        return token;
      } catch (error) {
        // Log error but don't throw - let the subscription hook handle retries
        // This prevents WebSocket connection errors from showing in console
        if (process.env.NODE_ENV === "development") {
          console.debug(`Token fetch error for ${channelKey} (will retry):`, error);
        }
        // Re-throw so the hook knows to retry
        throw error;
      }
    };

  // Subscribe to all node status channels
  // Enable immediately - refreshToken will fetch tokens when needed
  // Note: WebSocket connection errors (empty error objects) may appear in console
  // during initial connection - these are handled automatically by the Inngest Realtime library
  const httpRequestSub = useInngestSubscription({
    refreshToken: createRefreshToken("httpRequest"),
    enabled: true,
  });

  const manualTriggerSub = useInngestSubscription({
    refreshToken: createRefreshToken("manualTrigger"),
    enabled: true,
  });

  const manualInputSub = useInngestSubscription({
    refreshToken: createRefreshToken("manualInput"),
    enabled: true,
  });

  const codeBlockSub = useInngestSubscription({
    refreshToken: createRefreshToken("codeBlock"),
    enabled: true,
  });

  const webhookSub = useInngestSubscription({
    refreshToken: createRefreshToken("webhook"),
    enabled: true,
  });

  const googleFormSub = useInngestSubscription({
    refreshToken: createRefreshToken("googleFormTrigger"),
    enabled: true,
  });

  const airtableTriggerSub = useInngestSubscription({
    refreshToken: createRefreshToken("airtableTrigger"),
    enabled: true,
  });

  const stripeTriggerSub = useInngestSubscription({
    refreshToken: createRefreshToken("stripeTrigger"),
    enabled: true,
  });

  const openaiSub = useInngestSubscription({
    refreshToken: createRefreshToken("openai"),
    enabled: true,
  });

  const anthropicSub = useInngestSubscription({
    refreshToken: createRefreshToken("anthropic"),
    enabled: true,
  });

  const geminiSub = useInngestSubscription({
    refreshToken: createRefreshToken("gemini"),
    enabled: true,
  });

  const whatsappTriggerSub = useInngestSubscription({
    refreshToken: createRefreshToken("whatsappTrigger"),
    enabled: true,
  });

  const telegramTriggerSub = useInngestSubscription({
    refreshToken: createRefreshToken("telegramTrigger"),
    enabled: true,
  });

  const whatsappSub = useInngestSubscription({
    refreshToken: createRefreshToken("whatsapp"),
    enabled: true,
  });

  const telegramSub = useInngestSubscription({
    refreshToken: createRefreshToken("telegram"),
    enabled: true,
  });

  const slackSub = useInngestSubscription({
    refreshToken: createRefreshToken("slack"),
    enabled: true,
  });

  const discordSub = useInngestSubscription({
    refreshToken: createRefreshToken("discord"),
    enabled: true,
  });

  const timedTriggerSub = useInngestSubscription({
    refreshToken: createRefreshToken("timedTrigger"),
    enabled: true,
  });

  const deciderSub = useInngestSubscription({
    refreshToken: createRefreshToken("decider"),
    enabled: true,
  });

  const googleDriveSub = useInngestSubscription({
    refreshToken: createRefreshToken("googleDrive"),
    enabled: true,
  });

  const googleCalendarSub = useInngestSubscription({
    refreshToken: createRefreshToken("googleCalendar"),
    enabled: true,
  });

  const googleSheetsSub = useInngestSubscription({
    refreshToken: createRefreshToken("googleSheets"),
    enabled: true,
  });

  const googleDocsSub = useInngestSubscription({
    refreshToken: createRefreshToken("googleDocs"),
    enabled: true,
  });

  const googleMeetSub = useInngestSubscription({
    refreshToken: createRefreshToken("googleMeet"),
    enabled: true,
  });

  const googleSlidesSub = useInngestSubscription({
    refreshToken: createRefreshToken("googleSlides"),
    enabled: true,
  });

  const gmailSub = useInngestSubscription({
    refreshToken: createRefreshToken("gmail"),
    enabled: true,
  });

  const airtableSub = useInngestSubscription({
    refreshToken: createRefreshToken("airtable"),
    enabled: true,
  });

  const elevenlabsSub = useInngestSubscription({
    refreshToken: createRefreshToken("elevenlabs"),
    enabled: true,
  });

  const designSub = useInngestSubscription({
    refreshToken: createRefreshToken("design"),
    enabled: true,
  });

  const designProSub = useInngestSubscription({
    refreshToken: createRefreshToken("designPro"),
    enabled: true,
  });

  const remotionSub = useInngestSubscription({
    refreshToken: createRefreshToken("remotion"),
    enabled: true,
  });

  // Merge all messages from all subscriptions
  const allMessages = useMemo(() => {
    return [
      ...(httpRequestSub.data || []),
      ...(manualTriggerSub.data || []),
      ...(manualInputSub.data || []),
      ...(codeBlockSub.data || []),
      ...(webhookSub.data || []),
      ...(googleFormSub.data || []),
      ...(airtableTriggerSub.data || []),
      ...(stripeTriggerSub.data || []),
      ...(openaiSub.data || []),
      ...(anthropicSub.data || []),
      ...(geminiSub.data || []),
      ...(whatsappTriggerSub.data || []),
      ...(telegramTriggerSub.data || []),
      ...(whatsappSub.data || []),
      ...(telegramSub.data || []),
      ...(slackSub.data || []),
      ...(discordSub.data || []),
      ...(timedTriggerSub.data || []),
      ...(deciderSub.data || []),
      ...(googleDriveSub.data || []),
      ...(googleCalendarSub.data || []),
      ...(googleSheetsSub.data || []),
      ...(googleDocsSub.data || []),
      ...(googleMeetSub.data || []),
      ...(googleSlidesSub.data || []),
      ...(gmailSub.data || []),
      ...(airtableSub.data || []),
      ...(elevenlabsSub.data || []),
      ...(designSub.data || []),
      ...(designProSub.data || []),
      ...(remotionSub.data || []),
    ];
  }, [
    httpRequestSub.data,
    manualTriggerSub.data,
    manualInputSub.data,
    codeBlockSub.data,
    webhookSub.data,
    googleFormSub.data,
    airtableTriggerSub.data,
    stripeTriggerSub.data,
    openaiSub.data,
    anthropicSub.data,
    geminiSub.data,
    whatsappTriggerSub.data,
    telegramTriggerSub.data,
    whatsappSub.data,
    telegramSub.data,
    slackSub.data,
    discordSub.data,
    timedTriggerSub.data,
    deciderSub.data,
    googleDriveSub.data,
    googleCalendarSub.data,
    googleSheetsSub.data,
    googleDocsSub.data,
    googleMeetSub.data,
    googleSlidesSub.data,
    gmailSub.data,
    airtableSub.data,
    elevenlabsSub.data,
    designSub.data,
    designProSub.data,
    remotionSub.data,
  ]);

  // Filter and update status for this specific node
  useEffect(() => {
    if (!allMessages.length) {
      return;
    }

    // Filter status messages for this node
    const statusMessages = allMessages.filter(
      (msg): msg is Extract<typeof msg, { kind: "data" }> => {
        if (msg.kind !== "data") return false;
        if (msg.topic !== "status") return false;
        if (msg.data?.nodeId !== nodeId) return false;
        return true;
      }
    );

    // Filter output messages for this node
    const outputMessages = allMessages.filter(
      (msg): msg is Extract<typeof msg, { kind: "data" }> => {
        if (msg.kind !== "data") return false;
        if (msg.topic !== "output") return false;
        if (msg.data?.nodeId !== nodeId) return false;
        return true;
      }
    );

    // Update status from latest status message
    if (statusMessages.length > 0) {
      const latestStatus = statusMessages.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

      if (latestStatus?.data?.status) {
        const newStatus = mapInngestStatusToNodeStatus(latestStatus.data.status);
        setStatus(newStatus);
      }
    }

    // Update output from latest output message
    if (outputMessages.length > 0) {
      const latestOutput = outputMessages.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

      if (latestOutput?.data?.output) {
        setNodeOutput(latestOutput.data.output);
      }
    }
  }, [allMessages, nodeId]);

  return { status, output: nodeOutput };
}
