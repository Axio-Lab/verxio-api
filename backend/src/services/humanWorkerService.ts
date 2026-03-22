import { basePrismaClient } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/services/whatsappConnectorClient";
import { sendDiscordMessage } from "@/services/discordConnectorClient";
import {
  formatWhatsAppMessage,
  formatTelegramMessage,
  formatSlackMessage,
  formatDiscordMessage,
} from "@/services/chatIntegrationService";

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
  if (!task.taskChannelId) {
    throw new Error("This task has no notification channel. Add one in the Channels tab before inviting members.");
  }

  const worker = await prisma.humanWorker.create({
    data: {
      humanTaskId: taskId,
      name: data.name,
      phone: data.phone ?? null,
      platform: data.platform,
      externalId: data.externalId,
      role: data.role ?? null,
      status: "ONBOARDING",
      taskChannelId: task.taskChannelId,
    },
    include: { taskChannel: true },
  });

  const channel = worker.taskChannel;
  if (channel) {
    await sendWorkerChannelMessage(worker, channel, buildOnboardingMessageText(worker, task)).catch(
      (err) => {
        console.error(`[onboarding] failed to send message to worker ${worker.id}:`, err);
      }
    );
  }

  return worker;
}

const ONBOARDING_MESSAGE_MAX_LEN = 3800;

function evidenceExpectationLines(evidenceType: string): string[] {
  switch (evidenceType) {
    case "PHOTO":
      return [
        "When a check-in is due, send a clear photo in this chat as proof you completed the work.",
      ];
    case "TEXT":
      return [
        "When a check-in is due, send a text message here confirming you completed the work.",
      ];
    case "PHOTO_AND_TEXT":
      return [
        "When a check-in is due, send a photo and a short written note together in this chat.",
      ];
    case "DOCUMENT":
      return [
        "When a check-in is due, send a document or file here (for example a PDF or photo of a report).",
      ];
    default:
      return ["When a check-in is due, follow the instructions in the reminder we send you."];
  }
}

function scheduleSummaryLines(task: any): string[] {
  const tz = task.timezone || "UTC";
  const times = (task.scheduledTimes as string[]) || [];
  switch (task.recurrenceType) {
    case "ONCE":
      return ["One-time assignment. We will message you when it is time to submit."];
    case "INTERVAL":
      return [
        `Repeats every ${task.recurrenceInterval ?? 60} minutes (timezone: ${tz}).`,
        "You will get a reminder around each due time.",
      ];
    case "DAILY":
      if (times.length)
        return [`Every day at: ${times.join(", ")} (${tz}).`, "Reminders are sent at these times."];
      return [`Daily schedule (${tz}).`, "We will message you when each check-in is due."];
    case "WEEKLY":
      if (times.length)
        return [`Weekly at: ${times.join(", ")} (${tz}).`, "Reminders follow this pattern."];
      return [`Weekly schedule (${tz}).`, "We will message you when each check-in is due."];
    default:
      return [`Scheduled in ${tz}.`, "We will message you when it is time to submit."];
  }
}

