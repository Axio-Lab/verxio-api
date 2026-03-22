import { basePrismaClient } from "@/lib/prisma";
import { generateTextWithSystemPrompt } from "./agent/agentService";
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

export async function generateProgressReport(goalId: string): Promise<string> {
  const goal = await prisma.agentGoal.findUnique({
    where: { id: goalId },
    include: {
      tasks: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!goal) throw new Error("Goal not found");

  const total = goal.tasks.length;
  const complete = goal.tasks.filter((t: any) => t.status === "COMPLETE").length;
  const failed = goal.tasks.filter((t: any) => t.status === "FAILED").length;
  const inProgress = goal.tasks.filter((t: any) => t.status === "IN_PROGRESS").length;
  const pending = goal.tasks.filter((t: any) => t.status === "PENDING").length;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  const taskSummary = goal.tasks
    .map(
      (t: any) =>
        `- ${t.title} [${t.status}]${t.blockerReason ? ` (blocker: ${t.blockerReason})` : ""}${t.output ? ` output preview: ${JSON.stringify(t.output).slice(0, 200)}` : ""}`
    )
    .join("\n");

  const { text } = await generateTextWithSystemPrompt({
    systemPrompt:
      "You are a concise project status reporter. Generate a clear, structured progress report for a business owner. Use markdown headings and bullet points. Be factual and actionable.",
    userPrompt: `Goal: ${goal.name}\nObjective: ${goal.objective}\nStatus: ${goal.status}\nCompletion: ${pct}% (${complete}/${total} tasks)\nIn Progress: ${inProgress}, Pending: ${pending}, Failed: ${failed}\n\nTask Breakdown:\n${taskSummary}\n\nGenerate a progress report suitable for a business owner.`,
  });

  return text;
}

export async function deliverReport(goalId: string, channelId?: string) {
  const goal = await prisma.agentGoal.findUnique({
    where: { id: goalId },
    include: { reportingChannel: true },
  });
  if (!goal) throw new Error("Goal not found");

  const reportMarkdown = await generateProgressReport(goalId);
  const deliveredTo: Record<string, unknown> = {};

  const deliveryConfig = goal.deliveryConfig as DeliveryConfig | null;
  const shouldSendToMessaging = deliveryConfig?.messagingChannel !== false;

  // Deliver to messaging channel if enabled (default: true)
  const targetChannelId = channelId || goal.reportingChannelId;
  if (shouldSendToMessaging && targetChannelId) {
    const channel = await prisma.supportChannel.findUnique({
      where: { id: targetChannelId },
    });
    if (channel) {
      await sendToMessagingChannel(reportMarkdown, channel, targetChannelId);
      deliveredTo.messagingChannel = { platform: channel.platform, channelId: targetChannelId };
    }
  }

  // Execute user-configured Composio delivery actions
  if (deliveryConfig?.composioActions?.length) {
    const dateStr = new Date().toISOString().split("T")[0];
    const composioResults = await executeDeliveryActions(
      goal.userId,
      deliveryConfig,
      `Goal Report: ${goal.name} — ${dateStr}`,
      reportMarkdown
    );
    if (composioResults.length > 0) {
      deliveredTo.composioActions = composioResults;
    }
  }

  const hasDelivered = Object.keys(deliveredTo).length > 0;
  return {
    delivered: hasDelivered,
    ...(hasDelivered ? deliveredTo : { reason: "No delivery channels configured" }),
  };
}

async function sendToMessagingChannel(markdown: string, channel: any, channelId: string) {
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
          integrationId: channelId,
          channelId: channel.discordChannelId,
          text: formatted,
        });
      }
      break;
    }
  }
}
