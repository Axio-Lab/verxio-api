import { basePrismaClient } from "@/lib/prisma";

const prisma = basePrismaClient as any;

export type SupportChannelPlatform = "WHATSAPP" | "TELEGRAM" | "SLACK" | "DISCORD";

export interface SupportChannel {
  id: string;
  userId: string;
  supportAgentId: string;
  platform: SupportChannelPlatform;
  status: string;
  whatsappSessionId: string | null;
  telegramBotToken?: string | null;
  telegramChatId?: string | null;
  slackBotToken?: string | null;
  slackSigningSecret?: string | null;
  slackTeamId?: string | null;
  slackChannelId?: string | null;
  discordBotToken?: string | null;
  discordGuildId?: string | null;
  discordChannelId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function listSupportChannelsForAgent(userId: string, supportAgentId: string) {
  return prisma.supportChannel.findMany({
    where: {
      userId,
      supportAgentId,
    },
    orderBy: { createdAt: "desc" },
  }) as Promise<SupportChannel[]>;
}

export async function createSupportChannel(options: {
  userId: string;
  supportAgentId: string;
  platform: SupportChannelPlatform;
  status?: string;
}) {
  const { userId, supportAgentId, platform, status } = options;

  const agent = await prisma.supportAgent.findUnique({ where: { id: supportAgentId } });
  if (!agent || agent.userId !== userId) {
    throw new Error("Support agent not found");
  }

  const channel = await prisma.supportChannel.create({
    data: {
      userId,
      supportAgentId,
      platform,
      status: status ?? "pending",
    },
  });

  return channel as SupportChannel;
}

export async function getSupportChannelById(userId: string, id: string) {
  const channel = await prisma.supportChannel.findUnique({ where: { id } });
  if (!channel || channel.userId !== userId) {
    throw new Error("Support channel not found");
  }
  return channel as SupportChannel;
}

export async function getSupportChannelByIdInternal(id: string) {
  const channel = await prisma.supportChannel.findUnique({ where: { id } });
  return (channel || null) as SupportChannel | null;
}

export async function getSupportChannelByWhatsAppSession(sessionId: string) {
  if (!sessionId) return null;
  const channel = await prisma.supportChannel.findFirst({
    where: {
      whatsappSessionId: sessionId,
      status: "connected",
    },
  });
  return (channel || null) as SupportChannel | null;
}

export async function attachWhatsAppSessionToChannel(options: {
  userId: string;
  supportChannelId: string;
  whatsappSessionId: string;
}) {
  const { userId, supportChannelId, whatsappSessionId } = options;
  const channel = await prisma.supportChannel.findUnique({ where: { id: supportChannelId } });
  if (!channel || channel.userId !== userId) {
    throw new Error("Support channel not found");
  }

  return (await prisma.supportChannel.update({
    where: { id: supportChannelId },
    data: {
      whatsappSessionId,
    },
  })) as SupportChannel;
}

export async function getOrCreateWhatsAppSessionForSupportChannel(supportChannelId: string) {
  const channel = await prisma.supportChannel.findUnique({
    where: { id: supportChannelId },
    include: { whatsappSession: true },
  });
  if (!channel) {
    throw new Error("Support channel not found");
  }

  if (channel.whatsappSession) {
    return channel.whatsappSession as { id: string };
  }

  // Create a standalone WhatsAppSession not tied to a chat integration or credential.
  const session = await prisma.whatsAppSession.create({
    data: {
      status: "disconnected",
    },
  });

  await prisma.supportChannel.update({
    where: { id: supportChannelId },
    data: { whatsappSessionId: session.id },
  });

  return session as { id: string };
}

export async function updateSupportChannelConfig(
  userId: string,
  channelId: string,
  data: Partial<SupportChannel>
) {
  const channel = await prisma.supportChannel.findUnique({ where: { id: channelId } });
  if (!channel || channel.userId !== userId) {
    throw new Error("Support channel not found");
  }

  const updated = await prisma.supportChannel.update({
    where: { id: channelId },
    data,
  });
  return updated as SupportChannel;
}

export async function updateSupportChannelConfigInternal(
  channelId: string,
  data: Partial<SupportChannel>
) {
  const channel = await prisma.supportChannel.findUnique({ where: { id: channelId } });
  if (!channel) {
    throw new Error("Support channel not found");
  }

  const updated = await prisma.supportChannel.update({
    where: { id: channelId },
    data,
  });
  return updated as SupportChannel;
}

export async function getSupportChannelByTelegram(botToken: string, chatId: string) {
  if (!botToken || !chatId) return null;
  const channel = await prisma.supportChannel.findFirst({
    where: {
      platform: "TELEGRAM",
      telegramBotToken: botToken,
      telegramChatId: chatId,
      status: "connected",
    },
  });
  return (channel || null) as SupportChannel | null;
}

export async function getSupportChannelBySlack(teamId: string, channelId: string) {
  if (!teamId || !channelId) return null;
  const channel = await prisma.supportChannel.findFirst({
    where: {
      platform: "SLACK",
      slackTeamId: teamId,
      slackChannelId: channelId,
      status: "connected",
    },
  });
  return (channel || null) as SupportChannel | null;
}

export async function getSupportChannelByDiscord(guildId: string, channelId: string) {
  if (!guildId || !channelId) return null;
  const channel = await prisma.supportChannel.findFirst({
    where: {
      platform: "DISCORD",
      discordGuildId: guildId,
      discordChannelId: channelId,
      status: "connected",
    },
  });
  return (channel || null) as SupportChannel | null;
}
