import { inngest } from "@/inngest/index";
import { basePrismaClient } from "@/lib/prisma";

const prisma = basePrismaClient as any;

/**
 * Deterministic idempotency key so Inngest deduplicates identical reminder events
 * (same task + due time). Without this, startup + cron + create/resume each enqueue duplicates.
 */
function reminderEventId(prefix: string, taskId: string, dueIso: string): string {
  const dateKey = dueIso.replace(/\.\d{3}Z$/, "Z");
  return `${prefix}-${taskId}-${dateKey}`;
}

function getTzParts(
  date: Date,
  timeZone: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function getOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+0";
  const m = tzPart.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hours = Number(m[2] || 0);
  const mins = Number(m[3] || 0);
  return sign * (hours * 60 + mins);
}

function addCivilDays(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/**
 * Convert a local wall-clock time in a timezone (e.g. 14:00 in America/Los_Angeles)
 * to a UTC Date, honoring timezone offset at that date.
 */
function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offsetMin = getOffsetMinutes(new Date(naiveUtcMs), timeZone);
  return new Date(naiveUtcMs - offsetMin * 60 * 1000);
}

function nextDueFromLocalTime(timeStr: string, timeZone: string, now: Date): Date | null {
  const [hours, minutes] = String(timeStr)
    .split(":")
    .map((v) => Number(v));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const zonedNow = getTzParts(now, timeZone);
  for (let offset = 0; offset < 3; offset++) {
    const d = addCivilDays(zonedNow.year, zonedNow.month, zonedNow.day, offset);
    const candidate = zonedWallTimeToUtc(d.year, d.month, d.day, hours, minutes, timeZone);
    if (candidate > now) return candidate;
  }

  return null;
}

export async function scheduleTaskReminder(taskId: string, dueAt: Date) {
  const dueIso = dueAt.toISOString();
  await inngest.send({
    id: reminderEventId("reminder", taskId, dueIso),
    name: "verxio/task.reminder",
    data: { taskId, dueAt: dueIso },
  });
  await inngest.send({
    id: reminderEventId("upcoming", taskId, dueIso),
    name: "verxio/task.upcoming-reminder",
    data: { taskId, dueAt: dueIso },
  });
}

export async function scheduleGracePeriodCheck(
  submissionId: string,
  dueAt: Date,
  graceMinutes: number
) {
  const checkAt = new Date(dueAt.getTime() + graceMinutes * 60 * 1000);
  await inngest.send({
    id: `grace-${submissionId}`,
    name: "verxio/task.grace-check",
    data: { submissionId, checkAt: checkAt.toISOString() },
  });
}

export async function scheduleDailyReport(taskId: string, reportTime: string) {
  const today = new Date().toISOString().slice(0, 10);
  await inngest.send({
    id: `daily-report-${taskId}-${today}`,
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
 * Each send uses a stable `id` so Inngest deduplicates; repeated schedule calls are safe.
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
      const tz = task.timezone || "UTC";
      const scheduledTimes = Array.isArray(task.scheduledTimes)
        ? (task.scheduledTimes as string[])
        : [];

      for (const timeStr of scheduledTimes) {
        const dueAt = nextDueFromLocalTime(timeStr, tz, now);
        if (!dueAt) continue;
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
