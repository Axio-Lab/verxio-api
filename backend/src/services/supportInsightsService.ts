import { basePrismaClient } from "@/lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { getSupportAgent } from "./supportAgentService";

const prisma = basePrismaClient as any;

type InsightMessageRow = { role: string; content: string; hadFallbackReply: boolean };

export interface SupportAgentInsights {
  totalConversations: number;
  totalMessages: number;
  frequentQuestions: Array<{ text: string; count: number }>;
  fallbackRate: number;
  fallbackCount: number;
  assistantMessageCount: number;
  sampleFallbackQuestions: string[];
  averageRating: number | null;
  ratingCount: number;
  ratingDistribution: Record<number, number>;
  customerFeedback: string[];
}

export async function getSupportAgentInsights(
  supportAgentId: string,
  userId: string,
  options?: { limit?: number; since?: Date }
): Promise<SupportAgentInsights> {
  const agent = await getSupportAgent(supportAgentId);
  if (!agent || agent.userId !== userId) {
    throw new AppError("Support agent not found", 404);
  }

  const since = options?.since;
  const limit = options?.limit ?? 20;

  const sessionWhere = {
    supportAgentId,
    ...(since && { lastMessageAt: { gte: since } }),
  };

  const sessionCount = await prisma.supportChatSession.count({ where: sessionWhere });

  const sessionsWithRating = await prisma.supportChatSession.findMany({
    where: { ...sessionWhere, rating: { not: null } },
    select: { rating: true, feedback: true },
  });
  const ratingCount = sessionsWithRating.length;
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;
  const customerFeedback: string[] = [];
  for (const s of sessionsWithRating) {
    const r = s.rating as number;
    if (r >= 1 && r <= 5) {
      ratingDistribution[r] = (ratingDistribution[r] ?? 0) + 1;
      ratingSum += r;
    }
    if (s.feedback && String(s.feedback).trim()) {
      customerFeedback.push(String(s.feedback).trim().slice(0, 500));
    }
  }
  const averageRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null;

  const messagesRaw = await prisma.supportChatMessage.findMany({
    where: {
      supportChatSession: { supportAgentId },
      ...(since && { createdAt: { gte: since } }),
    },
    select: {
      role: true,
      content: true,
      hadFallbackReply: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const messages = messagesRaw as InsightMessageRow[];

  const totalMessages = messages.length;
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const fallbackCount = assistantMessages.filter((m) => m.hadFallbackReply === true).length;
  const fallbackRate =
    assistantMessages.length > 0 ? (fallbackCount / assistantMessages.length) * 100 : 0;

  const userMessages = messages.filter((m) => m.role === "user").map((m) => m.content.trim());
  const normalizedCount = new Map<string, { text: string; count: number }>();
  for (const text of userMessages) {
    if (!text) continue;
    const normalized = text.toLowerCase().slice(0, 200).trim();
    const key = normalized;
    const existing = normalizedCount.get(key);
    if (existing) {
      existing.count++;
      if (existing.text.length < text.length) existing.text = text;
    } else {
      normalizedCount.set(key, { text, count: 1 });
    }
  }
  const frequentQuestions = Array.from(normalizedCount.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  const fallbackMessageIndices = new Set<number>();
  messages.forEach((m, i) => {
    if (m.role === "assistant" && m.hadFallbackReply) fallbackMessageIndices.add(i);
  });
  const sampleFallbackQuestions: string[] = [];
  for (let i of fallbackMessageIndices) {
    if (i > 0 && messages[i - 1].role === "user") {
      const q = messages[i - 1].content.trim().slice(0, 200);
      if (q && !sampleFallbackQuestions.includes(q)) sampleFallbackQuestions.push(q);
    }
    if (sampleFallbackQuestions.length >= 10) break;
  }

  return {
    totalConversations: sessionCount,
    totalMessages,
    frequentQuestions,
    fallbackRate,
    fallbackCount,
    assistantMessageCount: assistantMessages.length,
    sampleFallbackQuestions,
    averageRating,
    ratingCount,
    ratingDistribution,
    customerFeedback,
  };
}

export interface SupportAgentKBSuggestions {
  suggestedTopics: string[];
  sampleQuestions: string[];
}

export async function getSupportAgentKBSuggestions(
  supportAgentId: string,
  userId: string
): Promise<SupportAgentKBSuggestions> {
  const insights = await getSupportAgentInsights(supportAgentId, userId, { limit: 30 });
  const sampleQuestions = insights.sampleFallbackQuestions;
  const suggestedTopics = [...new Set(sampleQuestions)].slice(0, 15);
  return {
    suggestedTopics,
    sampleQuestions,
  };
}
