import { channel, topic } from "@inngest/realtime";

export const LOYALTY_PROGRAM_CHANNEL = "loyalty-program-execution";
export const loyaltyProgramChannel = channel(LOYALTY_PROGRAM_CHANNEL)
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
