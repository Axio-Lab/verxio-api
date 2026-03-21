import { basePrismaClient } from "@/lib/prisma";
import { inngest } from "@/inngest/index";

const prisma = basePrismaClient as any;

export interface WatchCreateInput {
  name: string;
  description?: string;
  triggerType: "CRON" | "THRESHOLD" | "WEBHOOK_EVENT";
  cronExpression?: string;
  thresholdCondition?: Record<string, unknown>;
  actionWorkflowId?: string;
  goalId?: string;
}

export async function createWatch(userId: string, data: WatchCreateInput) {
  return prisma.agentWatch.create({
    data: {
      userId,
      goalId: data.goalId ?? null,
      name: data.name,
      description: data.description ?? null,
      triggerType: data.triggerType,
      cronExpression: data.cronExpression ?? null,
      thresholdCondition: data.thresholdCondition ?? null,
      actionWorkflowId: data.actionWorkflowId ?? null,
      status: "ACTIVE",
    },
  });
}

export async function listWatches(userId: string) {
  return prisma.agentWatch.findMany({
    where: { userId },
    include: { actionWorkflow: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function fireWatch(watchId: string) {
  const watch = await prisma.agentWatch.findUnique({ where: { id: watchId } });
  if (!watch) throw new Error("Watch not found");

  await inngest.send({
    name: "verxio/watch.fired",
    data: { watchId, actionWorkflowId: watch.actionWorkflowId },
  });

  return prisma.agentWatch.update({
    where: { id: watchId },
    data: { lastFiredAt: new Date() },
  });
}

export async function pauseWatch(userId: string, watchId: string) {
  return prisma.agentWatch.updateMany({
    where: { id: watchId, userId },
    data: { status: "PAUSED" },
  });
}

export async function resumeWatch(userId: string, watchId: string) {
  return prisma.agentWatch.updateMany({
    where: { id: watchId, userId },
    data: { status: "ACTIVE" },
  });
}

export async function deleteWatch(userId: string, watchId: string) {
  await prisma.agentWatch.deleteMany({
    where: { id: watchId, userId },
  });
}
