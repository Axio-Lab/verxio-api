import type { NodeExecutor } from "../types";
import { timedTriggerChannel } from "@/inngest/channels/timed-trigger";

type TimedTriggerData = {
  scheduleType?: "interval" | "daily" | "weekly" | "monthly" | "cron";
  intervalHours?: number;
  intervalMinutes?: number;
  cronExpression?: string;
  timezone?: string;
  enabled?: boolean; // If false, the schedule is paused/stopped
};

// Helper to publish status updates
const publishStatus = async (
  publish: any,
  nodeId: string,
  status: "loading" | "error" | "success"
) => {
  await publish(
    timedTriggerChannel().status({
      nodeId,
      status,
    })
  );
};

export const timedTriggerExecutor: NodeExecutor<TimedTriggerData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  try {
    // Check if the schedule is enabled (paused/stopped)
    if (data.enabled === false) {
      // Schedule is paused - return context without executing
      // This allows the workflow to be saved but not executed
      return context;
    }

    // Publish loading status
    await publishStatus(publish, nodeId, "loading");

    // Timed trigger just passes through the context
    // The actual scheduling is handled by Inngest's schedule event
    const result = await step.run("timed-trigger", async () => {
      return context;
    });

    // Publish success status (outside step.run for immediate update)
    await publishStatus(publish, nodeId, "success");

    // Publish node output to realtime channel
    await publish(
      timedTriggerChannel().output({
        nodeId,
        output: result,
      })
    );

    return result;
  } catch (error) {
    // Publish error status (outside step.run for immediate update)
    await publishStatus(publish, nodeId, "error");

    // Publish error output to realtime channel
    await publish(
      timedTriggerChannel().output({
        nodeId,
        output: {
          ...context,
          error: {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
          },
        },
      })
    );

    throw error;
  }
};