/** Plain-text body; headings use ## for Telegram/HTML formatters */
export function buildOnboardingMessageText(worker: any, task: any): string {
  const roleStr = worker.role ? ` (${worker.role})` : "";
  const lines: string[] = [];

  lines.push(`Hi ${worker.name}!`);
  lines.push("");
  lines.push("## Your assignment");
  lines.push(`${task.name}${roleStr}`);
  lines.push("");

  lines.push("## Finish setup");
  lines.push(
    "Reply with READY (or any short message) in this chat so we know you received this and your account is active."
  );
  lines.push(
    "Until you reply, you may show as onboarding in the dashboard. After you reply, you will still get reminders only when a check-in is actually due."
  );
  lines.push("");

  if (task.description && String(task.description).trim()) {
    lines.push("## What this task is about");
    lines.push(String(task.description).trim());
    lines.push("");
  }

  lines.push("## What you will submit");
  lines.push(...evidenceExpectationLines(task.evidenceType));
  lines.push("");

  lines.push("## When you will hear from us");
  lines.push(...scheduleSummaryLines(task));
  lines.push(
    `After each reminder, you have about ${task.graceMinutes ?? 15} minutes before a missed check-in may be recorded if we receive nothing.`
  );
  lines.push("");

  const rules = Array.isArray(task.acceptanceRules)
    ? (task.acceptanceRules as unknown[]).map((r) => String(r).trim()).filter(Boolean)
    : [];
  if (rules.length) {
    lines.push("## Rules — align your evidence to these");
    const maxRules = 12;
    rules.slice(0, maxRules).forEach((r, i) => lines.push(`${i + 1}. ${r}`));
    if (rules.length > maxRules) {
      lines.push(`…and ${rules.length - maxRules} more (reply HELP anytime for the full list).`);
    }
    lines.push("");
  }

  if (task.scoringEnabled) {
    lines.push("## How submissions are checked");
    lines.push(
      `Submissions may be reviewed automatically. Target passing score is ${task.passingScore ?? 70} out of 100 where scoring applies.`
    );
    lines.push("");
  }

  lines.push("## Need a recap?");
  lines.push("Reply HELP anytime for a shorter summary of this task, expectations, and rules.");

  let body = lines.join("\n");
  if (body.length > ONBOARDING_MESSAGE_MAX_LEN) {
    body =
      body.slice(0, ONBOARDING_MESSAGE_MAX_LEN - 120) +
      "\n\n…(message trimmed for length.) Reply HELP for a compact summary.";
  }
  return body;
}

/** Shorter text for HELP command */
export function buildTaskWorkerHelpText(_worker: any, task: any): string {
  const lines: string[] = [];
  lines.push(`## ${task.name}`);
  lines.push("");
  if (task.description && String(task.description).trim()) {
    const desc = String(task.description).trim();
    lines.push(desc.length > 500 ? `${desc.slice(0, 500)}…` : desc);
    lines.push("");
  }
  lines.push("## What to submit");
  lines.push(...evidenceExpectationLines(task.evidenceType));
  lines.push("");
  lines.push("## Schedule");
  lines.push(...scheduleSummaryLines(task));
  lines.push("");
  const rules = Array.isArray(task.acceptanceRules)
    ? (task.acceptanceRules as unknown[]).map((r) => String(r).trim()).filter(Boolean)
    : [];
  if (rules.length) {
    lines.push("## Rules to meet");
    rules.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
    lines.push("");
  }
  lines.push(`Grace period after each due time: about ${task.graceMinutes ?? 15} minutes.`);
  let body = lines.join("\n");
  if (body.length > ONBOARDING_MESSAGE_MAX_LEN) {
    body = body.slice(0, ONBOARDING_MESSAGE_MAX_LEN - 80) + "\n\n…(trimmed.)";
  }
  return body;
}

/** Notify member their assignment is paused (disabled). */
export function buildDisableMessageText(worker: any, task: any): string {
  return [
    `Hi ${worker.name},`,
    "",
    `You have been temporarily paused on the task: ${task.name}.`,
    "",
    "You will not receive check-in reminders until your manager enables you again.",
    "",
    "If this is unexpected, contact your manager.",
  ].join("\n");
}

/** Notify member they are enabled again. */
export function buildEnableMessageText(worker: any, task: any): string {
  return [
    `Hi ${worker.name},`,
    "",
    `You have been re-enabled on the task: ${task.name}.`,
    "",
    "You will receive reminders here for upcoming check-ins as before.",
    "",
    "Reply HELP anytime for task details and your next check-in status.",
  ].join("\n");
}

/** Notify member they were removed from the task (same chat as onboarding/reminders). */
export function buildRemovalMessageText(worker: any, task: any): string {
  const lines: string[] = [
    `Hi ${worker.name},`,
    "",
    `You have been removed from the task: ${task.name}.`,
    "",
    "You will no longer receive check-in reminders for this assignment in this chat.",
    "",
    "If this looks wrong, contact your manager.",
  ];
  return lines.join("\n");
}

/** Prefer per-worker channel; fall back to task notification channel (same as task settings). */
export function resolveWorkerNotifyChannel(worker: any, task: any) {
  return worker?.taskChannel ?? task?.taskChannel ?? null;
}

