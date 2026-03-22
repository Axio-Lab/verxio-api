import { basePrismaClient } from "@/lib/prisma";

const prisma = basePrismaClient as any;

export interface MemoryInput {
  key: string;
  value: string;
  scope?: string;
  goalId?: string;
  confidence?: number;
  expiresAt?: Date;
}

export async function rememberFact(userId: string, data: MemoryInput) {
  return prisma.agentMemory.upsert({
    where: {
      userId_scope_key: {
        userId,
        scope: data.scope ?? "GLOBAL",
        key: data.key,
      },
    },
    create: {
      userId,
      goalId: data.goalId ?? null,
      scope: data.scope ?? "GLOBAL",
      key: data.key,
      value: data.value,
      confidence: data.confidence ?? 1.0,
      expiresAt: data.expiresAt ?? null,
      lastAccessedAt: new Date(),
    },
    update: {
      value: data.value,
      confidence: data.confidence ?? 1.0,
      expiresAt: data.expiresAt ?? null,
      lastAccessedAt: new Date(),
    },
  });
}

export async function recallFacts(userId: string, scope?: string, goalId?: string) {
  const now = new Date();
  const memories = await prisma.agentMemory.findMany({
    where: {
      userId,
      ...(scope ? { scope } : {}),
      ...(goalId ? { goalId } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { lastAccessedAt: "desc" },
  });

  // Update lastAccessedAt
  if (memories.length > 0) {
    await prisma.agentMemory.updateMany({
      where: { id: { in: memories.map((m: { id: string }) => m.id) } },
      data: { lastAccessedAt: new Date() },
    });
  }

  return memories;
}

export async function forgetFact(userId: string, key: string, scope: string) {
  await prisma.agentMemory.deleteMany({
    where: { userId, key, scope },
  });
}

export async function deleteMemory(userId: string, memoryId: string) {
  await prisma.agentMemory.deleteMany({
    where: { id: memoryId, userId },
  });
}

export async function listAllMemories(userId: string) {
  const now = new Date();
  return prisma.agentMemory.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { lastAccessedAt: "desc" },
  });
}

export async function buildMemoryContext(userId: string, goalId?: string): Promise<string> {
  const memories = await recallFacts(userId, undefined, goalId);
  if (memories.length === 0) return "";

  const lines = memories.map(
    (m: { key: string; value: string; scope: string }) => `[${m.scope}] ${m.key}: ${m.value}`
  );
  return `## Agent Memory\n${lines.join("\n")}`;
}
