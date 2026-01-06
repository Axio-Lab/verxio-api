import { inngest } from "../index";
import { basePrismaClient } from "../../lib/prisma";

const prisma = basePrismaClient as any;

/**
 * Check if it's time to run a scheduled workflow
 */
function shouldRunNow(
  scheduleType: string,
  intervalHours: number | undefined,
  intervalMinutes: number | undefined,
  cronExpression: string | undefined,
  timezone: string,
  lastRunTime: Date | null,
  workflowCreatedAt: Date
): boolean {
  const now = new Date();

  // Use workflow creation time as fallback if no last run time
  const referenceTime = lastRunTime || workflowCreatedAt;
  const timeSinceLastRun = now.getTime() - referenceTime.getTime();

  switch (scheduleType) {
    case "interval": {
      if (!intervalHours && !intervalMinutes) return false;
      const totalMinutes = (intervalHours || 0) * 60 + (intervalMinutes || 0);
      if (totalMinutes === 0) return false;

      const intervalMs = totalMinutes * 60 * 1000;

      // If no last run time, run immediately (first run)
      if (!lastRunTime) {
        return true;
      }

      // Check if enough time has passed (with 10 second tolerance for cron timing)
      // This ensures we catch runs even if the cron is slightly delayed
      return timeSinceLastRun >= intervalMs - 10000;
    }
    case "daily": {
      // Run once per day at midnight in the specified timezone
      const tzNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
      const tzRef = new Date(referenceTime.toLocaleString("en-US", { timeZone: timezone }));

      // Check if we're in a new day
      const daysDiff = Math.floor((tzNow.getTime() - tzRef.getTime()) / (24 * 60 * 60 * 1000));

      // Run if it's a new day and we're past midnight (within first hour)
      return daysDiff >= 1 && tzNow.getHours() === 0 && tzNow.getMinutes() < 1;
    }
    case "weekly": {
      // Run once per week (Monday at midnight)
      const tzNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
      const tzRef = new Date(referenceTime.toLocaleString("en-US", { timeZone: timezone }));

      const daysDiff = Math.floor((tzNow.getTime() - tzRef.getTime()) / (24 * 60 * 60 * 1000));
      const isMonday = tzNow.getDay() === 1;

      return daysDiff >= 7 && isMonday && tzNow.getHours() === 0 && tzNow.getMinutes() < 1;
    }
    case "monthly": {
      // Run once per month (1st of month at midnight)
      const tzNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
      const tzRef = new Date(referenceTime.toLocaleString("en-US", { timeZone: timezone }));

      const isFirstOfMonth = tzNow.getDate() === 1;
      const isNewMonth =
        tzNow.getMonth() !== tzRef.getMonth() || tzNow.getFullYear() !== tzRef.getFullYear();

      return isNewMonth && isFirstOfMonth && tzNow.getHours() === 0 && tzNow.getMinutes() < 1;
    }
    case "cron": {
      // For cron, we'd need a cron parser library like node-cron
      // For now, log that cron needs implementation
      console.warn("Cron expressions not yet fully implemented");
      return false;
    }
    default:
      return false;
  }
}

/**
 * Scheduled function that runs every minute to check for timed triggers
 */
export const checkTimedTriggers = inngest.createFunction(
  {
    id: "check-timed-triggers",
    retries: 0,
  },
  {
    cron: "*/1 * * * *", // Run every minute
  },
  async ({ step }) => {
    await step.run("check-and-trigger-workflows", async () => {
      const currentTime = new Date();

      // Find all workflows with TIMED_TRIGGER nodes
      // Note: We fetch all timed trigger nodes and filter by enabled status in code
      // because Prisma doesn't easily support filtering JSON fields (data.enabled)
      const allWorkflows = await prisma.workflow.findMany({
        include: {
          nodes: {
            where: {
              type: "TIMED_TRIGGER",
            },
          },
        },
      });

      // First, filter to only workflows that actually have TIMED_TRIGGER nodes
      const workflowsWithTimedTriggers = allWorkflows.filter((workflow: any) => {
        return workflow.nodes && workflow.nodes.length > 0;
      });

      // Early exit if no workflows have timed triggers
      if (workflowsWithTimedTriggers.length === 0) {
        console.log(
          `[check-timed-triggers] No workflows with timed triggers found. Exiting early.`
        );
        return;
      }

      // Then filter out workflows with disabled/paused timed triggers
      const activeWorkflows = workflowsWithTimedTriggers.filter((workflow: any) => {
        const timedTriggerNode = workflow.nodes.find((node: any) => node.type === "TIMED_TRIGGER");

        if (!timedTriggerNode) return false;

        const nodeData = timedTriggerNode.data as any;

        // Only process workflows where the timed trigger is enabled
        // If enabled is undefined, default to true for backward compatibility
        // Handle both boolean false and string "false" values
        const isEnabled =
          nodeData.enabled !== false && nodeData.enabled !== "false" && nodeData.enabled !== 0;

        return isEnabled;
      });

      console.log(
        `[check-timed-triggers] Found ${workflowsWithTimedTriggers.length} workflow(s) with timed triggers, ${activeWorkflows.length} are active (not paused)`
      );

      // Early exit if no active workflows (all are paused)
      if (activeWorkflows.length === 0) {
        console.log(
          `[check-timed-triggers] No active timed triggers found. All workflows are paused. Exiting early.`
        );
        return;
      }

      // Process only active (non-paused) workflows
      for (const workflow of activeWorkflows) {
        const timedTriggerNode = (workflow as any).nodes.find(
          (node: any) => node.type === "TIMED_TRIGGER"
        );

        if (!timedTriggerNode) continue;

        const nodeData = timedTriggerNode.data as any;

        // Get schedule configuration
        const scheduleType = nodeData.scheduleType || "interval";
        const intervalHours = nodeData.intervalHours;
        const intervalMinutes = nodeData.intervalMinutes;
        const cronExpression = nodeData.cronExpression;
        const timezone = nodeData.timezone || "UTC";

        // Get last run time from node data (stored after each run)
        const lastRunTime = nodeData.lastRunTime ? new Date(nodeData.lastRunTime) : null;

        // Check if it's time to run
        const shouldRun = shouldRunNow(
          scheduleType,
          intervalHours,
          intervalMinutes,
          cronExpression,
          timezone,
          lastRunTime,
          (workflow as any).createdAt
        );

        if (shouldRun) {
          console.log(
            `[check-timed-triggers] Triggering workflow ${workflow.id} with timed trigger node ${timedTriggerNode.id}`
          );

          // Trigger the workflow
          await inngest.send({
            name: "workflow/trigger",
            data: {
              workflowId: (workflow as any).id,
              userId: (workflow as any).userId,
              timedTriggerNodeId: timedTriggerNode.id,
            },
          });

          // Update last run time in node data
          await prisma.node.update({
            where: { id: timedTriggerNode.id },
            data: {
              data: {
                ...nodeData,
                lastRunTime: currentTime.toISOString(),
              },
            },
          });
        }
      }
    });
  }
);
