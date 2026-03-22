import { basePrismaClient } from "@/lib/prisma";
import { generateTextWithSystemPrompt } from "./agent/agentService";
import { getSubmissionsForReport } from "./taskSubmissionService";
import {
  formatTelegramMessage,
  formatWhatsAppMessage,
  formatSlackMessage,
  formatDiscordMessage,
} from "./chatIntegrationService";
import { sendWhatsAppMessage } from "./whatsappConnectorClient";
import { sendDiscordMessage } from "./discordConnectorClient";
import { executeDeliveryActions, type DeliveryConfig } from "./composioReportDeliveryService";

const prisma = basePrismaClient as any;

export async function generateDailyReport(taskId: string) {
  const task = await prisma.humanTask.findUnique({
    where: { id: taskId },
    include: {
      workers: { where: { status: "ACTIVE" } },
      reportChannel: true,
    },
  });
  if (!task) throw new Error("Task not found");

  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date(now);
  periodEnd.setHours(23, 59, 59, 999);

  const submissions = await getSubmissionsForReport(taskId, periodStart, periodEnd);

  const totalDue = submissions.length;
  const submitted = submissions.filter(
    (s: any) => s.status !== "PENDING" && s.status !== "MISSED"
  ).length;
  const missed = submissions.filter((s: any) => s.status === "MISSED").length;
  const scores = submissions
    .filter((s: any) => s.aiScore != null)
    .map((s: any) => s.aiScore as number);
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : null;
  const passed = submissions.filter((s: any) => s.status === "PASSED").length;
  const passRate = totalDue > 0 ? Math.round((passed / totalDue) * 100) : null;

  const workerMap: Record<
    string,
    { name: string; due: number; submitted: number; missed: number; scores: number[] }
  > = {};
  for (const sub of submissions) {
    const w = (sub as any).worker;
    if (!w) continue;
    if (!workerMap[w.id]) {
      workerMap[w.id] = { name: w.name, due: 0, submitted: 0, missed: 0, scores: [] };
    }
    workerMap[w.id].due++;
    if ((sub as any).status === "MISSED") workerMap[w.id].missed++;
    else if ((sub as any).status !== "PENDING") workerMap[w.id].submitted++;
    if ((sub as any).aiScore != null) workerMap[w.id].scores.push((sub as any).aiScore);
  }

  const flaggedWorkerIds: string[] = [];
  const workerBreakdown = Object.entries(workerMap).map(([id, w]) => {
    const wAvg =
      w.scores.length > 0
        ? Math.round(w.scores.reduce((a, b) => a + b, 0) / w.scores.length)
        : null;
    if (w.missed >= 2 || (wAvg !== null && wAvg < (task.passingScore || 70))) {
      flaggedWorkerIds.push(id);
    }
    return `${w.name}: ${w.submitted}/${w.due} submitted${w.missed > 0 ? ` (${w.missed} missed)` : ""}, avg ${wAvg ?? "N/A"}`;
  });

  const dataForClaude = `Task: ${task.name}\nDate: ${periodStart.toISOString().split("T")[0]}\nTotal Due: ${totalDue}\nSubmitted: ${submitted}\nMissed: ${missed}\nAvg Score: ${avgScore ?? "N/A"}\nPass Rate: ${passRate ?? "N/A"}%\n\nWorker Breakdown:\n${workerBreakdown.join("\n")}\n\nFlagged Workers: ${flaggedWorkerIds.length > 0 ? flaggedWorkerIds.join(", ") : "None"}`;

  const { text: summaryMarkdown } = await generateTextWithSystemPrompt({
    systemPrompt:
      "You are a compliance report writer. Generate a clear, professional daily task compliance report in markdown format. Include a summary, worker breakdown, and any flags or recommendations.",
    userPrompt: dataForClaude,
  });

  const report = await prisma.taskComplianceReport.create({
    data: {
      humanTaskId: taskId,
      periodStart,
      periodEnd,
      summaryMarkdown,
      totalSubmissions: totalDue,
      missedCount: missed,
      avgScore,
      passRate,
      flaggedWorkerIds,
    },
  });

  if (submissions.length > 0) {
    await prisma.taskSubmission.updateMany({
      where: { id: { in: submissions.map((s: any) => s.id) } },
      data: { reportIncluded: true },
    });
  }

  const deliveredTo: Record<string, unknown> = {};
  const deliveryConfig = task.deliveryConfig as DeliveryConfig | null;
  const shouldSendToMessaging = deliveryConfig?.messagingChannel !== false;

  // Deliver to messaging channel if enabled (default: true)
  if (shouldSendToMessaging && task.reportChannel) {
    await deliverTaskReport(summaryMarkdown, task.reportChannel);
    deliveredTo.messagingChannel = {
      channelId: task.reportChannelId,
      platform: task.reportChannel.platform,
    };
  }

  // Execute user-configured Composio delivery actions
  if (deliveryConfig?.composioActions?.length) {
    const dateStr = periodStart.toISOString().split("T")[0];
    const composioResults = await executeDeliveryActions(
      task.userId,
      deliveryConfig,
      `Compliance Report: ${task.name} — ${dateStr}`,
      summaryMarkdown
    );
    if (composioResults.length > 0) {
      deliveredTo.composioActions = composioResults;
    }
  }

  if (Object.keys(deliveredTo).length > 0) {
    await prisma.taskComplianceReport.update({
      where: { id: report.id },
      data: {
        deliveredAt: new Date(),
        deliveredTo,
      },
    });
  }

  return report;
}

async function deliverTaskReport(markdown: string, channel: any) {
  switch (channel.platform) {
    case "WHATSAPP": {
      const formatted = formatWhatsAppMessage(markdown);
      if (channel.whatsappSessionId) {
        await sendWhatsAppMessage({
          sessionRef: channel.whatsappSessionId,
          toJid: channel.telegramChatId || "",
          text: formatted,
        });
      }
      break;
    }
    case "TELEGRAM": {
      const formatted = formatTelegramMessage(markdown);
      if (channel.telegramBotToken && channel.telegramChatId) {
        await fetch(`https://api.telegram.org/bot${channel.telegramBotToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: channel.telegramChatId,
            text: formatted,
            parse_mode: "HTML",
          }),
        });
      }
      break;
    }
    case "SLACK": {
      const formatted = formatSlackMessage(markdown);
      if (channel.slackBotToken && channel.slackChannelId) {
        await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channel.slackBotToken}`,
          },
          body: JSON.stringify({
            channel: channel.slackChannelId,
            text: formatted,
          }),
        });
      }
      break;
    }
    case "DISCORD": {
      const formatted = formatDiscordMessage(markdown);
      if (channel.discordChannelId) {
        await sendDiscordMessage({
          integrationId: channel.id,
          channelId: channel.discordChannelId,
          text: formatted,
        });
      }
      break;
    }
  }
}

export async function listReports(taskId: string) {
  return prisma.taskComplianceReport.findMany({
    where: { humanTaskId: taskId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getReport(reportId: string) {
  return prisma.taskComplianceReport.findUnique({
    where: { id: reportId },
  });
}
