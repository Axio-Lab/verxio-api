import { channel, topic } from "@inngest/realtime";

export const LOYALTY_DEAL_CHANNEL = "loyalty-deal-execution";
export const loyaltyDealChannel = channel(LOYALTY_DEAL_CHANNEL)
  .addTopic(
    topic("status").type<{
      nodeId: string;
      status: "loading" | "error" | "success";
    }>()
  )
  .addTopic(
    topic("output").type<{
      nodeId: string;
      output: Record<string, unknown>;
    }>()
  );