/** Send plain text to the worker on their platform using the linked support channel credentials. */
async function sendWorkerChannelMessage(worker: any, channel: any, plainText: string) {
  switch (worker.platform) {
    case "WHATSAPP": {
      if (channel.whatsappSessionId) {
        await sendWhatsAppMessage({
          sessionRef: channel.whatsappSessionId,
          toJid: worker.externalId,
          text: formatWhatsAppMessage(plainText),
        });
      }
      break;
    }
    case "TELEGRAM": {
      if (channel.telegramBotToken) {
        await fetch(`https://api.telegram.org/bot${channel.telegramBotToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: worker.externalId,
            text: formatTelegramMessage(plainText),
            parse_mode: "HTML",
          }),
        });
      }
      break;
    }
    case "SLACK": {
      if (channel.slackBotToken) {
        await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channel.slackBotToken}`,
          },
          body: JSON.stringify({
            channel: worker.externalId,
            text: formatSlackMessage(plainText),
          }),
        });
      }
      break;
    }
    case "DISCORD": {
      if (channel.discordBotToken) {
        await sendDiscordMessage({
          integrationId: channel.id,
          channelId: worker.externalId,
          text: formatDiscordMessage(plainText),
        });
      }
      break;
    }
  }
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

/** Permanently removes the worker from the task (and cascades their submissions). */
export async function removeWorker(userId: string, taskId: string, workerId: string) {
  const task = await prisma.humanTask.findFirst({
    where: { id: taskId, userId },
    include: { taskChannel: true },
  });
  if (!task) throw new Error("Task not found or not owned by user");

  const worker = await prisma.humanWorker.findFirst({
    where: { id: workerId, humanTaskId: taskId },
    include: { taskChannel: true },
  });
  if (!worker) throw new Error("Worker not found");

  await prisma.humanWorker.delete({ where: { id: workerId } });

  const channel = worker.taskChannel ?? task.taskChannel;
  if (channel) {
    const text = buildRemovalMessageText(worker, task);
    await sendWorkerChannelMessage(worker, channel, text).catch((err) => {
      console.error(`[worker-removal] failed to notify worker ${workerId}:`, err);
    });
  }

  return { count: 1 };
}

/** Disable or re-enable a worker without removing them from the team list. */
export async function updateWorkerStatus(
  userId: string,
  taskId: string,
  workerId: string,
  status: "ACTIVE" | "INACTIVE"
) {
  const task = await prisma.humanTask.findFirst({
    where: { id: taskId, userId },
    include: { taskChannel: true },
  });
  if (!task) throw new Error("Task not found or not owned by user");

  const worker = await prisma.humanWorker.findFirst({
    where: { id: workerId, humanTaskId: taskId },
    include: { taskChannel: true },
  });
  if (!worker) throw new Error("Worker not found");

  await prisma.humanWorker.update({
    where: { id: workerId },
    data: { status },
  });

  const channel = worker.taskChannel ?? task.taskChannel;
  if (channel) {
    const text = status === "INACTIVE" ? buildDisableMessageText(worker, task) : buildEnableMessageText(worker, task);
    await sendWorkerChannelMessage(worker, channel, text).catch((err) => {
      console.error(`[worker-status] failed to notify worker ${workerId}:`, err);
    });
  }

  return { count: 1, workerName: worker.name };
}

export type WorkerLookupOptions = {
  /** When set, only workers tied to this support channel (task notification channel) are considered. */
  supportChannelId?: string;
  /** When set, only workers tied to this task channel are considered. */
  taskChannelId?: string;
  /**
   * Telegram: webhook may identify the user differently than the stored `externalId`
   * (e.g. admin pasted chat id vs `from.id`). Pass all known ids from the update.
   */
  additionalExternalIds?: string[];
};

/** All strings we should try to match against `HumanWorker.externalId` for Telegram. */
function buildTelegramExternalIdCandidates(primary: string, extras?: string[]): string[] {
  const out = new Set<string>();
  const add = (s: string | undefined) => {
    if (s === undefined || s === null) return;
    const t = String(s).trim();
    if (!t) return;
    out.add(t);
    if (t.startsWith("@")) out.add(t.slice(1));
  };
  add(primary);
  for (const e of extras ?? []) add(e);
  return [...out];
}

