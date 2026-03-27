/**
 * Task scheduler service.
 *
 * All scheduling (reminders, grace checks, report generation) is now
 * handled by the in-process cron scheduler (taskCronScheduler.ts).
 *
 * Only legacy no-op exports remain for backward compatibility.
 */

/**
 * scheduleGracePeriodCheck is a no-op — grace checks are now handled by the
 * in-process cron scheduler. Kept as export so existing callers don't break.
 */
export async function scheduleGracePeriodCheck(
  _submissionId: string,
  _dueAt: Date,
  _graceMinutes: number
) {
  // No-op: grace period checks are now driven by the cron scheduler polling
  // PENDING submissions past their dueAt + graceMinutes.
}
