import { basePrismaClient } from "@/lib/prisma";

const prisma = basePrismaClient as any;

export interface HumanTaskCreateInput {
  name: string;
  description?: string;
  supportAgentId?: string;
  evidenceType?: string;
  recurrenceType?: string;
  recurrenceInterval?: number;
  scheduledTimes?: string[];
  timezone?: string;
  acceptanceRules?: string[];
  scoringEnabled?: boolean;
  passingScore?: number;
  graceMinutes?: number;
  resubmissionAllowed?: boolean;
  reportTime?: string;
  reportChannelId?: string;
  deliveryConfig?: Record<string, unknown>;
}

export type HumanTaskUpdateInput = Partial<HumanTaskCreateInput> & {
  status?: string;
};

export async function createHumanTask(userId: string, data: HumanTaskCreateInput) {
  return prisma.humanTask.create({
    data: {
      userId,
      name: data.name,
      description: data.description ?? null,
      supportAgentId: data.supportAgentId ?? null,
      evidenceType: data.evidenceType ?? "PHOTO",
      recurrenceType: data.recurrenceType ?? "DAILY",
      recurrenceInterval: data.recurrenceInterval ?? null,
      scheduledTimes: data.scheduledTimes ?? [],
      timezone: data.timezone ?? "UTC",
      acceptanceRules: data.acceptanceRules ?? [],
      scoringEnabled: data.scoringEnabled ?? true,
      passingScore: data.passingScore ?? 70,
      graceMinutes: data.graceMinutes ?? 15,
      resubmissionAllowed: data.resubmissionAllowed ?? true,
      reportTime: data.reportTime ?? "18:00",
      reportChannelId: data.reportChannelId ?? null,
      deliveryConfig: data.deliveryConfig ?? null,
      status: "ACTIVE",
    },
  });
}

export async function listHumanTasks(userId: string) {
  return prisma.humanTask.findMany({
    where: { userId },
    include: {
      _count: { select: { workers: true, submissions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getHumanTask(userId: string, taskId: string) {
  return prisma.humanTask.findFirst({
    where: { id: taskId, userId },
    include: {
      workers: { orderBy: { createdAt: "asc" } },
      submissions: { orderBy: { dueAt: "desc" }, take: 50 },
      _count: { select: { workers: true, submissions: true, reports: true } },
    },
  });
}

export async function updateHumanTask(userId: string, taskId: string, data: HumanTaskUpdateInput) {
  return prisma.humanTask.updateMany({
    where: { id: taskId, userId },
    data,
  });
}

export async function deleteHumanTask(userId: string, taskId: string) {
  return prisma.humanTask.updateMany({
    where: { id: taskId, userId },
    data: { status: "ARCHIVED" },
  });
}

export async function pauseHumanTask(userId: string, taskId: string) {
  return prisma.humanTask.updateMany({
    where: { id: taskId, userId },
    data: { status: "PAUSED" },
  });
}

export async function resumeHumanTask(userId: string, taskId: string) {
  return prisma.humanTask.updateMany({
    where: { id: taskId, userId },
    data: { status: "ACTIVE" },
  });
}

export async function getActiveTasksForScheduling() {
  return prisma.humanTask.findMany({
    where: { status: "ACTIVE" },
    include: {
      workers: { where: { status: "ACTIVE" } },
    },
  });
}
