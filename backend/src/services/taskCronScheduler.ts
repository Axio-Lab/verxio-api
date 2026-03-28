/**
 * In-process cron-based task scheduler.
 *
 * Replaces Inngest reminder/upcoming-reminder/grace-check/scheduler-cron functions
 * with a single node-cron job that polls the database every minute.
 *
 * Inngest is still used for: AI vetting, daily report generation, goal orchestration.
 */

import * as cron from "node-cron";
import { basePrismaClient } from "@/lib/prisma";
import {
  formatTelegramMessage,
  formatWhatsAppMessage,
  formatSlackMessage,
  formatDiscordMessage,
} from "@/services/chatIntegrationService";
import { sendWhatsAppMessage } from "@/services/whatsappConnectorClient";
import { sendDiscordMessage } from "@/services/discordConnectorClient";
import { resolveWorkerNotifyChannel } from "@/services/humanWorkerService";
import { createPendingSubmission, markMissed } from "@/services/taskSubmissionService";
import { generateScheduledReports } from "@/services/taskReportService";

const prisma = basePrismaClient as any;

const UPCOMING_REMINDER_MINUTES = 30;

let schedulerJob: cron.ScheduledTask | null = null;

// ─── Platform message delivery ────────────────────────────────────────

async function sendMessageToWorker(worker: any, channel: any, message: string) {
  if (!channel) return;

  switch (worker.platform) {
    case "WHATSAPP": {
      if (channel.whatsappSessionId) {
        await sendWhatsAppMessage({
          sessionRef: channel.whatsappSessionId,
          toJid: worker.externalId,
          text: formatWhatsAppMessage(message),
        });
      }
      break;
    }
    case "TELEGRAM": {
      if (channel.telegramBotToken) {
        const formatted = formatTelegramMessage(message);
        const chatId = /^\d+$/.test(String(worker.externalId).trim())
          ? Number(worker.externalId)
          : worker.externalId;
        await fetch(`https://api.telegram.org/bot${channel.telegramBotToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: formatted, parse_mode: "HTML" }),
        });
      }
      break;
    }
    case "SLACK": {
      if (channel.slackBotToken) {
        await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channel.slackBotToken}`,
          },
          body: JSON.stringify({
            channel: worker.externalId,
            text: formatSlackMessage(message),
          }),
        });
      }
      break;
    }
    case "DISCORD": {
      if (channel.discordBotToken) {
        await sendDiscordMessage({
          integrationId: channel.id,
          channelId: worker.externalId,
          text: formatDiscordMessage(message),
        });
      }
      break;
    }
  }
}

// ─── Timezone helpers (copied from taskSchedulerService.ts) ───────────

function getTzParts(date: Date, timeZone: string) {
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
  return sign * (Number(m[2] || 0) * 60 + Number(m[3] || 0));
}

