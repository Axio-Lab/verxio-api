import * as cron from "node-cron";
import { inngest } from "../inngest";
import { basePrismaClient } from "../lib/prisma";

const prisma = basePrismaClient as any;

/**
 * Map of workflow node IDs to their cron jobs
 */

const activeCronJobs = new Map<string, cron.ScheduledTask>();

/**
 * Convert schedule configuration to a cron expression
 */
function scheduleToCronExpression(
  scheduleType: string,
  intervalHours: number | undefined,
  intervalMinutes: number | undefined,
  cronExpression: string | undefined
): string | null {
  switch (scheduleType) {
    case "interval": {
      if (!intervalHours && !intervalMinutes) return null;
      const totalMinutes = (intervalHours || 0) * 60 + (intervalMinutes || 0);
      if (totalMinutes === 0) return null;

      // Convert minutes to cron expression: "*/X * * * *"
      // For example: 5 minutes = "*/5 * * * *", 60 minutes = "0 * * * *"
      if (totalMinutes < 60) {
        return `*/${totalMinutes} * * * *`;
      } else {
        const hours = Math.floor(totalMinutes / 60);
        const remainingMinutes = totalMinutes % 60;
        if (remainingMinutes === 0) {
          return `0 */${hours} * * *`;
        } else {
          // For complex intervals, use minutes
          return `*/${totalMinutes} * * * *`;
        }
      }
    }
    case "daily": {
      // Run daily at midnight
      return "0 0 * * *";
    }
    case "weekly": {
      // Run every Monday at midnight
      return "0 0 * * 1";
    }
    case "monthly": {
      // Run on the 1st of every month at midnight
      return "0 0 1 * *";
    }
    case "cron": {
      // Use the provided cron expression directly
      return cronExpression || null;
    }
    default:
      return null;
  }
}

export async function scheduleTimedTrigger(
  workflowId: string,
  userId: string,
  nodeId: string,
  nodeData: any
): Promise<void> {
  // Cancel existing cron job if it exists (for updates)
  if (activeCronJobs.has(nodeId)) {
    const existingJob = activeCronJobs.get(nodeId);
    if (existingJob) {
      existingJob.stop();
      activeCronJobs.delete(nodeId);
    }
  }

  // Check if the trigger is enabled
  const isEnabled =
    nodeData.enabled !== false && nodeData.enabled !== "false" && nodeData.enabled !== 0;
  if (!isEnabled) {
    console.log(`[cron-scheduler] Timed trigger ${nodeId} is disabled, not scheduling`);
    return;
  }

  // Get schedule configuration
  const scheduleType = nodeData.scheduleType || "interval";
  const intervalHours = nodeData.intervalHours;
  const intervalMinutes = nodeData.intervalMinutes;
  const cronExpression = nodeData.cronExpression;

  // Convert to cron expression
  const cronExpr = scheduleToCronExpression(
    scheduleType,
    intervalHours,
    intervalMinutes,
    cronExpression
  );

  if (!cronExpr) {
    console.warn(`[cron-scheduler] Invalid schedule configuration for node ${nodeId}`);
    return;
  }

  // Validate cron expression
  if (!cron.validate(cronExpr)) {
    console.warn(`[cron-scheduler] Invalid cron expression: ${cronExpr} for node ${nodeId}`);
    return;
  }

  // Create and schedule the cron job
  // This creates a timer that fires at the specified schedule
  const job = cron.schedule(cronExpr, async () => {
    console.log(`[cron-scheduler] Triggering workflow ${workflowId} via cron for node ${nodeId}`);

    try {
      // Send event to Inngest to trigger the workflow
      // This is non-blocking and efficient
      await inngest.send({
        name: "workflow/trigger",
        data: {
          workflowId,
          userId,
          timedTriggerNodeId: nodeId,
        },
      });

      // Update last run time (non-blocking)
      await prisma.node.update({
        where: { id: nodeId },
        data: {
          data: {
            ...nodeData,
            lastRunTime: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error(`[cron-scheduler] Error triggering workflow ${workflowId}:`, error);
    }
  });

  // Store the job so we can cancel it later
  activeCronJobs.set(nodeId, job);

  console.log(
    `[cron-scheduler] Scheduled cron job for workflow ${workflowId}, node ${nodeId} with expression: ${cronExpr}`
  );
}

/**
 * Cancel a scheduled cron job for a timed trigger node
 */
export function cancelTimedTrigger(nodeId: string): void {
  const job = activeCronJobs.get(nodeId);
  if (job) {
    job.stop();
    activeCronJobs.delete(nodeId);
    console.log(`[cron-scheduler] Cancelled cron job for node ${nodeId}`);
  }
}

/**
 * Initialize cron scheduler on server startup
 * Loads all active timed triggers and schedules them
 *
 * SCALABILITY CONSIDERATIONS:
 * - On startup, loads all workflows from database
 * - For 1000 users, this is a one-time query (efficient)
 * - Each cron job is created and stored in memory
 * - Startup time increases with number of workflows, but is acceptable
 */
export async function initializeCronScheduler(): Promise<void> {
  console.log("[cron-scheduler] Initializing cron scheduler...");

  try {
    // Find all workflows with TIMED_TRIGGER nodes
    // This is a one-time query on server startup
    const allWorkflows = await prisma.workflow.findMany({
      include: {
        nodes: {
          where: {
            type: "TIMED_TRIGGER",
          },
        },
      },
    });

    // Filter to only workflows that have timed trigger nodes
    const workflowsWithTimedTriggers = allWorkflows.filter(
      (workflow: any) => workflow.nodes && workflow.nodes.length > 0
    );

    console.log(
      `[cron-scheduler] Found ${workflowsWithTimedTriggers.length} workflow(s) with timed triggers`
    );

    // Schedule cron jobs for each active timed trigger
    // This creates all cron jobs in memory
    let scheduledCount = 0;
    for (const workflow of workflowsWithTimedTriggers) {
      for (const node of workflow.nodes) {
        const nodeData = (node.data as any) || {};
        const isEnabled =
          nodeData.enabled !== false && nodeData.enabled !== "false" && nodeData.enabled !== 0;

        if (isEnabled) {
          await scheduleTimedTrigger(
            (workflow as any).id,
            (workflow as any).userId,
            node.id,
            nodeData
          );
          scheduledCount++;
        }
      }
    }

    console.log(
      `[cron-scheduler] Initialized ${scheduledCount} active cron job(s) (total workflows: ${workflowsWithTimedTriggers.length})`
    );
  } catch (error) {
    console.error("[cron-scheduler] Error initializing cron scheduler:", error);
  }
}

/**
 * Get all active cron jobs (for debugging/monitoring)
 */
export function getActiveCronJobs(): Array<{ nodeId: string }> {
  return Array.from(activeCronJobs.keys()).map((nodeId) => ({ nodeId }));
}

/**
 * Get statistics about cron scheduler (for monitoring)
 */
export function getCronSchedulerStats(): {
  activeJobs: number;
  memoryUsage: NodeJS.MemoryUsage;
} {
  return {
    activeJobs: activeCronJobs.size,
    memoryUsage: process.memoryUsage(),
  };
}
