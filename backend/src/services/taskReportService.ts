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
import {
  deliverToDestinations,
  createReportDocument,
  type DeliveryConfig,
} from "./composioReportDeliveryService";
import {
  executeComposioAction,
  isComposioConfigured,
} from "./composio/composioService";

const prisma = basePrismaClient as any;

// ─── Google Drive folder helper ─────────────────────────────────────────

async function ensureReportFolder(
  userId: string,
  task: any
): Promise<string | null> {
  if (task.reportFolderId) return task.reportFolderId;

  const deliveryConfig = task.deliveryConfig as DeliveryConfig | null;
  if (deliveryConfig?.reportFolderId) {
    await prisma.humanTask.update({
      where: { id: task.id },
      data: { reportFolderId: deliveryConfig.reportFolderId },
    });
    return deliveryConfig.reportFolderId;
  }

  if (!isComposioConfigured()) return null;

  try {
    const result = await executeComposioAction(
      userId,
      "GOOGLEDRIVE_CREATE_FOLDER",
      { name: `Reports - ${task.name}` }
    );
    const parsed = result as any;
    const folderId =
      parsed?.id ||
      parsed?.data?.id ||
      parsed?.response_data?.id ||
      parsed?.folderId ||
      parsed?.data?.folderId;

    if (folderId) {
      await prisma.humanTask.update({
        where: { id: task.id },
        data: { reportFolderId: folderId },
      });
      return folderId;
    }
  } catch (err: any) {
    console.error(
      `[ReportService] Failed to create Google Drive folder for task ${task.id}:`,
      err.message
    );
  }
  return null;
}

// ─── WhatsApp destination delivery (native connector) ───────────────────

async function sendWhatsAppReport(
  whatsappNumber: string,
  summary: string,
  docUrl: string | null,
  task: any
) {
  const channel = task.reportChannel;
  if (!channel?.whatsappSessionId) {
    console.warn("[ReportService] No WhatsApp session for task channel; skipping WhatsApp delivery");
    return;
  }

  let message = formatWhatsAppMessage(`*Daily Report: ${task.name}*\n\n${summary}`);
  if (docUrl) {
    message += `\n\n📄 Full Report: ${docUrl}`;
  }

  const jid = whatsappNumber.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
  await sendWhatsAppMessage({
    sessionRef: channel.whatsappSessionId,
    toJid: jid,
    text: message,
  });
}

