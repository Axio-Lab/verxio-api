import { basePrismaClient } from "@/lib/prisma";
import { AppError } from "@/middleware/errorHandler";
import { connectDiscordBot, disconnectDiscordBot } from "@/services/discordConnectorClient";
import { stopWhatsAppSession } from "@/services/whatsappConnectorClient";

const prisma = basePrismaClient as any;

export function getApiBaseUrl(): string {
  const base = process.env.API_URL?.trim();
  if (!base) throw new Error("API_URL is required for task channel webhooks.");
  return base.replace(/\/$/, "");
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listTaskChannels(userId: string) {
  return prisma.taskChannel.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTaskChannel(userId: string, id: string) {
  const ch = await prisma.taskChannel.findUnique({ where: { id } });
  if (!ch || ch.userId !== userId) throw new AppError("Task channel not found", 404);
  return ch;
}

export async function getTaskChannelInternal(id: string) {
  return prisma.taskChannel.findUnique({ where: { id } });
}

export async function updateTaskChannel(
  userId: string,
  id: string,
  data: { label?: string; status?: string }
) {
  const ch = await getTaskChannel(userId, id);
  const payload: Record<string, unknown> = {};
  if (data.label !== undefined) {
    const nextLabel = data.label.trim();
    if (!nextLabel) throw new AppError("Label is required", 400);
    if (nextLabel !== ch.label) {
      const dup = await prisma.taskChannel.findFirst({
        where: { userId, label: nextLabel, NOT: { id: ch.id } },
      });
      if (dup) throw new AppError("A task channel with this label already exists.", 400);
    }
    payload.label = nextLabel;
  }
  if (data.status !== undefined) payload.status = data.status;
  return prisma.taskChannel.update({ where: { id: ch.id }, data: payload });
}

export async function createTaskChannel(userId: string, platform: string, label?: string) {
  const trimmed = (label ?? "").trim();
  if (!trimmed) {
    throw new AppError("Label is required", 400);
  }
  const dup = await prisma.taskChannel.findFirst({
    where: { userId, label: trimmed },
  });
  if (dup) {
    throw new AppError("A task channel with this label already exists.", 400);
  }
  return prisma.taskChannel.create({
    data: {
      userId,
      platform,
      label: trimmed,
      status: "pending",
      sharedSecret: crypto.randomUUID(),
    },
  });
}

/**
 * Clear platform credentials and external sessions so the user can connect again.
 * Does not delete the task channel row.
 */
export async function disconnectTaskChannel(userId: string, id: string) {
  const ch = await getTaskChannel(userId, id);

  if (ch.platform === "TELEGRAM" && ch.telegramBotToken) {
    try {
      await fetch(`https://api.telegram.org/bot${ch.telegramBotToken}/deleteWebhook`);
    } catch {}
  }

  if (ch.platform === "WHATSAPP" && ch.whatsappSessionId) {
    try {
      await stopWhatsAppSession(ch.whatsappSessionId);
    } catch {}
    try {
      await prisma.whatsAppSession.update({
        where: { id: ch.whatsappSessionId },
        data: { status: "disconnected", authState: null, phoneNumber: null, workerId: null },
      });
    } catch {}
  }

  if (ch.platform === "DISCORD" && ch.discordBotToken) {
    try {
      await disconnectDiscordBot(ch.id);
    } catch {}
  }

  const data: Record<string, unknown> = {
    status: "pending",
    webhookUrl: null,
  };

  if (ch.platform === "TELEGRAM") {
    data.telegramBotToken = null;
    data.telegramBotUsername = null;
  }
  if (ch.platform === "WHATSAPP") {
    data.whatsappSessionId = null;
  }
  if (ch.platform === "SLACK") {
    data.slackBotToken = null;
    data.slackSigningSecret = null;
    data.slackTeamId = null;
  }
  if (ch.platform === "DISCORD") {
    data.discordBotToken = null;
    data.discordGuildId = null;
    data.discordChannelId = null;
  }

  return prisma.taskChannel.update({
    where: { id: ch.id },
    data: data as any,
  });
}

export async function deleteTaskChannel(userId: string, id: string) {
  const ch = await getTaskChannel(userId, id);

  if (ch.platform === "TELEGRAM" && ch.telegramBotToken) {
    try {
      await fetch(`https://api.telegram.org/bot${ch.telegramBotToken}/deleteWebhook`);
    } catch {}
  }

  if (ch.platform === "WHATSAPP" && ch.whatsappSessionId) {
    try {
      await stopWhatsAppSession(ch.whatsappSessionId);
    } catch {}
    try {
      await prisma.whatsAppSession.update({
        where: { id: ch.whatsappSessionId },
        data: { status: "disconnected", authState: null, phoneNumber: null, workerId: null },
      });
    } catch {}
  }

  if (ch.platform === "DISCORD" && ch.discordBotToken) {
    try {
      await disconnectDiscordBot(ch.id);
    } catch {}
  }

  return prisma.taskChannel.delete({ where: { id: ch.id } });
}

// ---------------------------------------------------------------------------
// Telegram connect
// ---------------------------------------------------------------------------

export async function connectTelegram(userId: string, channelId: string, botToken: string) {
  const ch = await getTaskChannel(userId, channelId);
  if (ch.platform !== "TELEGRAM") throw new Error("Channel is not Telegram");

  const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
  const me = await meRes.json().catch(() => ({}));
  if (!meRes.ok || !me?.ok) {
    throw new Error("Invalid Telegram bot token. Check the token from @BotFather.");
  }

  const webhookUrl = `${getApiBaseUrl()}/api/internal/task-channels/telegram/${ch.id}`;
  if (!webhookUrl.startsWith("https://")) {
    throw new Error("Telegram requires an HTTPS webhook URL. Set API_URL to a public HTTPS address.");
  }

  const secret = ch.sharedSecret || crypto.randomUUID();

  const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, secret_token: secret }),
  });
  const setData = await setRes.json().catch(() => ({}));
  if (!setRes.ok || !setData?.ok) {
    throw new Error(`Telegram webhook setup failed: ${setData?.description || "unknown"}`);
  }

  return prisma.taskChannel.update({
    where: { id: ch.id },
    data: {
      telegramBotToken: botToken,
      telegramBotUsername: me?.result?.username ?? null,
      webhookUrl,
      sharedSecret: secret,
      status: "connected",
    },
  });
}