async function sendTelegramApiMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const formatted = formatTelegramMessage(text);
  const payload: Record<string, unknown> = {
    chat_id: /^\d+$/.test(String(chatId).trim()) ? Number(String(chatId).trim()) : chatId,
    text: formatted,
    parse_mode: "HTML",
  };
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data as { ok?: boolean }).ok === false) {
    const desc = (data as { description?: string }).description || response.statusText;
    // Retry as plain text if HTML parse failed (common with odd characters)
    if (String(desc).includes("parse") || String(desc).includes("entities")) {
      const plain = text.replace(/\*\*/g, "").replace(/^#{1,6}\s+/gm, "");
      const r2 = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: payload.chat_id,
          text: plain.slice(0, 4000),
        }),
      });
      const d2 = await r2.json().catch(() => ({}));
      if (!r2.ok || (d2 as { ok?: boolean }).ok === false) {
        throw new Error(
          `Telegram sendMessage failed: ${(d2 as { description?: string }).description || desc}`
        );
      }
      return;
    }
    throw new Error(`Telegram sendMessage failed: ${desc}`);
  }
}

/** Digits from a WhatsApp JID, phone field, or stored externalId. */
function extractWhatsAppDigits(s: string | null | undefined): string {
  if (!s) return "";
  const trimmed = String(s).trim();
  const jid = trimmed.match(/^(\d+)(?::\d+)?@/);
  if (jid) return jid[1];
  return trimmed.replace(/\D/g, "");
}

/** Variants of an incoming WhatsApp identifier to match stored `externalId`. */
function buildWhatsAppExternalIdCandidates(raw: string): string[] {
  const s = raw.trim();
  const out = new Set<string>([s]);
  const normalized = s.replace(/^(\d+):\d+(@[\w.]+)$/, "$1$2");
  if (normalized !== s) out.add(normalized);

  const jidMatch = normalized.match(/^(\d{6,})(?::\d+)?@([\w.]+)$/);
  if (jidMatch) {
    const d = jidMatch[1];
    const domain = jidMatch[2];
    out.add(`${d}@${domain}`);
    out.add(`${d}@s.whatsapp.net`);
    out.add(d);
    out.add(`+${d}`);
  }

  const onlyDigits = s.replace(/\D/g, "");
  if (onlyDigits.length >= 8) {
    out.add(onlyDigits);
    out.add(`+${onlyDigits}`);
    out.add(`${onlyDigits}@s.whatsapp.net`);
  }

  return [...out];
}

function whatsappDigitsLikelyMatch(incomingDigits: string, externalId: string, phone: string | null): boolean {
  if (incomingDigits.length < 8) return false;
  const ext = extractWhatsAppDigits(externalId);
  const ph = extractWhatsAppDigits(phone);
  for (const c of [ext, ph]) {
    if (!c) continue;
    if (c === incomingDigits) return true;
    if (c.length >= 10 && incomingDigits.length >= 10 && c.slice(-10) === incomingDigits.slice(-10)) {
      return true;
    }
  }
  return false;
}

/**
 * Find an active/onboarding human task worker by platform-specific external id.
 *
 * Lookup strategy:
 *   1. Scoped by taskChannelId or supportChannelId (exact + Telegram/WA variants)
 *   2. Scoped via task.reportChannelId / task.taskChannelId match (legacy workers with null channel)
 *   3. Unscoped fallback (any channel)
 */