function addCivilDays(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

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

// ─── 1. Pre-create PENDING submissions for upcoming slots ─────────────

async function preCreateSubmissions() {
  const now = new Date();
  const horizon = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour ahead

  const tasks = await prisma.humanTask.findMany({
    where: { status: "ACTIVE" },
    include: {
      workers: { where: { status: { in: ["ACTIVE", "ONBOARDING"] } } },
    },
  });

  for (const task of tasks) {
    if (task.workers.length === 0) continue;

    const dueTimes: Date[] = [];
    const recurrence = task.recurrenceType || "DAILY";

    if (recurrence === "DAILY" || recurrence === "WEEKLY") {
      const tz = task.timezone || "UTC";
      const scheduledTimes = Array.isArray(task.scheduledTimes)
        ? (task.scheduledTimes as string[])
        : [];
      for (const timeStr of scheduledTimes) {
        const dueAt = nextDueFromLocalTime(timeStr, tz, now);
        if (dueAt && dueAt <= horizon) dueTimes.push(dueAt);
      }
    } else if (recurrence === "INTERVAL") {
      const intervalMs = (task.recurrenceInterval || 60) * 60 * 1000;
      let nextDue = new Date(now.getTime() + intervalMs - (now.getTime() % intervalMs));
      for (let i = 0; i < 3 && nextDue <= horizon; i++) {
        dueTimes.push(nextDue);
        nextDue = new Date(nextDue.getTime() + intervalMs);
      }
    }

    for (const dueAt of dueTimes) {
      for (const worker of task.workers) {
        await createPendingSubmission(task.id, worker.id, dueAt);
      }
    }
  }
}

// ─── 2. Send "due now" reminders ──────────────────────────────────────

async function sendDueReminders() {
  const now = new Date();

  const dueSubmissions = await prisma.taskSubmission.findMany({
    where: {
      status: "PENDING",
      dueAt: { lte: now },
      reminderSentAt: null,
    },
    include: {
      worker: { include: { taskChannel: true } },
      humanTask: { include: { taskChannel: true } },
    },
  });

  for (const sub of dueSubmissions) {
    const task = sub.humanTask;
    const worker = sub.worker;
    if (!task || !worker) continue;

    const dueLabel = new Date(sub.dueAt).toLocaleString("en-US", {
      timeZone: task.timezone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    const evidenceHint =
      task.evidenceType === "PHOTO"
        ? "Take a LIVE photo using the camera button in this chat. Do not upload from your gallery."
        : task.evidenceType === "TEXT"
          ? "Send a message confirming completion."
          : task.evidenceType === "DOCUMENT"
            ? "Send your document or file when done."
            : "Take a LIVE photo using the camera button and add a short note. Do not upload from gallery.";

    const message =
      `## Check-in due now\n` +
      `${task.name}\n\n` +
      `Scheduled: ${dueLabel} (${task.timezone || "UTC"})\n\n` +
      `**Send your evidence in this chat now** — you can still submit if you have not yet. Submitting **before** the grace period ends after this due time avoids a missed check-in.\n\n` +
      `${evidenceHint}`;

    try {
      const channel = resolveWorkerNotifyChannel(worker, task);
      await sendMessageToWorker(worker, channel, message);
    } catch (err) {
      console.error(`[TaskCron] Failed to send reminder to worker ${worker.id}:`, err);
    }

    await prisma.taskSubmission.update({
      where: { id: sub.id },
      data: { reminderSentAt: now },
    });
  }
}

// ─── 3. Send upcoming (heads-up) reminders ────────────────────────────

async function sendUpcomingReminders() {
  const now = new Date();
  const upcomingWindow = new Date(now.getTime() + UPCOMING_REMINDER_MINUTES * 60 * 1000);

  const upcomingSubmissions = await prisma.taskSubmission.findMany({
    where: {
      status: "PENDING",
      dueAt: { gt: now, lte: upcomingWindow },
      upcomingReminderSentAt: null,
    },
    include: {
      worker: { include: { taskChannel: true } },
      humanTask: { include: { taskChannel: true } },
    },
  });

  for (const sub of upcomingSubmissions) {
    const task = sub.humanTask;
    const worker = sub.worker;
    if (!task || !worker) continue;

    const dueLabel = new Date(sub.dueAt).toLocaleString("en-US", {
      timeZone: task.timezone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    const readyHint =
      task.evidenceType === "PHOTO" || task.evidenceType === "PHOTO_AND_TEXT"
        ? "You can send your live photo **any time from now** until the grace period ends after the due time. **Submit early** if you can so you are done before the deadline and do not risk a missed check-in."
        : "You can send your evidence **any time from now** until the grace period ends after the due time. **Submit early** if you can so you are done before the deadline and do not risk a missed check-in.";

    const headsUp =
      `## Heads-up\n` +
      `Your check-in for *${task.name}* opens in about ${UPCOMING_REMINDER_MINUTES} minutes.\n\n` +
      `**Due time:** ${dueLabel} (${task.timezone || "UTC"})\n\n` +
      `${readyHint}\n\n` +
      `You do **not** need to wait for the next message — submit whenever you are ready.\n\n` +
      `We will also send a **“due now”** reminder at the scheduled time.`;

    try {
      const channel = resolveWorkerNotifyChannel(worker, task);
      await sendMessageToWorker(worker, channel, headsUp);
    } catch (err) {
      console.error(`[TaskCron] Failed to send upcoming reminder to worker ${worker.id}:`, err);
    }

    await prisma.taskSubmission.update({
      where: { id: sub.id },
      data: { upcomingReminderSentAt: now },
    });
  }
}

// ─── 4. Grace period check — mark overdue PENDING as MISSED ──────────

function buildMissedRecordedMessage(
  task: { name: string; timezone?: string | null },
  dueAt: Date
): string {
  const tz = task.timezone || "UTC";
  const dueLabel = new Date(dueAt).toLocaleString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    `## Check-in recorded as missed\n\n` +
    `**${task.name}** — scheduled for **${dueLabel} (${tz})**.\n\n` +
    `No evidence was received before the grace period ended. This check-in is now recorded as **missed** in your manager's report.\n\n` +
    `Next time, try to **submit early** (as soon as you can after the check-in opens) so you finish before the grace period ends.\n\n` +
    `When your next check-in is due, you will get a reminder in this channel.`
  );
}

async function processGraceChecks() {
  const now = new Date();

  const overdue = await prisma.taskSubmission.findMany({
    where: {
      status: "PENDING",
      dueAt: { lt: now },
    },
    include: {
      worker: { include: { taskChannel: true } },
      humanTask: { include: { taskChannel: true } },
    },
  });

  for (const sub of overdue) {
    const task = sub.humanTask;
    if (!task) continue;

    const graceMs = (task.graceMinutes ?? 15) * 60 * 1000;
    const deadline = new Date(new Date(sub.dueAt).getTime() + graceMs);

    if (now < deadline) continue;

    await markMissed(sub.id);

    const message = buildMissedRecordedMessage(task, new Date(sub.dueAt));
    const channel = resolveWorkerNotifyChannel(sub.worker, task);

    if (!channel) {
      console.warn(
        `[TaskCron] No task channel for worker ${sub.worker?.id}; cannot send missed notice for submission ${sub.id}`
      );
      continue;
    }

    try {
      await sendMessageToWorker(sub.worker, channel, message);
    } catch (err) {
      console.error(`[TaskCron] Failed to send missed notice to worker ${sub.worker?.id}:`, err);
    }
  }
}

// ─── Main tick — runs every minute ────────────────────────────────────

async function tick() {
  try {
    await preCreateSubmissions();
    await sendUpcomingReminders();
    await sendDueReminders();
    await processGraceChecks();
    await generateScheduledReports();
  } catch (err) {
    console.error("[TaskCron] Scheduler tick error:", err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────

export function startTaskCronScheduler() {
  if (schedulerJob) return;

  schedulerJob = cron.schedule("* * * * *", () => {
    void tick();
  });

  // Run immediately on startup
  void tick();

  console.log("[TaskCron] Task scheduler started (every 1 minute)");
}

export function stopTaskCronScheduler() {
  if (schedulerJob) {
    schedulerJob.stop();
    schedulerJob = null;
    console.log("[TaskCron] Task scheduler stopped");
  }
}
