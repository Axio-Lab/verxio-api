import { basePrismaClient } from "@/lib/prisma";
import { getWorkerByExternalId, activateWorker } from "./humanWorkerService";
import { vetSubmission, vetTextSubmission } from "./taskVettingService";

const prisma = basePrismaClient as any;

export async function createPendingSubmission(taskId: string, workerId: string, dueAt: Date) {
  return prisma.taskSubmission.create({
    data: {
      humanTaskId: taskId,
      workerId,
      dueAt,
      status: "PENDING",
    },
  });
}

export async function handleIncomingSubmission(
  platform: string,
  externalId: string,
  message?: string,
  imageUrl?: string
): Promise<{ handled: boolean; feedback?: string }> {
  const worker = await getWorkerByExternalId(platform, externalId);
  if (!worker) return { handled: false };

  const task = worker.humanTask;
  if (!task || task.status !== "ACTIVE") return { handled: false };

  // Auto-activate onboarding workers on first message
  if (worker.status === "ONBOARDING") {
    await activateWorker(worker.id);
  }

  // Validate evidence type
  if (task.evidenceType === "PHOTO" && !imageUrl) {
    return { handled: true, feedback: "This task requires a photo. Please send an image." };
  }
  if (task.evidenceType === "DOCUMENT" && !imageUrl && !message) {
    return { handled: true, feedback: "This task requires a document or file. Please send a file or paste the document content." };
  }

  // Find latest PENDING submission for this worker's task
  let submission = await prisma.taskSubmission.findFirst({
    where: {
      workerId: worker.id,
      humanTaskId: task.id,
      status: "PENDING",
    },
    orderBy: { dueAt: "desc" },
  });

  // Check for resubmission
  if (!submission && task.resubmissionAllowed) {
    submission = await prisma.taskSubmission.findFirst({
      where: {
        workerId: worker.id,
        humanTaskId: task.id,
        status: "FAILED",
      },
      orderBy: { dueAt: "desc" },
    });
    if (submission) {
      await prisma.taskSubmission.update({
        where: { id: submission.id },
        data: { status: "RESUBMITTED" },
      });
      submission = await prisma.taskSubmission.create({
        data: {
          humanTaskId: task.id,
          workerId: worker.id,
          dueAt: submission.dueAt,
          status: "PENDING",
        },
      });
    }
  }

  if (!submission) {
    return { handled: true, feedback: "No pending task found. Your submission will be recorded when the next task is due." };
  }

  const now = new Date();
  const latenessSeconds = Math.round((now.getTime() - submission.dueAt.getTime()) / 1000);

  await prisma.taskSubmission.update({
    where: { id: submission.id },
    data: {
      submittedAt: now,
      latenessSeconds,
      imageUrl: imageUrl ?? null,
      rawMessage: message ?? null,
      status: "SUBMITTED",
    },
  });

  // Queue vetting
  let feedback: string;
  try {
    if (imageUrl && (task.evidenceType === "PHOTO" || task.evidenceType === "PHOTO_AND_TEXT")) {
      feedback = await vetSubmission(submission.id);
    } else if (task.evidenceType === "DOCUMENT" && imageUrl) {
      feedback = await vetSubmission(submission.id);
    } else {
      feedback = await vetTextSubmission(submission.id);
    }
  } catch (err: any) {
    feedback = "Your submission has been received. We'll review it shortly.";
    console.error("[TaskSubmission] Vetting error:", err.message);
  }

  return { handled: true, feedback };
}

export async function markMissed(submissionId: string) {
  return prisma.taskSubmission.update({
    where: { id: submissionId },
    data: { status: "MISSED" },
  });
}

export async function getSubmissionsForReport(
  taskId: string,
  periodStart: Date,
  periodEnd: Date
) {
  return prisma.taskSubmission.findMany({
    where: {
      humanTaskId: taskId,
      dueAt: { gte: periodStart, lte: periodEnd },
    },
    include: {
      worker: { select: { id: true, name: true, platform: true } },
    },
    orderBy: { dueAt: "asc" },
  });
}

export async function getSubmission(submissionId: string) {
  return prisma.taskSubmission.findUnique({
    where: { id: submissionId },
    include: {
      worker: true,
      humanTask: true,
    },
  });
}

export async function listSubmissions(
  taskId: string,
  filters?: { workerId?: string; status?: string; date?: string }
) {
  const where: any = { humanTaskId: taskId };
  if (filters?.workerId) where.workerId = filters.workerId;
  if (filters?.status) where.status = filters.status;
  if (filters?.date) {
    const day = new Date(filters.date);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    where.dueAt = { gte: day, lt: nextDay };
  }

  return prisma.taskSubmission.findMany({
    where,
    include: {
      worker: { select: { id: true, name: true, platform: true } },
    },
    orderBy: { dueAt: "desc" },
    take: 100,
  });
}
