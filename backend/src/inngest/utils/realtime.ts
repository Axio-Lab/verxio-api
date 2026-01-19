import { getSubscriptionToken } from "@inngest/realtime";
import { inngest } from "../index";
import { nodeStatusChannels, type NodeStatusChannelKey } from "../channels";
import type { Realtime } from "@inngest/realtime";

/**
 * Generate subscription tokens for all node status channels
 *
 * This function automatically generates tokens for all channels registered in nodeStatusChannels.
 * To add a new trigger type, simply add it to the channels/index.ts registry.
 *
 * Inngest realtime tokens are per-channel, so we generate tokens for all channels.
 * Returns an object with all tokens keyed by channel name.
 */
export async function getNodeStatusSubscriptionTokens(): Promise<
  Record<NodeStatusChannelKey, Realtime.Subscribe.Token>
> {
  // Generate tokens for all channels in parallel
  const tokenPromises = Object.entries(nodeStatusChannels).map(async ([key, channel]) => {
    // Design Pro channel has an additional "chat" topic
    const topics: ("status" | "output" | "chat")[] =
      key === "designPro" ? ["status", "output", "chat"] : ["status", "output"];
    const token = await getSubscriptionToken(inngest, {
      channel: channel(),
      topics: topics as ("status" | "output")[],
    });
    return [key, token] as [NodeStatusChannelKey, Realtime.Subscribe.Token];
  });

  const tokenEntries = await Promise.all(tokenPromises);

  // Convert array of [key, token] pairs to object
  return Object.fromEntries(tokenEntries) as Record<NodeStatusChannelKey, Realtime.Subscribe.Token>;
}
