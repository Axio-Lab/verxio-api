import { getSubscriptionToken } from "@inngest/realtime";
import { inngest } from "../index";
import { httpRequestChannel } from "../channels/http-request";
import type { Realtime } from "@inngest/realtime";

export type HttpRequestToken = Realtime.Token<
  typeof httpRequestChannel,
  ["status"]
>;

/**
 * Generate a subscription token for HTTP request node status updates
 */
export async function getHttpRequestSubscriptionToken(): Promise<HttpRequestToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: httpRequestChannel(),
    topics: ["status"] as const
  });
  return token as HttpRequestToken;
}

