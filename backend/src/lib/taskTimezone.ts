/**
 * IANA timezone helpers for human tasks (report windows, scheduling).
 * Mirrors the approach used in taskCronScheduler.ts (Intl + offset correction).
 */

function getOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+0";
  const m = tzPart.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2] || 0) * 60 + Number(m[3] || 0));
}

/** Local wall time in `timeZone` → UTC instant (same idea as taskCronScheduler.zonedWallTimeToUtc). */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const offsetMin = getOffsetMinutes(new Date(naiveUtcMs), timeZone);
  return new Date(naiveUtcMs - offsetMin * 60 * 1000);
}

/** Start (inclusive) and end (inclusive) UTC instants for the calendar day containing `anchor` in `timeZone`. */
export function getZonedDayBoundsUtc(
  anchor: Date,
  timeZone: string
): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(anchor);
  const y = Number(parts.find((p) => p.type === "year")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "month")?.value ?? 0);
  const d = Number(parts.find((p) => p.type === "day")?.value ?? 0);
  const start = zonedWallTimeToUtc(y, m, d, 0, 0, 0, timeZone);
  const end = zonedWallTimeToUtc(y, m, d, 23, 59, 59, timeZone);
  end.setMilliseconds(999);
  return { start, end };
}

/** Returns false if `timeZone` is not a valid IANA zone for Intl (Node will throw). */
export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
