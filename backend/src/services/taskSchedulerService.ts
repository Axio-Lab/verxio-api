import { inngest } from "@/inngest/index";
import { basePrismaClient } from "@/lib/prisma";

const prisma = basePrismaClient as any;

export async function scheduleTaskReminder(taskId: string, dueAt: Date) {
  await inngest.send({
    name: "verxio/task.reminder",
    data: { taskId, dueAt: dueAt.toISOString() },
  });
  await inngest.send({
    name: "verxio/task.upcoming-reminder",
    data: { taskId, dueAt: dueAt.toISOString() },
  });
}

export async function scheduleGracePeriodCheck(
  submissionId: string,
  dueAt: Date,
  graceMinutes: number
) {
  const checkAt = new Date(dueAt.getTime() + graceMinutes * 60 * 1000);
  await inngest.send({
    name: "verxio/task.grace-check",
    data: { submissionId, checkAt: checkAt.toISOString() },
  });
}

export async function scheduleDailyReport(taskId: string, reportTime: string) {
  await inngest.send({
    name: "verxio/task.daily-report",
    data: { taskId, reportTime },
  });
}

/**
 * Schedule reminders for all ACTIVE tasks that have workers.
 * Handles DAILY / WEEKLY (scheduledTimes) and INTERVAL (recurrenceInterval).
 * ONCE tasks are not rescheduled — they rely on manual trigger or a single scheduled reminder at creation.
 *
 * For each qualifying slot whose dueAt is in the future (within 24h), we emit
 * verxio/task.reminder + verxio/task.upcoming-reminder Inngest events.
 * Inngest deduplicates by event data, so repeated calls are safe.
 */
export async function scheduleAllActiveTaskReminders() {
  const tasks = await prisma.humanTask.findMany({
    where: { status: "ACTIVE" },
    include: {
      workers: {
        where: { status: { in: ["ACTIVE", "ONBOARDING"] } },
      },
    },
  });

  const now = new Date();

  for (const task of tasks) {
    if (task.workers.length === 0) continue;

    const recurrence = task.recurrenceType || "DAILY";

    if (recurrence === "DAILY" || recurrence === "WEEKLY") {
      const scheduledTimes = Array.isArray(task.scheduledTimes)
        ? (task.scheduledTimes as string[])
        : [];

      for (const timeStr of scheduledTimes) {
        const [hours, minutes] = timeStr.split(":").map(Number);
        if (isNaN(hours) || isNaN(minutes)) continue;

        const dueAt = new Date(now);
        dueAt.setHours(hours, minutes, 0, 0);

        if (dueAt <= now) {
          dueAt.setDate(dueAt.getDate() + 1);
        }

        await scheduleTaskReminder(task.id, dueAt);
      }
    } else if (recurrence === "INTERVAL") {
      const intervalMinutes = task.recurrenceInterval || 60;
      const msInterval = intervalMinutes * 60 * 1000;

      // Schedule next 3 upcoming interval slots so reminders don't lapse
      let nextDue = new Date(now.getTime() + msInterval - (now.getTime() % msInterval));
      for (let i = 0; i < 3; i++) {
        if (nextDue.getTime() - now.getTime() > 24 * 60 * 60 * 1000) break;
        await scheduleTaskReminder(task.id, nextDue);
        nextDue = new Date(nextDue.getTime() + msInterval);
      }
    }
  }

  console.log(
    `[TaskScheduler] Scheduled reminders for ${tasks.filter((t: any) => t.workers.length > 0).length} active task(s)`
  );
}
