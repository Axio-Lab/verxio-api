import { basePrismaClient } from "@/lib/prisma";

const prisma = basePrismaClient as any;

export interface WorkerCreateInput {
  name: string;
  phone?: string;
  platform: string;
  externalId: string;
  supportChannelId?: string;
  role?: string;
}

export async function addWorker(userId: string, taskId: string, data: WorkerCreateInput) {
  const task = await prisma.humanTask.findFirst({
    where: { id: taskId, userId },
  });
  if (!task) throw new Error("Task not found or not owned by user");

  return prisma.humanWorker.create({
    data: {
      humanTaskId: taskId,
      name: data.name,
      phone: data.phone ?? null,
      platform: data.platform,
      externalId: data.externalId,
      supportChannelId: data.supportChannelId ?? null,
      role: data.role ?? null,
      status: "ONBOARDING",
    },
  });
}

export async function listWorkers(taskId: string) {
  return prisma.humanWorker.findMany({
    where: { humanTaskId: taskId },
    include: {
      submissions: {
        orderBy: { dueAt: "desc" },
        take: 1,
        select: { status: true, dueAt: true, aiScore: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function removeWorker(userId: string, taskId: string, workerId: string) {
  const task = await prisma.humanTask.findFirst({
    where: { id: taskId, userId },
  });
  if (!task) throw new Error("Task not found or not owned by user");

  return prisma.humanWorker.updateMany({
    where: { id: workerId, humanTaskId: taskId },
    data: { status: "INACTIVE" },
  });
}

export async function getWorkerByExternalId(platform: string, externalId: string) {
  return prisma.humanWorker.findFirst({
    where: {
      platform,
      externalId,
      status: { in: ["ACTIVE", "ONBOARDING"] },
    },
    include: {
      humanTask: true,
    },
  });
}

export async function activateWorker(workerId: string) {
  return prisma.humanWorker.update({
    where: { id: workerId },
    data: { status: "ACTIVE", onboardedAt: new Date() },
  });
}
