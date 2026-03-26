import { basePrismaClient } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/services/whatsappConnectorClient";
import { sendDiscordMessage } from "@/services/discordConnectorClient";
import { AppError } from "@/middleware/errorHandler";
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

function normalizeWorkerCreateInput(data: WorkerCreateInput): WorkerCreateInput {
  const platform = String(data.platform || "")
    .trim()
    .toUpperCase();
  const name = String(data.name || "").trim();
  const externalRaw = String(data.externalId || "").trim();
  const phoneRaw = data.phone != null ? String(data.phone).trim() : "";
  const role = data.role != null ? String(data.role).trim() : "";

  if (!name) throw new AppError("Member name is required.", 400);
  if (!platform) throw new AppError("Platform is required.", 400);
  if (!externalRaw) throw new AppError("ID/phone is required.", 400);
  if (/\s/.test(externalRaw)) throw new AppError("ID/phone cannot contain spaces.", 400);
  if (phoneRaw && /\s/.test(phoneRaw))
    throw new AppError("Phone number cannot contain spaces.", 400);

  let externalId = externalRaw;
  let phone = phoneRaw || undefined;

  if (platform === "WHATSAPP") {
    // Accept +digits, digits, or full JID; reject whitespace and malformed values.
    const jid = externalRaw.replace(/:.*@/, "@");
    if (/@/.test(jid)) {
      if (!/^\d{7,20}@(s\.whatsapp\.net|lid)$/.test(jid)) {
        throw new AppError("WhatsApp ID must be a valid phone number or JID.", 400);
      }
      externalId = jid;
      if (!phone && jid.endsWith("@s.whatsapp.net")) {
        phone = `+${jid.replace(/@s\.whatsapp\.net$/, "")}`;
      }
    } else {
      const digits = externalRaw.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 20) {
        throw new AppError("WhatsApp number must be 7-20 digits.", 400);
      }
      externalId = `+${digits}`;
      phone = phone || `+${digits}`;
    }
  } else if (platform === "TELEGRAM") {
    if (!/^-?\d{4,20}$/.test(externalRaw)) {
      throw new AppError("Telegram chat/user ID must be numeric.", 400);
    }
    externalId = externalRaw;
  } else if (platform === "SLACK") {
    if (!/^[A-Za-z0-9_-]{6,40}$/.test(externalRaw)) {
      throw new AppError("Slack ID format is invalid.", 400);
    }
  } else if (platform === "DISCORD") {
    if (!/^\d{6,30}$/.test(externalRaw)) {
      throw new AppError("Discord user ID must be numeric.", 400);
    }
  }

  if (phone) {
    const pDigits = phone.replace(/\D/g, "");
    if (pDigits.length < 7 || pDigits.length > 20) {
      throw new AppError("Phone number must be 7-20 digits.", 400);
    }
    phone = `+${pDigits}`;
  }

  return {
    ...data,
    platform,
    name,
    externalId,
    phone,
    role: role || undefined,
  };
}