// ─── Main report generation ────────────────────────────────────────────

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

  const submissions = await getSubmissionsForReport(
    taskId,
    periodStart,
    periodEnd
  );

  const totalDue = submissions.length;
  const submitted = submissions.filter(
    (s: any) => s.status !== "PENDING" && s.status !== "MISSED"
  ).length;
  const missed = submissions.filter(
    (s: any) => s.status === "MISSED"
  ).length;
  const scores = submissions
    .filter((s: any) => s.aiScore != null)
    .map((s: any) => s.aiScore as number);
  const avgScore =
    scores.length > 0
      ? Math.round(
          scores.reduce((a: number, b: number) => a + b, 0) / scores.length
        )
      : null;
  const passed = submissions.filter(
    (s: any) => s.status === "PASSED"
  ).length;
  const passRate =
    totalDue > 0 ? Math.round((passed / totalDue) * 100) : null;

  const workerMap: Record<
    string,
    {
      name: string;
      due: number;
      submitted: number;
      missed: number;
      scores: number[];
    }
  > = {};
  for (const sub of submissions) {
    const w = (sub as any).worker;
    if (!w) continue;
    if (!workerMap[w.id]) {
      workerMap[w.id] = {
        name: w.name,
        due: 0,
        submitted: 0,
        missed: 0,
        scores: [],
      };
    }
    workerMap[w.id].due++;
    if ((sub as any).status === "MISSED") workerMap[w.id].missed++;
    else if ((sub as any).status !== "PENDING") workerMap[w.id].submitted++;
    if ((sub as any).aiScore != null)
      workerMap[w.id].scores.push((sub as any).aiScore);
  }

  const flaggedWorkerIds: string[] = [];
  const workerBreakdown = Object.entries(workerMap).map(([id, w]) => {
    const wAvg =
      w.scores.length > 0
        ? Math.round(w.scores.reduce((a, b) => a + b, 0) / w.scores.length)
        : null;
    if (
      w.missed >= 2 ||
      (wAvg !== null && wAvg < (task.passingScore || 70))
    ) {
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

  // ── Delivery ─────────────────────────────────────────────────────────

  const deliveredTo: Record<string, unknown> = {};
  const deliveryConfig = task.deliveryConfig as DeliveryConfig | null;
  const shouldSendToMessaging = deliveryConfig?.messagingChannel !== false;
  const docType = deliveryConfig?.reportDocType || "googledocs";
  const dateStr = periodStart.toISOString().split("T")[0];
  const docTitle = `Compliance Report: ${task.name} — ${dateStr}`;

  // 1. Create report document (Google Docs or Notion) via Composio
  let documentUrl: string | null = null;
  if (isComposioConfigured()) {
    const folderId =
      docType === "googledocs"
        ? await ensureReportFolder(task.userId, task)
        : null;

    documentUrl = await createReportDocument(
      task.userId,
      docType,
      docTitle,
      summaryMarkdown,
      folderId
    );

    if (documentUrl) {
      await prisma.taskComplianceReport.update({
        where: { id: report.id },
        data: { documentUrl },
      });
      deliveredTo.document = {
        type: docType,
        url: documentUrl,
        ...(folderId ? { folderId } : {}),
      };
    }
  }

  // 2. Deliver to task notification channel
  if (shouldSendToMessaging && task.reportChannel) {
    let channelMessage = summaryMarkdown;
    if (documentUrl) {
      channelMessage += `\n\n📄 Full Report: ${documentUrl}`;
    }
    await deliverTaskReport(channelMessage, task.reportChannel);
    deliveredTo.messagingChannel = {
      channelId: task.reportChannelId,
      platform: task.reportChannel.platform,
    };
  }

  // 3. Deliver to configured destinations (summary + doc link)
  const destinations = deliveryConfig?.destinations?.filter((d) => d.enabled) || [];

  // WhatsApp destinations (native connector)
  for (const dest of destinations) {
    if (dest.type === "whatsapp" && dest.whatsappNumber) {
      try {
        await sendWhatsAppReport(
          dest.whatsappNumber,
          summaryMarkdown,
          documentUrl,
          task
        );
        deliveredTo.whatsapp = { number: dest.whatsappNumber };
      } catch (err: any) {
        console.error("[ReportService] WhatsApp delivery failed:", err.message);
      }
    }
  }

  // Composio destinations (Telegram, Slack, Discord)
  const composioDestinations = destinations.filter(
    (d) => d.type !== "whatsapp"
  );
  if (composioDestinations.length > 0) {
    let summaryWithLink = summaryMarkdown;
    if (documentUrl) {
      summaryWithLink += `\n\n📄 Full Report: ${documentUrl}`;
    }

    const composioResults = await deliverToDestinations(
      task.userId,
      composioDestinations,
      docTitle,
      summaryWithLink
    );
    if (composioResults.length > 0) {
      deliveredTo.destinations = composioResults;
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
        await fetch(
          `https://api.telegram.org/bot${channel.telegramBotToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: channel.telegramChatId,
              text: formatted,
              parse_mode: "HTML",
            }),
          }
        );
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

// ─── Scheduled report generation ───────────────────────────────────────

export async function generateScheduledReports() {
  const now = new Date();

  const activeTasks = await prisma.humanTask.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      reportTime: true,
      timezone: true,
    },
  });

  for (const task of activeTasks) {
    if (!task.reportTime) continue;

    const tz = task.timezone || "UTC";
    const [rh, rm] = String(task.reportTime).split(":").map(Number);
    if (Number.isNaN(rh) || Number.isNaN(rm)) continue;

    const nowInTz = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const nowHour = Number(
      nowInTz.find((p) => p.type === "hour")?.value || 0
    );
    const nowMin = Number(
      nowInTz.find((p) => p.type === "minute")?.value || 0
    );

    if (nowHour !== rh || Math.abs(nowMin - rm) > 1) continue;

    const todayStr = now.toISOString().split("T")[0];
    const existing = await prisma.taskComplianceReport.findFirst({
      where: {
        humanTaskId: task.id,
        createdAt: {
          gte: new Date(`${todayStr}T00:00:00.000Z`),
        },
      },
    });
    if (existing) continue;

    try {
      console.log(
        `[ReportScheduler] Generating daily report for task ${task.id}`
      );
      await generateDailyReport(task.id);
    } catch (err: any) {
      console.error(
        `[ReportScheduler] Failed to generate report for task ${task.id}:`,
        err.message
      );
    }
  }
}

// ─── CRUD ──────────────────────────────────────────────────────────────

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

export async function deleteReport(reportId: string) {
  return prisma.taskComplianceReport.delete({
    where: { id: reportId },
  });
}
