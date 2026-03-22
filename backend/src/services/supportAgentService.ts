import { basePrismaClient } from "@/lib/prisma";
import { AppError } from "@/middleware/errorHandler";

const prisma = basePrismaClient as any;

export interface SupportAgentCreateInput {
  name: string;
  description?: string;
  knowledgeBaseIds?: string[];
  fallbackEmail?: string;
  greeting?: string;
  brandColor?: string;
  position?: string;
  avatarUrl?: string;
  allowedDomains?: string[];
  status?: string;
  mode?: string;
  skillIds?: string[];
  soulMd?: string | null;
  campaignContext?: string | null;
  funnelRules?: Record<string, unknown> | null;
}

export interface SupportAgentUpdateInput extends Partial<SupportAgentCreateInput> {}

export async function createSupportAgent(userId: string, data: SupportAgentCreateInput) {
  const name = String(data.name ?? "").trim();
  if (!name) {
    throw new AppError("Name is required", 400);
  }
  const dup = await prisma.supportAgent.findFirst({ where: { userId, name } });
  if (dup) {
    throw new AppError("A support agent with this name already exists.", 400);
  }
  return prisma.supportAgent.create({
    data: {
      userId,
      name,
      description: data.description ?? null,
      knowledgeBaseIds: data.knowledgeBaseIds ?? [],
      fallbackEmail: data.fallbackEmail ?? null,
      greeting: data.greeting ?? "Hi! How can I help you?",
      brandColor: data.brandColor ?? "#6366f1",
      position: data.position ?? "bottom-right",
      avatarUrl: data.avatarUrl ?? null,
      allowedDomains: data.allowedDomains ?? [],
      status: data.status ?? "active",
      mode: data.mode ?? "support",
      skillIds: data.skillIds ?? [],
      soulMd: data.soulMd ?? null,
      campaignContext: data.campaignContext ?? null,
      funnelRules: data.funnelRules ?? null,
    },
  });
}

export async function listSupportAgents(userId: string) {
  return prisma.supportAgent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSupportAgent(id: string) {
  return prisma.supportAgent.findUnique({ where: { id } });
}

export async function getSupportAgentByPublicId(publicId: string) {
  return prisma.supportAgent.findUnique({ where: { publicId } });
}

export async function updateSupportAgent(
  userId: string,
  id: string,
  data: SupportAgentUpdateInput
) {
  const agent = await prisma.supportAgent.findUnique({ where: { id } });
  if (!agent || agent.userId !== userId) {
    throw new AppError("Support agent not found", 404);
  }
  if (data.name !== undefined) {
    const nextName = String(data.name).trim();
    if (!nextName) {
      throw new AppError("Name is required", 400);
    }
    if (nextName !== agent.name) {
      const dup = await prisma.supportAgent.findFirst({
        where: { userId, name: nextName, NOT: { id } },
      });
      if (dup) {
        throw new AppError("A support agent with this name already exists.", 400);
      }
    }
    data = { ...data, name: nextName };
  }
  return prisma.supportAgent.update({
    where: { id },
    data: {
      ...data,
      // Ensure arrays and optional fields are not set to undefined
      ...(data.knowledgeBaseIds ? { knowledgeBaseIds: data.knowledgeBaseIds } : {}),
      ...(data.allowedDomains ? { allowedDomains: data.allowedDomains } : {}),
      ...(data.skillIds !== undefined ? { skillIds: data.skillIds } : {}),
      ...(data.mode !== undefined ? { mode: data.mode } : {}),
      ...(data.soulMd !== undefined ? { soulMd: data.soulMd } : {}),
      ...(data.campaignContext !== undefined ? { campaignContext: data.campaignContext } : {}),
      ...(data.funnelRules !== undefined ? { funnelRules: data.funnelRules } : {}),
    },
  });
}

export async function deleteSupportAgent(userId: string, id: string) {
  const agent = await prisma.supportAgent.findUnique({ where: { id } });
  if (!agent || agent.userId !== userId) {
    throw new AppError("Support agent not found", 404);
  }
  // Delete all conversations (sessions + messages) for this agent, then the agent
  const sessions = await prisma.supportChatSession.findMany({
    where: { supportAgentId: id },
    select: { id: true },
  });
  const sessionIds = sessions.map((s: { id: string }) => s.id);
  if (sessionIds.length > 0) {
    await prisma.supportChatMessage.deleteMany({
      where: { supportChatSessionId: { in: sessionIds } },
    });
    await prisma.supportChatSession.deleteMany({
      where: { supportAgentId: id },
    });
  }
  return prisma.supportAgent.delete({ where: { id } });
}

export async function incrementSupportAgentConversations(id: string) {
  return prisma.supportAgent.update({
    where: { id },
    data: { conversations: { increment: 1 } },
  });
}
