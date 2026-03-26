import { basePrismaClient } from "@/lib/prisma";
import { AppError } from "@/middleware/errorHandler";

const prisma = basePrismaClient as any;

function badRequest(message: string): never {
  throw new AppError(message, 400);
}

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
  sampleEvidenceUrl?: string;
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

function validateHumanTaskPayload(data: Partial<HumanTaskCreateInput>, mode: "create" | "update") {
  if (mode === "create") {
    if (!data.name || !String(data.name).trim()) {
      badRequest("Task name is required");
    }
    const rules = Array.isArray(data.acceptanceRules)
      ? (data.acceptanceRules as string[]).map((r) => String(r).trim()).filter(Boolean)
      : [];
    if (rules.length === 0) {
      badRequest("At least one acceptance rule is required");
    }
    if (!data.reportChannelId || !String(data.reportChannelId).trim()) {
      badRequest("Notification channel is required for worker messages and reminders");
    }
    const recurrence = data.recurrenceType ?? "DAILY";
    const times = Array.isArray(data.scheduledTimes) ? data.scheduledTimes : [];
    if (recurrence === "DAILY" || recurrence === "WEEKLY") {
      if (times.length === 0 || !times.some((t) => String(t).trim())) {
        badRequest("At least one scheduled time is required for daily or weekly tasks");
      }
    }
    if (recurrence === "INTERVAL") {
      const iv = data.recurrenceInterval ?? 60;
      if (!iv || iv < 1) {
        badRequest("Interval must be at least 1 minute");
      }
    }
  } else {
    if ("acceptanceRules" in data && data.acceptanceRules !== undefined) {
      const rules = Array.isArray(data.acceptanceRules)
        ? (data.acceptanceRules as string[]).map((r) => String(r).trim()).filter(Boolean)
        : [];
      if (rules.length === 0) {
        badRequest("At least one acceptance rule is required");
      }
    }
    if ("reportChannelId" in data && data.reportChannelId !== undefined) {
      if (!data.reportChannelId || !String(data.reportChannelId).trim()) {
        badRequest("Notification channel is required for worker messages and reminders");
      }
    }
    if (data.recurrenceType === "DAILY" || data.recurrenceType === "WEEKLY") {
      if (data.scheduledTimes !== undefined) {
        const times = Array.isArray(data.scheduledTimes) ? data.scheduledTimes : [];
        if (times.length === 0 || !times.some((t) => String(t).trim())) {
          badRequest("At least one scheduled time is required for daily or weekly tasks");
        }
      }
    }
    if (data.recurrenceType === "INTERVAL" && data.recurrenceInterval !== undefined) {
      if (!data.recurrenceInterval || data.recurrenceInterval < 1) {
        badRequest("Interval must be at least 1 minute");
      }
    }
  }
}

export async function createHumanTask(userId: string, data: HumanTaskCreateInput) {
  validateHumanTaskPayload(data, "create");

  const channelId = data.reportChannelId!.trim();
  const taskName = String(data.name).trim();
  const nameTaken = await prisma.humanTask.findFirst({
    where: { userId, name: taskName, status: { not: "ARCHIVED" } },
  });
  if (nameTaken) {
    badRequest("A task with this name already exists. Choose a unique name.");
  }

  return prisma.humanTask.create({
    data: {
      userId,
      name: taskName,
      description: data.description ?? null,
      supportAgentId: data.supportAgentId ?? null,
      evidenceType: data.evidenceType ?? "PHOTO",
      recurrenceType: data.recurrenceType ?? "DAILY",
      recurrenceInterval: data.recurrenceInterval ?? null,
      scheduledTimes: data.scheduledTimes ?? [],
      timezone: data.timezone ?? "UTC",
      acceptanceRules: data.acceptanceRules ?? [],
      sampleEvidenceUrl: data.sampleEvidenceUrl ?? null,
      scoringEnabled: data.scoringEnabled ?? true,
      passingScore: data.passingScore ?? 70,
      graceMinutes: data.graceMinutes ?? 15,
      resubmissionAllowed: data.resubmissionAllowed ?? true,
      reportTime: data.reportTime ?? "18:00",
      taskChannelId: channelId,
      deliveryConfig: data.deliveryConfig ?? null,
      status: "ACTIVE",
    },
  });
}

export async function listHumanTasks(userId: string) {
  const tasks = await prisma.humanTask.findMany({
    where: { userId },
    include: {
      taskChannel: { select: { id: true, platform: true, label: true } },
      _count: {
        select: {
          workers: true,
          submissions: {
            where: { status: { in: ["SUBMITTED", "PASSED", "FAILED", "VETTING", "RESUBMITTED"] } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return tasks;
}

export async function getHumanTask(userId: string, taskId: string) {
  return prisma.humanTask.findFirst({
    where: { id: taskId, userId },
    include: {
      workers: { orderBy: { createdAt: "asc" } },
      submissions: { orderBy: { dueAt: "desc" }, take: 50 },
      _count: {
        select: {
          workers: true,
          submissions: {
            where: { status: { in: ["SUBMITTED", "PASSED", "FAILED", "VETTING", "RESUBMITTED"] } },
          },
          reports: true,
        },
      },
    },
  });
}

export async function updateHumanTask(userId: string, taskId: string, data: HumanTaskUpdateInput) {
  if (Object.keys(data).length > 0) {
    validateHumanTaskPayload(data, "update");
  }

  // API still uses `reportChannelId` for the notification channel picker, but values are TaskChannel IDs.
  // `HumanTask.reportChannelId` FK points at SupportChannel — passing a TaskChannel id causes FK errors.
  const raw = data as Record<string, unknown>;
  const { reportChannelId, taskChannelId: incomingTaskChannelId, ...rest } = raw;

  const prismaData: Record<string, unknown> = { ...rest };

  if (reportChannelId !== undefined || incomingTaskChannelId !== undefined) {
    const channelId = incomingTaskChannelId !== undefined ? incomingTaskChannelId : reportChannelId;
    const trimmed = channelId != null && String(channelId).trim() ? String(channelId).trim() : null;
    prismaData.taskChannelId = trimmed;
    prismaData.reportChannelId = null;
  }

  if (prismaData.name !== undefined && typeof prismaData.name === "string") {
    const nextName = String(prismaData.name).trim();
    prismaData.name = nextName;
    const taken = await prisma.humanTask.findFirst({
      where: {
        userId,
        name: nextName,
        NOT: { id: taskId },
        status: { not: "ARCHIVED" },
      },
    });
    if (taken) {
      badRequest("A task with this name already exists. Choose a unique name.");
    }
  }

  return prisma.humanTask.updateMany({
    where: { id: taskId, userId },
    data: prismaData as any,
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