export async function getWorkerByExternalId(
  platform: string,
  externalId: string,
  options?: WorkerLookupOptions
) {
  const include = {
    humanTask: { include: { taskChannel: true } },
    taskChannel: true,
  };

  const baseStatus = { in: ["ACTIVE", "ONBOARDING"] as const };
  const tag = `[WorkerLookup ${platform}]`;

  const allExternalIds = buildAllExternalIdCandidates(platform, externalId, options?.additionalExternalIds);

  // --- Helper: try findFirst with given where + each candidate set ---
  async function tryFind(where: Record<string, unknown>): Promise<any> {
    let w = await prisma.humanWorker.findFirst({ where: { ...where, externalId }, include });
    if (w) return w;
    if (allExternalIds.length > 0) {
      w = await prisma.humanWorker.findFirst({ where: { ...where, externalId: { in: allExternalIds } }, include });
      if (w) return w;
    }
    return null;
  }

  // --- 1. Scoped by task channel ---
  const scopedWhere: Record<string, unknown> = { platform, status: baseStatus };
  if (options?.taskChannelId) {
    scopedWhere.taskChannelId = options.taskChannelId;
  }

  let w = await tryFind(scopedWhere);
  if (w) {
    console.log(`${tag} Tier-1 scoped → ${w.id} (${w.name})`);
    return w;
  }

  // WhatsApp digit-level fuzzy (scoped)
  if (platform === "WHATSAPP" && options?.taskChannelId) {
    const incomingDigits = extractWhatsAppDigits(externalId);
    if (incomingDigits.length >= 8) {
      const workers = await prisma.humanWorker.findMany({ where: scopedWhere, include });
      for (const c of workers) {
        if (whatsappDigitsLikelyMatch(incomingDigits, c.externalId, c.phone)) {
          console.log(`${tag} Tier-1 WA fuzzy → ${c.id} (${c.name})`);
          return c;
        }
      }
    }
  }

  // --- 1b. Task channel: exactly one ONBOARDING worker (common when WhatsApp sends @lid but DB has phone number)
  if (platform === "WHATSAPP" && options?.taskChannelId) {
    const onboardingOnly = await prisma.humanWorker.findMany({
      where: {
        platform: "WHATSAPP",
        taskChannelId: options.taskChannelId,
        status: "ONBOARDING",
      },
      include,
    });
    if (onboardingOnly.length === 1) {
      console.log(`${tag} Tier-1b single ONBOARDING on task channel → ${onboardingOnly[0].id} (${onboardingOnly[0].name})`);
      return onboardingOnly[0];
    }
  }

  // --- 1c. Task channel: exactly one ACTIVE or ONBOARDING worker (JID vs phone mismatch after active)
  if (platform === "WHATSAPP" && options?.taskChannelId) {
    const soleWorker = await prisma.humanWorker.findMany({
      where: {
        platform: "WHATSAPP",
        taskChannelId: options.taskChannelId,
        status: { in: ["ACTIVE", "ONBOARDING"] as const },
      },
      include,
    });
    if (soleWorker.length === 1) {
      console.log(`${tag} Tier-1c single worker on task channel → ${soleWorker[0].id} (${soleWorker[0].name})`);
      return soleWorker[0];
    }
  }

  // --- 2. Legacy fallback: worker has no taskChannelId but task references the channel ---
  if (options?.taskChannelId) {
    const legacyWhere: Record<string, unknown> = {
      platform,
      status: baseStatus,
      taskChannelId: null,
      humanTask: { taskChannelId: options.taskChannelId },
    };
    w = await tryFind(legacyWhere);
    if (w) {
      console.log(`${tag} Tier-2 legacy → ${w.id} (${w.name})`);
      return w;
    }
  }

  // --- 3. Unscoped fallback ---
  const unscopedWhere = { platform, status: baseStatus };
  w = await tryFind(unscopedWhere);
  if (w) {
    console.log(`${tag} Tier-3 unscoped → ${w.id} (${w.name})`);
    return w;
  }

  console.log(`${tag} No worker found for externalId=${externalId}`);
  return null;
}

function buildAllExternalIdCandidates(platform: string, primary: string, extras?: string[]): string[] {
  if (platform === "TELEGRAM") {
    return buildTelegramExternalIdCandidates(primary, extras);
  }
  if (platform === "WHATSAPP") {
    const out = new Set<string>(buildWhatsAppExternalIdCandidates(primary));
    for (const e of extras ?? []) {
      if (!e || !String(e).trim()) continue;
      for (const v of buildWhatsAppExternalIdCandidates(String(e).trim())) {
        out.add(v);
      }
    }
    return [...out];
  }
  return [];
}

export async function activateWorker(workerId: string) {
  return prisma.humanWorker.update({
    where: { id: workerId },
    data: { status: "ACTIVE", onboardedAt: new Date() },
  });
}