export async function addWorker(userId: string, taskId: string, data: WorkerCreateInput) {
  const normalized = normalizeWorkerCreateInput(data);

  const task = await prisma.humanTask.findFirst({
    where: { id: taskId, userId },
  });
  if (!task) throw new Error("Task not found or not owned by user");
  if (!task.taskChannelId) {
    throw new Error(
      "This task has no notification channel. Add one in the Channels tab before inviting members."
    );
  }

  // Auto-derive phone from externalId when not explicitly provided (WhatsApp workers are
  // often added with just the phone number as externalId, e.g. "+2348131958146").
  let phone = normalized.phone ?? null;
  if (!phone && normalized.externalId) {
    const digits = normalized.externalId.replace(/\D/g, "");
    if (digits.length >= 8) {
      phone = normalized.externalId.startsWith("+") ? normalized.externalId : `+${digits}`;
    }
  }

  const worker = await prisma.humanWorker.create({
    data: {
      humanTaskId: taskId,
      name: normalized.name,
      phone,
      platform: normalized.platform,
      externalId: normalized.externalId,
      role: normalized.role ?? null,
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
        "When a check-in is due, take a LIVE photo using the camera button in this chat.",
        "Important: You must take the photo right now — uploading photos from your gallery or files will NOT be accepted. We need real-time proof that the work is done.",
      ];
    case "TEXT":
      return [
        "When a check-in is due, type and send a text message here confirming you completed the work.",
      ];
    case "PHOTO_AND_TEXT":
      return [
        "When a check-in is due, take a LIVE photo using the camera button in this chat and add a short caption or follow-up message.",
        "Important: You must take the photo right now — uploading photos from your gallery or files will NOT be accepted.",
      ];
    case "DOCUMENT":
      return [
        "When a check-in is due, send a document or file here (for example a PDF, spreadsheet, or scanned report). You can upload from your device.",
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
    const text =
      status === "INACTIVE"
        ? buildDisableMessageText(worker, task)
        : buildEnableMessageText(worker, task);
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
  /** Optional sender display name (e.g. WhatsApp pushName) for disambiguation. */
  senderName?: string;
};

function normalizeNameForMatch(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function nameTokens(name: string): string[] {
  return String(name || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function namesLikelySame(a: string, b: string): boolean {
  const na = normalizeNameForMatch(a);
  const nb = normalizeNameForMatch(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;

  // Handle concatenated swapped order, e.g. "uzoezieemmanuel" vs "Emmanuel Uzoezie".
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length >= 2) {
    const forwardA = ta.join("");
    const reverseA = [...ta].reverse().join("");
    if (nb === forwardA || nb === reverseA || nb.includes(forwardA) || nb.includes(reverseA)) {
      return true;
    }
  }
  if (tb.length >= 2) {
    const forwardB = tb.join("");
    const reverseB = [...tb].reverse().join("");
    if (na === forwardB || na === reverseB || na.includes(forwardB) || na.includes(reverseB)) {
      return true;
    }
  }

  // Handle swapped order / partial token overlap (e.g. "uzoezieemmanuel" vs "Emmanuel Uzoezie")
  if (!ta.length || !tb.length) return false;
  const sb = new Set(tb);
  let overlap = 0;
  for (const t of ta) {
    if (sb.has(t)) overlap += 1;
  }
  return overlap >= Math.min(2, Math.min(ta.length, tb.length));
}

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

async function sendTelegramApiMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<void> {
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

function whatsappDigitsLikelyMatch(
  incomingDigits: string,
  externalId: string,
  phone: string | null
): boolean {
  if (incomingDigits.length < 8) return false;
  const ext = extractWhatsAppDigits(externalId);
  const ph = extractWhatsAppDigits(phone);
  for (const c of [ext, ph]) {
    if (!c) continue;
    if (c === incomingDigits) return true;
    if (
      c.length >= 10 &&
      incomingDigits.length >= 10 &&
      c.slice(-10) === incomingDigits.slice(-10)
    ) {
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

  const allExternalIds = buildAllExternalIdCandidates(
    platform,
    externalId,
    options?.additionalExternalIds
  );

  // Phone-number formatted candidates (for matching against worker.phone column)
  const phoneCandidates: string[] = [];
  for (const c of [externalId, ...(options?.additionalExternalIds ?? [])]) {
    const d = extractWhatsAppDigits(c);
    if (d.length >= 8) {
      phoneCandidates.push(d, `+${d}`);
    }
  }

  // --- Helper: try findFirst with given where + each candidate set ---
  async function tryFind(where: Record<string, unknown>): Promise<any> {
    let w = await prisma.humanWorker.findFirst({ where: { ...where, externalId }, include });
    if (w) return w;
    if (allExternalIds.length > 0) {
      w = await prisma.humanWorker.findFirst({
        where: { ...where, externalId: { in: allExternalIds } },
        include,
      });
      if (w) return w;
    }
    // Also match by phone column (covers WhatsApp @lid JIDs where digits ≠ phone number)
    if (phoneCandidates.length > 0) {
      w = await prisma.humanWorker.findFirst({
        where: { ...where, phone: { in: phoneCandidates } },
        include,
      });
      if (w) return w;
    }
    return null;
  }

  function matched(worker: any): any {
    backfillWorkerPhone(worker);
    return worker;
  }

  // --- 1. Scoped by task channel (same platform) ---
  const scopedWhere: Record<string, unknown> = { platform, status: baseStatus };
  if (options?.taskChannelId) {
    scopedWhere.taskChannelId = options.taskChannelId;
  }

  let w = await tryFind(scopedWhere);
  if (w) return matched(w);

  // WhatsApp digit-level fuzzy (scoped — checks worker.phone too)
  if (platform === "WHATSAPP" && options?.taskChannelId) {
    const incomingDigits = extractWhatsAppDigits(externalId);
    if (incomingDigits.length >= 8) {
      const workers = await prisma.humanWorker.findMany({ where: scopedWhere, include });
      for (const c of workers) {
        if (whatsappDigitsLikelyMatch(incomingDigits, c.externalId, c.phone)) {
          return matched(c);
        }
      }
    }
  }

  // --- 1a. Task channel platform-agnostic: worker may have been stored with a different platform
  // (e.g. TELEGRAM) but is on a WhatsApp task channel. The task channel scoping is sufficient.
  if (options?.taskChannelId) {
    const anyPlatformWhere: Record<string, unknown> = {
      status: baseStatus,
      taskChannelId: options.taskChannelId,
    };
    w = await tryFind(anyPlatformWhere);
    if (w) return matched(w);

    // Digit-level fuzzy across all platforms on this channel
    const incomingDigits = extractWhatsAppDigits(externalId);
    if (incomingDigits.length >= 8) {
      const allOnChannel = await prisma.humanWorker.findMany({ where: anyPlatformWhere, include });
      for (const c of allOnChannel) {
        if (whatsappDigitsLikelyMatch(incomingDigits, c.externalId, c.phone)) {
          return matched(c);
        }
      }
    }
  }

  // --- 1b. Task channel: exactly one ONBOARDING worker (any platform; common @lid vs phone mismatch)
  if (options?.taskChannelId) {
    const onboardingOnly = await prisma.humanWorker.findMany({
      where: {
        taskChannelId: options.taskChannelId,
        status: "ONBOARDING",
      },
      include,
    });
    if (onboardingOnly.length === 1) {
      return matched(onboardingOnly[0]);
    }
  }

  // --- 1c. Task channel: exactly one ACTIVE or ONBOARDING worker (any platform; JID mismatch after active)
  if (options?.taskChannelId) {
    const soleWorker = await prisma.humanWorker.findMany({
      where: {
        taskChannelId: options.taskChannelId,
        status: { in: ["ACTIVE", "ONBOARDING"] as const },
      },
      include,
    });
    if (soleWorker.length === 1) {
      return matched(soleWorker[0]);
    }
    if (soleWorker.length > 1) {
      // --- 1d. Task channel: disambiguate by sender display name (WhatsApp pushName, etc.)
      const senderNorm = normalizeNameForMatch(options?.senderName || "");
      if (senderNorm) {
        const byName = soleWorker.filter((sw: any) => {
          return namesLikelySame(sw.name || "", options?.senderName || "");
        });
        if (byName.length === 1) {
          return matched(byName[0]);
        }
      }
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
    if (w) return matched(w);
  }

  // --- 3. Unscoped fallback ---
  const unscopedWhere = { platform, status: baseStatus };
  w = await tryFind(unscopedWhere);
  if (w) return matched(w);

  return null;
}

/** When a worker is matched but has no phone stored, derive it from externalId and persist. */
function backfillWorkerPhone(worker: any): void {
  if (worker.phone) return;
  const digits = (worker.externalId || "").replace(/\D/g, "");
  if (digits.length >= 8) {
    const phone = worker.externalId.startsWith("+") ? worker.externalId : `+${digits}`;
    prisma.humanWorker.update({ where: { id: worker.id }, data: { phone } }).catch(() => {});
    worker.phone = phone;
  }
}

function buildAllExternalIdCandidates(
  platform: string,
  primary: string,
  extras?: string[]
): string[] {
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
