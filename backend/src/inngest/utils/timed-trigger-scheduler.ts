import { inngest } from "../index";
import { basePrismaClient } from "../../lib/prisma";

const prisma = basePrismaClient as any;

type ScheduleType = "interval" | "daily" | "weekly" | "monthly" | "cron";

interface TimedTriggerConfig {
  scheduleType: ScheduleType;
  intervalHours?: number;
  intervalMinutes?: number;
  cronExpression?: string;
  timezone: string;
  enabled: boolean;
}

/**
 * Calculate the next run time for a timed trigger based on its schedule
 */
export function calculateNextRunTime(
  config: TimedTriggerConfig,
  lastRunTime: Date | null = null
): Date | null {
  const now = new Date();
  const timezone = config.timezone || "UTC";

  switch (config.scheduleType) {
    case "interval": {
      if (!config.intervalHours && !config.intervalMinutes) return null;
      const totalMinutes = (config.intervalHours || 0) * 60 + (config.intervalMinutes || 0);
      if (totalMinutes === 0) return null;

      // If no last run time, schedule for now (immediate)
      if (!lastRunTime) {
        return now;
      }

      // Calculate next run time
      const intervalMs = totalMinutes * 60 * 1000;
      const nextRun = new Date(lastRunTime.getTime() + intervalMs);

      // If next run is in the past, schedule for now
      if (nextRun <= now) {
        return now;
      }

      return nextRun;
    }

    case "daily": {
      // Run once per day at midnight in the specified timezone
      // Simple approach: get date string in target timezone, calculate next midnight
      const tzFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      const tzDateStr = tzFormatter.format(now);
      const [tzYear, tzMonth, tzDay] = tzDateStr.split("-").map(Number);

      // Check if we already ran today
      const tzLastRunStr = lastRunTime ? tzFormatter.format(lastRunTime) : null;
      const ranToday = tzLastRunStr === tzDateStr;

      // Target date for next run (tomorrow if ran today, today if not)
      const targetDay = ranToday ? tzDay + 1 : tzDay;
      const targetMonth =
        ranToday && targetDay > new Date(tzYear, tzMonth, 0).getDate() ? tzMonth + 1 : tzMonth;
      const targetYear = targetMonth > 12 ? tzYear + 1 : tzYear;
      const finalMonth = targetMonth > 12 ? 1 : targetMonth;

      // Create a date string for midnight in target timezone: "YYYY-MM-DD 00:00:00"
      // Then find the UTC equivalent
      const targetDateStr = `${targetYear}-${String(finalMonth).padStart(2, "0")}-${String(ranToday && targetDay > new Date(tzYear, tzMonth, 0).getDate() ? 1 : targetDay).padStart(2, "0")} 00:00:00`;

      // Use a helper to convert timezone date to UTC
      // Create date in target timezone, then get UTC equivalent
      const tempDate = new Date(targetDateStr);
      const tzOffsetMs =
        (tempDate.getTimezoneOffset() - new Date(targetDateStr + " UTC").getTimezoneOffset()) *
        60 *
        1000;

      // Better approach: use Intl to format the target date and calculate offset
      const targetTzDate = new Date(
        `${targetYear}-${String(finalMonth).padStart(2, "0")}-${String(ranToday && targetDay > new Date(tzYear, tzMonth, 0).getDate() ? 1 : targetDay).padStart(2, "0")}T00:00:00`
      );

      // Get what time this represents in UTC by formatting it
      const utcFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Calculate the offset by comparing what midnight in TZ is in UTC
      const tzMidnightUTC = new Date(targetTzDate.toLocaleString("en-US", { timeZone: "UTC" }));
      const tzMidnightTZ = new Date(targetTzDate.toLocaleString("en-US", { timeZone: timezone }));
      const offset = tzMidnightTZ.getTime() - tzMidnightUTC.getTime();

      const nextRun = new Date(targetTzDate.getTime() - offset);
      return nextRun > now ? nextRun : new Date(nextRun.getTime() + 24 * 60 * 60 * 1000);
    }

    case "weekly": {
      // Run once per week on Monday at midnight
      const tzNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
      const tzLastRun = lastRunTime
        ? new Date(lastRunTime.toLocaleString("en-US", { timeZone: timezone }))
        : null;

      // Find next Monday
      const daysUntilMonday = (8 - tzNow.getDay()) % 7 || 7; // 0 = Sunday, so Monday is 1
      const nextMonday = new Date(tzNow);

      if (daysUntilMonday === 7) {
        // Today is Monday, check if we already ran
        if (tzLastRun && tzLastRun.toDateString() === tzNow.toDateString()) {
          nextMonday.setDate(nextMonday.getDate() + 7);
        } else {
          // Schedule for today at midnight
          nextMonday.setHours(0, 0, 0, 0);
        }
      } else {
        nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
        nextMonday.setHours(0, 0, 0, 0);
      }

      // Convert back to UTC
      const utcOffset = now.getTime() - tzNow.getTime();
      const nextRun = new Date(nextMonday.getTime() - utcOffset);

      return nextRun > now ? nextRun : new Date(nextRun.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    case "monthly": {
      // Run once per month on the 1st at midnight
      const tzNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
      const tzLastRun = lastRunTime
        ? new Date(lastRunTime.toLocaleString("en-US", { timeZone: timezone }))
        : null;

      // Find next 1st of month
      const nextFirst = new Date(tzNow);

      if (tzNow.getDate() === 1) {
        // Today is the 1st, check if we already ran
        if (tzLastRun && tzLastRun.toDateString() === tzNow.toDateString()) {
          // Schedule for next month
          nextFirst.setMonth(nextFirst.getMonth() + 1, 1);
        } else {
          // Schedule for today at midnight
          nextFirst.setHours(0, 0, 0, 0);
        }
      } else {
        // Schedule for 1st of next month
        nextFirst.setMonth(nextFirst.getMonth() + 1, 1);
        nextFirst.setHours(0, 0, 0, 0);
      }

      // Convert back to UTC
      const utcOffset = now.getTime() - tzNow.getTime();
      const nextRun = new Date(nextFirst.getTime() - utcOffset);

      return nextRun > now ? nextRun : null;
    }

    case "cron": {
      // Cron expressions not yet fully implemented
      console.warn("Cron expressions not yet fully implemented for event-based scheduling");
      return null;
    }

    default:
      return null;
  }
}

/**
 * Schedule an Inngest event for a timed trigger
 */
export async function scheduleTimedTriggerEvent(
  workflowId: string,
  userId: string,
  timedTriggerNodeId: string,
  nextRunTime: Date
): Promise<string | null> {
  try {
    // Inngest doesn't return event IDs directly, but we can use a unique event name
    // to track scheduled events. We'll store the scheduled time in the node data.
    const eventId = `timed-trigger-${workflowId}-${timedTriggerNodeId}-${nextRunTime.getTime()}`;

    // Store the scheduled event info in node data
    // The check-scheduled-events cron function will fire the event when it's time
    // We don't send the event immediately - we just store when it should fire
    const now = Date.now();
    const scheduledTime = nextRunTime.getTime();

    if (scheduledTime <= now) {
      // If scheduled time is in the past or now, fire immediately
      console.log(
        `Scheduled time ${nextRunTime.toISOString()} is in the past/now. Firing event immediately.`
      );

      await inngest.send({
        name: "workflow/trigger",
        id: eventId,
        data: {
          workflowId,
          userId,
          timedTriggerNodeId,
        },
      });

      // Don't store scheduled info since we fired immediately
      return eventId;
    }

    console.log(
      `Scheduling event ${eventId} for ${nextRunTime.toISOString()} (in ${Math.round((scheduledTime - now) / 1000)}s)`
    );

    // Don't send the event now - just store the schedule info
    // The check-scheduled-events cron will fire it when ready

    // Store the scheduled event info in node data
    const node = await prisma.node.findUnique({
      where: { id: timedTriggerNodeId },
    });

    if (node) {
      const nodeData = (node.data as any) || {};
      await prisma.node.update({
        where: { id: timedTriggerNodeId },
        data: {
          data: {
            ...nodeData,
            scheduledEventId: eventId,
            scheduledEventTime: nextRunTime.toISOString(),
          },
        },
      });
    }

    return eventId;
  } catch (error) {
    console.error(`Failed to schedule timed trigger event for workflow ${workflowId}:`, error);
    return null;
  }
}

/**
 * Cancel a scheduled timed trigger event
 * Note: Inngest doesn't have a direct cancel API, but we can mark it as cancelled
 * and filter it out in the trigger-workflow function
 */
export async function cancelTimedTriggerEvent(timedTriggerNodeId: string): Promise<void> {
  try {
    const node = await prisma.node.findUnique({
      where: { id: timedTriggerNodeId },
    });

    if (node) {
      const nodeData = (node.data as any) || {};
      await prisma.node.update({
        where: { id: timedTriggerNodeId },
        data: {
          data: {
            ...nodeData,
            scheduledEventId: null,
            scheduledEventTime: null,
            cancelled: true, // Mark as cancelled
          },
        },
      });
    }
  } catch (error) {
    console.error(`Failed to cancel timed trigger event for node ${timedTriggerNodeId}:`, error);
  }
}

/**
 * Initialize or reschedule a timed trigger based on its configuration
 */
export async function initializeOrRescheduleTimedTrigger(
  workflowId: string,
  userId: string,
  timedTriggerNodeId: string,
  config: TimedTriggerConfig
): Promise<void> {
  // If disabled, cancel any existing scheduled events
  if (!config.enabled) {
    await cancelTimedTriggerEvent(timedTriggerNodeId);
    return;
  }

  // Get the node to check last run time
  const node = await prisma.node.findUnique({
    where: { id: timedTriggerNodeId },
  });

  if (!node) {
    console.error(`Node ${timedTriggerNodeId} not found`);
    return;
  }

  const nodeData = (node.data as any) || {};
  const lastRunTime = nodeData.lastRunTime ? new Date(nodeData.lastRunTime) : null;

  // Calculate next run time
  const nextRunTime = calculateNextRunTime(config, lastRunTime);

  if (!nextRunTime) {
    console.warn(`Could not calculate next run time for timed trigger ${timedTriggerNodeId}`);
    return;
  }

  // Cancel any existing scheduled event
  await cancelTimedTriggerEvent(timedTriggerNodeId);

  // Schedule new event
  await scheduleTimedTriggerEvent(workflowId, userId, timedTriggerNodeId, nextRunTime);

  console.log(
    `Scheduled timed trigger for workflow ${workflowId}, node ${timedTriggerNodeId} at ${nextRunTime.toISOString()}`
  );
}
