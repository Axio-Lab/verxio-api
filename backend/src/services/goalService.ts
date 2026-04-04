import { basePrismaClient } from "@/lib/prisma";
import { inngest } from "@/inngest/index";

const prisma = basePrismaClient as any;

/** DB can still have IN_PROGRESS after pause (race, older runs). Normalize so UI matches reality. */
export async function repairStuckInProgressTasksForPausedOrStoppedGoals(goalId: string) {
  await prisma.agentTask.updateMany({
    where: {
      goalId,
      status: "IN_PROGRESS",
      goal: { status: { in: ["PAUSED", "STOPPED"] } },
    },
    data: { status: "PENDING", startedAt: null },
  });
}

export async function repairStuckInProgressTasksForUserPausedGoals(userId: string) {
  await prisma.agentTask.updateMany({
    where: {
      status: "IN_PROGRESS",
      goal: { userId, status: { in: ["PAUSED", "STOPPED"] } },
    },
    data: { status: "PENDING", startedAt: null },
  });
}

export interface GoalCreateInput {
  name: string;
  objective: string;
  reportingChannelId?: string;
  deliveryConfig?: Record<string, unknown>;
  maxRetries?: number;
}

export async function createGoal(userId: string, data: GoalCreateInput) {
  const requestedChannelId =
    typeof data.reportingChannelId === "string" ? data.reportingChannelId.trim() : "";

  let reportingChannelId: string | null = null;
  if (requestedChannelId) {
    const channel = await prisma.supportChannel.findFirst({
      where: {
        id: requestedChannelId,
        userId,
      },
      select: { id: true },
    });
    reportingChannelId = channel?.id ?? null;
  }

  const goal = await prisma.agentGoal.create({
    data: {
      userId,
      name: data.name,
      objective: data.objective,
      reportingChannelId,
      deliveryConfig: data.deliveryConfig ?? null,
      maxRetries: data.maxRetries ?? 3,
      status: "PLANNING",
    },
  });

  await inngest.send({
    name: "verxio/goal.decompose",
    data: { goalId: goal.id, userId },
  });

  return goal;
}

export async function listGoals(userId: string) {
  await repairStuckInProgressTasksForUserPausedGoals(userId);
  return prisma.agentGoal.findMany({
    where: { userId },
    include: {
      _count: { select: { tasks: true } },
      tasks: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getGoal(userId: string, goalId: string) {
  await repairStuckInProgressTasksForPausedOrStoppedGoals(goalId);
  return prisma.agentGoal.findFirst({
    where: { id: goalId, userId },
    include: {
      tasks: { orderBy: { createdAt: "asc" } },
      memories: { orderBy: { lastAccessedAt: "desc" } },
      watches: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function updateGoalStatus(goalId: string, status: string) {
  return prisma.agentGoal.update({
    where: { id: goalId },
    data: {
      status,
      ...(status === "COMPLETE" ? { completedAt: new Date() } : {}),
      ...(status === "EXECUTING" ? { decomposedAt: new Date() } : {}),
    },
  });
}

export async function pauseGoal(goalId: string) {
  await prisma.$transaction(async (tx: any) => {
    await tx.agentGoal.update({
      where: { id: goalId },
      data: { status: "PAUSED" },
    });
    await tx.agentTask.updateMany({
      where: { goalId, status: "IN_PROGRESS" },
      data: { status: "PENDING", startedAt: null },
    });
  });
  return prisma.agentGoal.findUnique({ where: { id: goalId } });
}

export async function resumeGoal(goalId: string, userId: string) {
  const goal = await prisma.agentGoal.update({
    where: { id: goalId },
    data: { status: "EXECUTING" },
  });

  await inngest.send({
    name: "verxio/goal.execute-next",
    data: { goalId, userId },
  });

  return goal;
}

export async function deleteGoal(userId: string, goalId: string) {
  await prisma.agentGoal.deleteMany({
    where: { id: goalId, userId },
  });
}
