import { inngest } from "../index";
import { NonRetriableError } from "inngest";
import { basePrismaClient } from "@/lib/prisma";
import { createPendingSubmission, markMissed } from "@/services/taskSubmissionService";
import { generateDailyReport } from "@/services/taskReportService";
import {
  scheduleGracePeriodCheck,
  scheduleAllActiveTaskReminders,
} from "@/services/taskSchedulerService";
import {
  formatTelegramMessage,
  formatWhatsAppMessage,
  formatSlackMessage,
  formatDiscordMessage,
} from "@/services/chatIntegrationService";
import { sendWhatsAppMessage } from "@/services/whatsappConnectorClient";
import { sendDiscordMessage } from "@/services/discordConnectorClient";
import { resolveWorkerNotifyChannel } from "@/services/humanWorkerService";

const prisma = basePrismaClient as any;

/** Minutes before due time to send a heads-up (no submission created yet). */
const UPCOMING_REMINDER_MINUTES = 30;

async function sendMessageToWorker(worker: any, channel: any, message: string) {
  if (!channel) return;

  switch (worker.platform) {
    case "WHATSAPP": {
      const formatted = formatWhatsAppMessage(message);
      if (channel.whatsappSessionId) {
        await sendWhatsAppMessage({
          sessionRef: channel.whatsappSessionId,
          toJid: worker.externalId,
          text: formatted,
        });
      }
      break;
    }
    case "TELEGRAM": {
      const formatted = formatTelegramMessage(message);
      if (channel.telegramBotToken) {
        await fetch(`https://api.telegram.org/bot${channel.telegramBotToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: worker.externalId,
            text: formatted,
            parse_mode: "HTML",
          }),
        });
      }
      break;
    }
    case "SLACK": {
      const formatted = formatSlackMessage(message);
      if (channel.slackBotToken) {
        await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channel.slackBotToken}`,
          },
          body: JSON.stringify({
            channel: worker.externalId,
            text: formatted,
          }),
        });
      }
      break;
    }
    case "DISCORD": {
      const formatted = formatDiscordMessage(message);
      if (channel.discordBotToken) {
        await sendDiscordMessage({
          integrationId: channel.id,
          channelId: worker.externalId,
          text: formatted,
        });
      }
      break;
    }
  }
}

export const taskReminder = inngest.createFunction(
  { id: "task-reminder", name: "Task Reminder" },
  { event: "verxio/task.reminder" },
  async ({ event, step }) => {
    const { taskId, dueAt } = event.data;

    const task = await step.run("load-task", async () => {
      return prisma.humanTask.findUnique({
        where: { id: taskId },
        include: {
          taskChannel: true,
          workers: {
            where: { status: { in: ["ACTIVE", "ONBOARDING"] } },
            include: { taskChannel: true },
          },
        },
      });
    });

    if (!task || task.status !== "ACTIVE") return;

    const dueDate = new Date(dueAt);
    const dueLabel = dueDate.toLocaleString("en-US", {
      timeZone: task.timezone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    for (const worker of task.workers) {
      await step.run(`remind-${worker.id}`, async () => {
        const submission = await createPendingSubmission(taskId, worker.id, dueDate);

        const evidenceHint =
          task.evidenceType === "PHOTO"
            ? "Send a photo when done."
            : task.evidenceType === "TEXT"
              ? "Send a message confirming completion."
              : task.evidenceType === "DOCUMENT"
                ? "Send your document or file when done."
                : "Send a photo and message when done.";

        const message =
          `## Check-in due now\n` +
          `${task.name}\n\n` +
          `Scheduled: ${dueLabel} (${task.timezone || "UTC"})\n\n` +
          `Please complete the task and send your evidence in this chat.\n${evidenceHint}`;

        const channel = resolveWorkerNotifyChannel(worker, task);
        await sendMessageToWorker(worker, channel, message);

        await scheduleGracePeriodCheck(submission.id, dueDate, task.graceMinutes || 15);
      });
    }
  }
);

export const taskUpcomingReminder = inngest.createFunction(
  { id: "task-upcoming-reminder", name: "Task Upcoming Reminder" },
  { event: "verxio/task.upcoming-reminder" },
  async ({ event, step }) => {
    const { taskId, dueAt } = event.data;
    const dueDate = new Date(dueAt);
    const upcomingAt = new Date(dueDate.getTime() - UPCOMING_REMINDER_MINUTES * 60 * 1000);
    const now = new Date();

    if (upcomingAt > now) {
      await step.sleepUntil("wait-until-upcoming", upcomingAt);
    } else {
      return;
    }

    const task = await step.run("load-task-upcoming", async () => {
      return prisma.humanTask.findUnique({
        where: { id: taskId },
        include: {
          taskChannel: true,
          workers: {
            where: { status: { in: ["ACTIVE", "ONBOARDING"] } },
            include: { taskChannel: true },
          },
        },
      });
    });

    if (!task || task.status !== "ACTIVE") return;

    const dueLabel = dueDate.toLocaleString("en-US", {
      timeZone: task.timezone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    const headsUp =
      `## Heads-up\n` +
      `Your check-in for *${task.name}* is due in about ${UPCOMING_REMINDER_MINUTES} minutes.\n\n` +
      `Due: ${dueLabel} (${task.timezone || "UTC"})\n\n` +
      `Get your evidence ready. You will get another message when it is time to submit.`;

    for (const worker of task.workers) {
      await step.run(`upcoming-${worker.id}`, async () => {
        const channel = resolveWorkerNotifyChannel(worker, task);
        await sendMessageToWorker(worker, channel, headsUp);
      });
    }
  }
);

export const taskGraceCheck = inngest.createFunction(
  { id: "task-grace-check", name: "Task Grace Period Check" },
  { event: "verxio/task.grace-check" },
  async ({ event, step }) => {
    const { submissionId } = event.data;

    await step.sleep(
      "wait-for-grace",
      event.data.checkAt
        ? `${Math.max(0, new Date(event.data.checkAt).getTime() - Date.now())}ms`
        : "15m"
    );

    await step.run("check-submission", async () => {
      const submission = await prisma.taskSubmission.findUnique({
        where: { id: submissionId },
        include: {
          worker: { include: { taskChannel: true } },
          humanTask: { include: { taskChannel: true } },
        },
      });

      if (!submission || submission.status !== "PENDING") return;

      await markMissed(submissionId);

      const dueTime = new Date(submission.dueAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const message = `${submission.humanTask.name} was due at ${dueTime} and hasn't been submitted yet.\n\nPlease complete it as soon as possible and send your evidence.`;

      const channel = resolveWorkerNotifyChannel(submission.worker, submission.humanTask);
      await sendMessageToWorker(submission.worker, channel, message);
    });
  }
);

export const taskDailyReport = inngest.createFunction(
  { id: "task-daily-report", name: "Task Daily Report" },
  { event: "verxio/task.daily-report" },
  async ({ event, step }) => {
    const { taskId } = event.data;

    await step.run("generate-report", async () => {
      await generateDailyReport(taskId);
    });
  }
);

/**
 * Runs every 30 minutes to (re-)schedule upcoming task reminders.
 * Ensures reminders survive server restarts and cover all recurrence types.
 */
export const taskSchedulerCron = inngest.createFunction(
  { id: "task-scheduler-cron", name: "Task Scheduler Cron" },
  { cron: "*/30 * * * *" },
  async ({ step }) => {
    await step.run("schedule-reminders", async () => {
      await scheduleAllActiveTaskReminders();
    });
  }
);
