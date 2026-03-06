import { basePrismaClient } from "@/lib/prisma";

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
}

export interface SupportAgentUpdateInput extends Partial<SupportAgentCreateInput> {}

export async function createSupportAgent(userId: string, data: SupportAgentCreateInput) {
  return prisma.supportAgent.create({
    data: {
      userId,
      name: data.name,
      description: data.description ?? null,
      knowledgeBaseIds: data.knowledgeBaseIds ?? [],
      fallbackEmail: data.fallbackEmail ?? null,
      greeting: data.greeting ?? "Hi! How can I help you?",
      brandColor: data.brandColor ?? "#6366f1",
      position: data.position ?? "bottom-right",
      avatarUrl: data.avatarUrl ?? null,
      allowedDomains: data.allowedDomains ?? [],
      status: data.status ?? "active",
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
    throw new Error("Support agent not found");
  }
  return prisma.supportAgent.update({
    where: { id },
    data: {
      ...data,
      // Ensure arrays are not set to undefined
      ...(data.knowledgeBaseIds ? { knowledgeBaseIds: data.knowledgeBaseIds } : {}),
      ...(data.allowedDomains ? { allowedDomains: data.allowedDomains } : {}),
    },
  });
}

export async function deleteSupportAgent(userId: string, id: string) {
  const agent = await prisma.supportAgent.findUnique({ where: { id } });
  if (!agent || agent.userId !== userId) {
    throw new Error("Support agent not found");
  }
  return prisma.supportAgent.delete({ where: { id } });
}

export async function incrementSupportAgentConversations(id: string) {
  return prisma.supportAgent.update({
    where: { id },
    data: { conversations: { increment: 1 } },
  });
}
