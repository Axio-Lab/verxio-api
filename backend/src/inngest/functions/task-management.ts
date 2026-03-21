import { inngest } from "../index";
import { NonRetriableError } from "inngest";
import { basePrismaClient } from "@/lib/prisma";
import { createPendingSubmission, markMissed } from "@/services/taskSubmissionService";
import { generateDailyReport } from "@/services/taskReportService";
import { scheduleGracePeriodCheck } from "@/services/taskSchedulerService";
import {
  formatTelegramMessage,
  formatWhatsAppMessage,
  formatSlackMessage,
  formatDiscordMessage,
} from "@/services/chatIntegrationService";
import { sendWhatsAppMessage } from "@/services/whatsappConnectorClient";
import { sendDiscordMessage } from "@/services/discordConnectorClient";

const prisma = basePrismaClient as any;

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
        await fetch(
          `https://api.telegram.org/bot${channel.telegramBotToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: worker.externalId,
              text: formatted,
              parse_mode: "HTML",
            }),
          }
        );
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
          workers: {
            where: { status: { in: ["ACTIVE", "ONBOARDING"] } },
            include: { supportChannel: true },
          },
        },
      });
    });

    if (!task || task.status !== "ACTIVE") return;

    const dueDate = new Date(dueAt);

    for (const worker of task.workers) {
      await step.run(`remind-${worker.id}`, async () => {
        const submission = await createPendingSubmission(taskId, worker.id, dueDate);

        const evidenceHint =
          task.evidenceType === "PHOTO"
            ? "Send a photo when done."
            : task.evidenceType === "TEXT"
              ? "Send a message confirming completion."
              : "Send a photo and message when done.";

        const message = `${task.name} is due now.\n\nPlease complete the task and send your evidence here.\n${evidenceHint}`;

        await sendMessageToWorker(worker, worker.supportChannel, message);

        await scheduleGracePeriodCheck(submission.id, dueDate, task.graceMinutes || 15);
      });
    }
  }
);

export const taskGraceCheck = inngest.createFunction(
  { id: "task-grace-check", name: "Task Grace Period Check" },
  { event: "verxio/task.grace-check" },
  async ({ event, step }) => {
    const { submissionId } = event.data;

    await step.sleep("wait-for-grace", event.data.checkAt ? `${Math.max(0, new Date(event.data.checkAt).getTime() - Date.now())}ms` : "15m");

    await step.run("check-submission", async () => {
      const submission = await prisma.taskSubmission.findUnique({
        where: { id: submissionId },
        include: {
          worker: { include: { supportChannel: true } },
          humanTask: true,
        },
      });

      if (!submission || submission.status !== "PENDING") return;

      await markMissed(submissionId);

      const dueTime = new Date(submission.dueAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const message = `${submission.humanTask.name} was due at ${dueTime} and hasn't been submitted yet.\n\nPlease complete it as soon as possible and send your evidence.`;

      await sendMessageToWorker(
        submission.worker,
        submission.worker.supportChannel,
        message
      );
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
