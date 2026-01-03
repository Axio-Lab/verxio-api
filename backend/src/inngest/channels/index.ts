/**
 * Central registry of all node status channels
 * Add new channels here to automatically include them in subscriptions
 */
import { httpRequestChannel } from "./http-request";
import { manualTriggerChannel } from "./manual-trigger";
import { webhookChannel } from "./webhook";
import { googleFormTriggerChannel } from "./google-form-trigger";
import { stripeTriggerChannel } from "./stripe-trigger";

export const nodeStatusChannels = {
  httpRequest: httpRequestChannel,
  manualTrigger: manualTriggerChannel,
  webhook: webhookChannel,
  googleFormTrigger: googleFormTriggerChannel,
  stripeTrigger: stripeTriggerChannel,
} as const;

export type NodeStatusChannelKey = keyof typeof nodeStatusChannels;

// Channel name mapping for client-side filtering
export const channelNameMap: Record<NodeStatusChannelKey, string> = {
  httpRequest: "http-request-execution",
  manualTrigger: "manual-trigger-execution",
  webhook: "webhook-execution",
  googleFormTrigger: "google-form-trigger-execution",
  stripeTrigger: "stripe-trigger-execution",
};

