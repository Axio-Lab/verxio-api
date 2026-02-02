"use client";

import type { Realtime } from "@inngest/realtime";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import { useEffect, useMemo } from "react";
import type { NodeStatus } from "@/components/node-status-indicator";
import { authenticatedGet } from "@/lib/api-client";
import {
  useSetNodeExecutionStatus,
  useSetNodeOutput,
} from "@/app/app-components/features/editor/execution-status-store";

const mapInngestStatusToNodeStatus = (inngestStatus: string): NodeStatus => {
  switch (inngestStatus) {
    case "loading":
    case "rendering":
      return "loading";
    case "success":
      return "success";
    case "error":
      return "error";
    default:
      return "initial";
  }
};

let tokenCache: {
  tokens: Record<string, Realtime.Subscribe.Token> | null;
  timestamp: number;
} = { tokens: null, timestamp: 0 };
let inFlightRequest: Promise<Record<string, Realtime.Subscribe.Token>> | null = null;
const TOKEN_CACHE_TTL = 5 * 60 * 1000;

const fetchTokens = async (): Promise<Record<string, Realtime.Subscribe.Token>> => {
  const now = Date.now();
  if (tokenCache.tokens && now - tokenCache.timestamp < TOKEN_CACHE_TTL) return tokenCache.tokens;
  if (inFlightRequest) return inFlightRequest;
  inFlightRequest = (async () => {
    try {
      const response = await authenticatedGet<{
        success: boolean;
        tokens: Record<string, Realtime.Subscribe.Token>;
        channelNames: Record<string, string>;
      }>("/workflow/subscription-token");
      tokenCache = { tokens: response.tokens, timestamp: Date.now() };
      return response.tokens;
    } finally {
      inFlightRequest = null;
    }
  })();
  return inFlightRequest;
};

/**
 * Single subscription manager at editor level. Subscribes to each channel once
 * and routes status/output messages to the execution-status-store by nodeId.
 * Call this hook once in the Editor; individual nodes use useNodeStatus(nodeId) to read from the store.
 */
export function useCentralizedNodeStatusSubscriptions() {
  const setNodeExecutionStatus = useSetNodeExecutionStatus();
  const setNodeOutput = useSetNodeOutput();

  const createRefreshToken = (channelKey: string) => async (): Promise<Realtime.Subscribe.Token> => {
    const tokens = await fetchTokens();
    const token = tokens[channelKey];
    if (!token) throw new Error(`Token not found for channel: ${channelKey}`);
    return token;
  };

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
  const veoSub = useInngestSubscription({
    refreshToken: createRefreshToken("veo"),
    enabled: true,
  });
  const klingSub = useInngestSubscription({
    refreshToken: createRefreshToken("kling"),
    enabled: true,
  });
  const outputSub = useInngestSubscription({
    refreshToken: createRefreshToken("output"),
    enabled: true,
  });

  const allMessages = useMemo(
    () => [
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
      ...(veoSub.data || []),
      ...(klingSub.data || []),
      ...(outputSub.data || []),
    ],
    [
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
      veoSub.data,
      klingSub.data,
      outputSub.data,
    ]
  );

  useEffect(() => {
    if (!allMessages.length) return;

    const statusMessages = allMessages.filter(
      (msg): msg is Extract<typeof msg, { kind: "data" }> =>
        msg.kind === "data" && msg.topic === "status" && typeof msg.data?.nodeId === "string"
    );
    const outputMessages = allMessages.filter(
      (msg): msg is Extract<typeof msg, { kind: "data" }> =>
        msg.kind === "data" && msg.topic === "output" && typeof msg.data?.nodeId === "string"
    );

    for (const msg of statusMessages) {
      const nodeId = msg.data.nodeId as string;
      if (msg.data.status) {
        setNodeExecutionStatus(nodeId, mapInngestStatusToNodeStatus(msg.data.status));
      }
    }

    for (const msg of outputMessages) {
      const nodeId = msg.data.nodeId as string;
      if (msg.data.output && typeof msg.data.output === "object") {
        const output = msg.data.output as Record<string, unknown>;
        setNodeOutput(nodeId, output);
        const hasError = Boolean(output.error);
        if (hasError) {
          setNodeExecutionStatus(nodeId, "error");
        } else {
          setNodeExecutionStatus(nodeId, "success");
        }
      }
    }
  }, [allMessages, setNodeExecutionStatus, setNodeOutput]);
}
