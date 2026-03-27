import { basePrismaClient } from "@/lib/prisma";
import {
  getWorkerByExternalId,
  activateWorker,
  buildTaskWorkerHelpText,
  type WorkerLookupOptions,
} from "./humanWorkerService";
import { vetSubmission, vetTextSubmission } from "./taskVettingService";

const prisma = basePrismaClient as any;

/** Message-only "ready" from onboarding instructions (case-insensitive; optional ! or .). */
function isReadyOnboardingMessage(message: string): boolean {
  return /^\s*ready[!.]*\s*$/i.test(message.trim());
}

/** Strip zero-width / BOM chars WhatsApp and other clients sometimes insert; NFKC for fullwidth etc. */
function normalizeChatText(s: string): string {
  return s
    .normalize("NFKC")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

/**
 * Same intent across Telegram, WhatsApp, Slack, Discord task channels.
 * Users often say hi/hello instead of typing HELP — treat short greetings as help requests.
 * HELP / help / Help are matched case-insensitively; optional ! or . after "help".
 */
export function isHelpIntentMessage(message: string): boolean {
  const trimmed = normalizeChatText(message);
  if (!trimmed) return false;
  // Case-insensitive HELP (help, Help, HELP) — whole message, optional punctuation
  if (/^help[!.?…]*$/i.test(trimmed)) return true;
  if (/^\/help$/i.test(trimmed) || /^\/start$/i.test(trimmed)) return true;
  if (/^help\b/i.test(trimmed)) return true;
  // Short greetings only (avoid matching long evidence text that starts with "Hi")
  if (/^(hello|hi|hey|helo|hii)([!.?…]|\s)*$/i.test(trimmed)) return true;
  return false;
}

function normalizeWaJid(jid: string): string {
  return jid.replace(/:.*@/, "@");
}

function selectStableWhatsAppIdentity(primaryExternalId: string, extras?: string[]): string | null {
  const raw = [primaryExternalId, ...(extras ?? [])]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .map(normalizeWaJid);

  // Prefer real chat identity JIDs first.
  const lid = raw.find((v) => v.endsWith("@lid"));
  if (lid) return lid;
  const sJid = raw.find((v) => v.endsWith("@s.whatsapp.net"));
  if (sJid) return sJid;
  return null;
}

async function persistWorkerWhatsAppIdentityIfNeeded(
  worker: any,
  incomingExternalId: string,
  lookupOptions?: WorkerLookupOptions
): Promise<void> {
  const stableId = selectStableWhatsAppIdentity(
    incomingExternalId,
    lookupOptions?.additionalExternalIds
  );
  if (!stableId || worker.externalId === stableId) return;

  // Keep reminders/send reliability while making inbound identity matching deterministic.
  try {
    await prisma.humanWorker.update({
      where: { id: worker.id },
      data: { externalId: stableId },
    });
    worker.externalId = stableId;
  } catch {
    // If uniqueness conflicts or race conditions happen, ignore and continue normal handling.
  }
}

function buildOnboardingCompleteMessage(worker: { name: string }, task: { name: string }): string {
  return (
    `Hi ${worker.name}! **Onboarding complete** — you've been successfully set up on "${task.name}".\n\n` +
    `We'll message you in this chat when check-ins are due. Send HELP anytime if you need instructions.`
  );
}

async function buildWorkerHelpFeedback(worker: any, task: any): Promise<string> {
  const pending = await prisma.taskSubmission.findFirst({
    where: {
      workerId: worker.id,
      humanTaskId: task.id,
      status: "PENDING",
    },
    orderBy: { dueAt: "asc" },
  });

  const tz = task.timezone || "UTC";
  const lines = ["", "## Your check-ins"];

  if (pending) {
    const due = new Date(pending.dueAt);
    const now = Date.now();
    const dueLabel = due.toLocaleString("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (due.getTime() <= now) {
      lines.push(
        "You have a check-in due **now**. Submit your evidence in this chat as soon as you can — before the grace period ends — so it is not recorded as missed."
      );
    } else {
      const mins = Math.max(0, Math.round((due.getTime() - now) / 60000));
      lines.push(`Next check-in due: ${dueLabel} (${tz}).`);
      lines.push(`About ${mins} minute(s) from now.`);
      lines.push(
        "You can submit **early** as soon as this check-in opens (you do not need to wait until the exact minute). Submitting early helps you avoid missing the grace period."
      );
    }
  } else {
    lines.push("No open check-in right now.");
    lines.push(
      "We send a heads-up about 30 minutes before the next due time, then a reminder at the due time. You can submit any time from when the slot opens until the grace period ends — early submission is encouraged."
    );
  }

  return `${buildTaskWorkerHelpText(worker, task)}\n${lines.join("\n")}`;
}

export async function createPendingSubmission(taskId: string, workerId: string, dueAt: Date) {
  const existing = await prisma.taskSubmission.findFirst({
    where: {
      humanTaskId: taskId,
      workerId,
      dueAt,
    },
  });
  if (existing) return existing;

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
  imageUrl?: string,
  lookupOptions?: WorkerLookupOptions & {
    /** "camera" = inline photo from camera/gallery, "document" = sent as file attachment */
    imageSource?: "camera" | "document";
  }
): Promise<{ handled: boolean; feedback?: string }> {
  const worker = await getWorkerByExternalId(platform, externalId, lookupOptions);
  if (!worker) {
    return { handled: false };
  }

  if (platform === "WHATSAPP") {
    await persistWorkerWhatsAppIdentityIfNeeded(worker, externalId, lookupOptions);
  }

  const trimmed = (message || "").trim();
  const isHelpIntent = isHelpIntentMessage(trimmed);

  const task = worker.humanTask;
  if (!task) {
    return { handled: false };
  }

  // HELP must work when the task is PAUSED (only ACTIVE is required for evidence / check-ins).
  if (isHelpIntent) {
    if (task.status === "ARCHIVED") {
      return {
        handled: true,
        feedback:
          "This assignment has been archived. If you think this is a mistake, contact your manager.",
      };
    }
    // Telegram users often tap /start first; that must still complete onboarding on the dashboard.
    if (worker.status === "ONBOARDING") {
      await activateWorker(worker.id);
    }
    const feedback = await buildWorkerHelpFeedback(worker, task);
    return { handled: true, feedback };
  }

  if (task.status !== "ACTIVE") return { handled: false };

  const wasOnboarding = worker.status === "ONBOARDING";
  const isReadyOnly = isReadyOnboardingMessage(trimmed);
  if (wasOnboarding) {
    await activateWorker(worker.id);
  }

  // Auto-mark stale PENDING submissions as MISSED (past due + grace period)
  const graceMs = (task.graceMinutes ?? 15) * 60 * 1000;
  const staleCutoff = new Date(Date.now() - graceMs);
  await prisma.taskSubmission.updateMany({
    where: {
      workerId: worker.id,
      humanTaskId: task.id,
      status: "PENDING",
      dueAt: { lt: staleCutoff },
    },
    data: { status: "MISSED" },
  });

  // Find latest PENDING submission for this worker's task
  let submission = await prisma.taskSubmission.findFirst({
    where: {
      workerId: worker.id,
      humanTaskId: task.id,
      status: "PENDING",
    },
    orderBy: { dueAt: "desc" },
  });

  // Check for resubmission (only if the failed slot is still within grace period)
  if (!submission && task.resubmissionAllowed) {
    const failedSubmission = await prisma.taskSubmission.findFirst({
      where: {
        workerId: worker.id,
        humanTaskId: task.id,
        status: "FAILED",
        dueAt: { gte: staleCutoff },
      },
      orderBy: { dueAt: "desc" },
    });
    if (failedSubmission) {
      await prisma.taskSubmission.update({
        where: { id: failedSubmission.id },
        data: { status: "RESUBMITTED" },
      });
      submission = await prisma.taskSubmission.create({
        data: {
          humanTaskId: task.id,
          workerId: worker.id,
          dueAt: failedSubmission.dueAt,
          status: "PENDING",
        },
      });
    }
  }

  if (!submission) {
    if (wasOnboarding && isReadyOnly) {
      return { handled: true, feedback: buildOnboardingCompleteMessage(worker, task) };
    }

    const missedSubmission = await prisma.taskSubmission.findFirst({
      where: {
        workerId: worker.id,
        humanTaskId: task.id,
        status: "MISSED",
      },
      orderBy: { dueAt: "desc" },
    });

    if (missedSubmission) {
      const tz = task.timezone || "UTC";
      const dueLabel = new Date(missedSubmission.dueAt).toLocaleString("en-US", {
        timeZone: tz,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const feedback =
        `## Missed check-in\n\n` +
        `Your check-in for **${task.name}** that was due on **${dueLabel} (${tz})** has already been recorded as **missed** in the report.\n\n` +
        `Late submissions are not accepted once the grace period has passed.\n\n` +
        `Please make sure to submit your evidence **early** when the next check-in opens so you finish before the grace period ends. ` +
        `You will receive a reminder when it's time.`;

      return { handled: true, feedback };
    }

    const feedback = wasOnboarding
      ? "You are all set. Nothing is due right now — we will message you here when the next check-in is due."
      : "No check-in is due right now. When you get a reminder, reply here with the requested evidence — you can submit early after the slot opens so you do not miss the grace period.";
    return { handled: true, feedback };
  }

  // Explicit READY completes onboarding but must not be stored as compliance evidence
  if (wasOnboarding && isReadyOnly) {
    const confirmation = buildOnboardingCompleteMessage(worker, task);
    let followUp: string;
    if (task.evidenceType === "PHOTO" && !imageUrl) {
      followUp =
        "A check-in is open for you. Please send a **photo** here as your evidence for this check-in.";
    } else if (task.evidenceType === "PHOTO_AND_TEXT") {
      if (!imageUrl) {
        followUp =
          "A check-in is open. Please send a **photo** (you can add a caption with your note).";
      } else {
        followUp =
          "A check-in is open. Please add a short **text** note (caption or a follow-up message) about the work.";
      }
    } else if (task.evidenceType === "DOCUMENT" && !imageUrl) {
      followUp = "A check-in is open. Please send a **document or file** for this check-in.";
    } else if (task.evidenceType === "TEXT") {
      followUp =
        "A check-in is open. Please send a **text message** that describes the work you completed (READY was only to finish setup).";
    } else {
      followUp =
        "A check-in is open. Please send the **evidence** requested for this task in a follow-up message.";
    }
    return { handled: true, feedback: `${confirmation}\n\n${followUp}` };
  }

  // Require correct evidence only when a submission slot is actually open
  const imageSource = lookupOptions?.imageSource;

  if (task.evidenceType === "PHOTO") {
    if (!imageUrl) {
      return {
        handled: true,
        feedback:
          "This check-in requires a live photo.\n\nUse the camera button in this chat to take a photo right now — do not upload from your gallery or files.",
      };
    }
    if (imageSource === "document") {
      return {
        handled: true,
        feedback:
          "Please take a live photo using the camera button in this chat.\n\nUploading files from your device is not accepted for photo check-ins — we need real-time evidence.",
      };
    }
  }
  if (task.evidenceType === "PHOTO_AND_TEXT") {
    if (!imageUrl) {
      return {
        handled: true,
        feedback:
          "This check-in requires a live photo with a caption.\n\nUse the camera button to take a photo now and add a short note.",
      };
    }
    if (imageSource === "document") {
      return {
        handled: true,
        feedback:
          "Please take a live photo using the camera button — file uploads are not accepted.\n\nAdd a short caption or follow-up message with the photo.",
      };
    }
    if (!trimmed) {
      return {
        handled: true,
        feedback: "Please add a short text note (photo caption or a follow-up message).",
      };
    }
  }
  if (task.evidenceType === "DOCUMENT" && !imageUrl && !trimmed) {
    return {
      handled: true,
      feedback: "This check-in needs a document or file. Please send a file or paste the content.",
    };
  }
  if (task.evidenceType === "TEXT" && !trimmed && !imageUrl) {
    return { handled: true, feedback: "Please send your confirmation as a text message." };
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

export async function getSubmissionsForReport(taskId: string, periodStart: Date, periodEnd: Date) {
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
  filters?: {
    workerId?: string;
    status?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const where: any = { humanTaskId: taskId };
  if (filters?.workerId) where.workerId = filters.workerId;
  if (filters?.status) where.status = filters.status;

  if (filters?.dateFrom || filters?.dateTo) {
    where.dueAt = {};
    if (filters.dateFrom) where.dueAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setDate(end.getDate() + 1);
      where.dueAt.lt = end;
    }
  } else if (filters?.date) {
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
    take: 500,
  });
}
