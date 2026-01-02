import { getSubscriptionToken } from "@inngest/realtime";
import { inngest } from "../index";
import { httpRequestChannel } from "../channels/http-request";
import { manualTriggerChannel } from "../channels/manual-trigger";
import type { Realtime } from "@inngest/realtime";

// Token type that supports both HTTP request and manual trigger channels
export type NodeStatusToken = Realtime.Token<
  typeof httpRequestChannel | typeof manualTriggerChannel,
  ["status"]
>;

/**
 * Generate subscription tokens for node status updates (HTTP request and manual trigger nodes)
 * 
 * Inngest realtime tokens are per-channel, so we need to generate tokens for both channels.
 * Returns an object with both tokens so the client can subscribe to both.
 */
export async function getNodeStatusSubscriptionTokens(): Promise<{
  httpRequestToken: Realtime.Token<typeof httpRequestChannel, ["status"]>;
  manualTriggerToken: Realtime.Token<typeof manualTriggerChannel, ["status"]>;
}> {
  // Generate tokens for both channels
  const [httpRequestToken, manualTriggerToken] = await Promise.all([
    getSubscriptionToken(inngest, {
      channel: httpRequestChannel(),
      topics: ["status"] as const
    }),
    getSubscriptionToken(inngest, {
      channel: manualTriggerChannel(),
      topics: ["status"] as const
    })
  ]);

  return {
    httpRequestToken: httpRequestToken as Realtime.Token<typeof httpRequestChannel, ["status"]>,
    manualTriggerToken: manualTriggerToken as Realtime.Token<typeof manualTriggerChannel, ["status"]>
  };
}
