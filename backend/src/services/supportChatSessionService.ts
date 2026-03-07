import { basePrismaClient } from "@/lib/prisma";
import { incrementSupportAgentConversations } from "./supportAgentService";

const prisma = basePrismaClient as any;

export type AttachmentItem = { type: string; url: string };

type SupportChatMessageRow = {
  role: string;
  content: string;
  attachmentUrls: unknown;
  createdAt: Date;
};

export async function getOrCreateSupportChatSession(
  supportAgentId: string,
  publicSessionId: string
): Promise<{ id: string; isNew: boolean }> {
  const existing = await prisma.supportChatSession.findUnique({
    where: {
      supportAgentId_publicSessionId: { supportAgentId, publicSessionId },
    },
  });
  if (existing) {
    return { id: existing.id, isNew: false };
  }
  const created = await prisma.supportChatSession.create({
    data: { supportAgentId, publicSessionId },
  });
  await incrementSupportAgentConversations(supportAgentId);
  return { id: created.id, isNew: true };
}

export async function getSupportChatMessages(
  supportAgentId: string,
  publicSessionId: string,
  limit: number = 100
): Promise<
  Array<{ role: string; content: string; attachmentUrls: AttachmentItem[] | null; createdAt: Date }>
> {
  const session = await prisma.supportChatSession.findUnique({
    where: {
      supportAgentId_publicSessionId: { supportAgentId, publicSessionId },
    },
    select: { id: true },
  });
  if (!session) return [];

  const messages = await prisma.supportChatMessage.findMany({
    where: { supportChatSessionId: session.id },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      role: true,
      content: true,
      attachmentUrls: true,
      createdAt: true,
    },
  });

  return (messages as SupportChatMessageRow[]).map((m) => ({
    role: m.role,
    content: m.content,
    attachmentUrls: m.attachmentUrls as AttachmentItem[] | null,
    createdAt: m.createdAt,
  }));
}

export async function appendSupportChatMessages(
  supportChatSessionId: string,
  userMessage: { content: string; attachmentUrls?: AttachmentItem[] },
  assistantMessage: { content: string; hadFallbackReply: boolean }
): Promise<void> {
  await prisma.supportChatMessage.createMany({
    data: [
      {
        supportChatSessionId,
        role: "user",
        content: userMessage.content,
        attachmentUrls: userMessage.attachmentUrls
          ? (userMessage.attachmentUrls as any)
          : undefined,
        hadFallbackReply: false,
      },
      {
        supportChatSessionId,
        role: "assistant",
        content: assistantMessage.content,
        hadFallbackReply: assistantMessage.hadFallbackReply,
      },
    ],
  });

  await prisma.supportChatSession.update({
    where: { id: supportChatSessionId },
    data: { lastMessageAt: new Date() },
  });
}

export async function updateSessionSuggestRating(
  supportChatSessionId: string,
  suggestRating: boolean
): Promise<void> {
  await prisma.supportChatSession.update({
    where: { id: supportChatSessionId },
    data: { suggestRating },
  });
}

export async function updateSessionFeedback(
  supportAgentId: string,
  publicSessionId: string,
  rating: number,
  feedback?: string | null
): Promise<{ success: boolean }> {
  const session = await prisma.supportChatSession.findUnique({
    where: {
      supportAgentId_publicSessionId: { supportAgentId, publicSessionId },
    },
  });
  if (!session) return { success: false };
  await prisma.supportChatSession.update({
    where: { id: session.id },
    data: {
      rating: Math.min(5, Math.max(1, Math.round(rating))),
      feedback: feedback && feedback.trim() ? feedback.trim().slice(0, 2000) : null,
    },
  });
  return { success: true };
}

export async function getSessionFeedback(
  supportAgentId: string,
  publicSessionId: string
): Promise<{ rating: number | null; feedback: string | null; suggestRating: boolean }> {
  const session = await prisma.supportChatSession.findUnique({
    where: {
      supportAgentId_publicSessionId: { supportAgentId, publicSessionId },
    },
    select: { rating: true, feedback: true, suggestRating: true },
  });
  if (!session) return { rating: null, feedback: null, suggestRating: false };
  return {
    rating: session.rating ?? null,
    feedback: session.feedback ?? null,
    suggestRating: session.suggestRating === true,
  };
}