// ---------------------------------------------------------------------------
// WhatsApp connect
// ---------------------------------------------------------------------------

export async function connectWhatsApp(userId: string, channelId: string) {
  const ch = await getTaskChannel(userId, channelId);
  if (ch.platform !== "WHATSAPP") throw new Error("Channel is not WhatsApp");

  let session;
  if (ch.whatsappSessionId) {
    session = await prisma.whatsAppSession.findUnique({ where: { id: ch.whatsappSessionId } });
  }
  if (!session) {
    session = await prisma.whatsAppSession.create({ data: {} });
    await prisma.taskChannel.update({
      where: { id: ch.id },
      data: { whatsappSessionId: session.id },
    });
  }
  return { channel: ch, session };
}

// ---------------------------------------------------------------------------
// Slack connect
// ---------------------------------------------------------------------------

export async function connectSlack(
  userId: string,
  channelId: string,
  slackBotToken: string,
  slackSigningSecret: string
) {
  const ch = await getTaskChannel(userId, channelId);
  if (ch.platform !== "SLACK") throw new Error("Channel is not Slack");

  const authTestRes = await fetch("https://slack.com/api/auth.test", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${slackBotToken.trim()}`,
    },
  });
  const authTest = (await authTestRes.json().catch(() => ({}))) as any;
  if (!authTestRes.ok || !authTest?.ok) {
    throw new Error("Invalid Slack bot token.");
  }

  const eventsWebhookUrl = `${getApiBaseUrl()}/api/internal/task-channels/slack/${ch.id}/events`;

  const updated = await prisma.taskChannel.update({
    where: { id: ch.id },
    data: {
      slackBotToken: slackBotToken.trim(),
      slackSigningSecret: slackSigningSecret.trim(),
      slackTeamId: authTest.team_id || null,
      webhookUrl: eventsWebhookUrl,
      status: "connected",
    },
  });

  return { channel: updated, teamId: authTest.team_id || null, webhookUrl: eventsWebhookUrl };
}

// ---------------------------------------------------------------------------
// Discord connect
// ---------------------------------------------------------------------------

export async function connectDiscord(
  userId: string,
  channelId: string,
  discordBotToken: string,
  discordGuildId?: string,
  discordChannelId?: string
) {
  const ch = await getTaskChannel(userId, channelId);
  if (ch.platform !== "DISCORD") throw new Error("Channel is not Discord");

  const token = discordBotToken.trim();
  const meRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bot ${token}` },
  });
  const me = (await meRes.json().catch(() => ({}))) as any;
  if (!meRes.ok || !me?.id) {
    throw new Error("Invalid Discord bot token.");
  }

  const connector = await connectDiscordBot(ch.id, token);
  if (!connector.success) {
    throw new Error(connector.error || "Failed to connect Discord bot.");
  }

  const updated = await prisma.taskChannel.update({
    where: { id: ch.id },
    data: {
      discordBotToken: token,
      discordGuildId: discordGuildId?.trim() || null,
      discordChannelId: discordChannelId?.trim() || null,
      status: "connected",
    },
  });

  return { channel: updated, botUserId: me.id };
}

// ---------------------------------------------------------------------------
// Helpers for listing active channels for task creation dropdown
// ---------------------------------------------------------------------------

export async function listActiveTaskChannels(userId: string) {
  const channels = await prisma.taskChannel.findMany({
    // Only channels that finished setup (Telegram/WhatsApp/Slack/Discord connected). Exclude pending and disabled.
    where: { userId, status: "connected" },
    orderBy: { createdAt: "desc" },
  });

  return channels.map((ch: any) => ({
    id: ch.id,
    platform: ch.platform,
    label: ch.label || `${ch.platform} Task Channel`,
    source: "task_channel" as const,
    status: ch.status,
  }));
}
