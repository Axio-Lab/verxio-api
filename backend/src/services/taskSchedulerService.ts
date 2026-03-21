import { inngest } from "@/inngest/index";
import { basePrismaClient } from "@/lib/prisma";

const prisma = basePrismaClient as any;

export async function scheduleTaskReminder(taskId: string, dueAt: Date) {
  await inngest.send({
    name: "verxio/task.reminder",
    data: { taskId, dueAt: dueAt.toISOString() },
  });
}

export async function scheduleGracePeriodCheck(
  submissionId: string,
  dueAt: Date,
  graceMinutes: number
) {
  const checkAt = new Date(dueAt.getTime() + graceMinutes * 60 * 1000);
  await inngest.send({
    name: "verxio/task.grace-check",
    data: { submissionId, checkAt: checkAt.toISOString() },
  });
}

export async function scheduleDailyReport(taskId: string, reportTime: string) {
  await inngest.send({
    name: "verxio/task.daily-report",
    data: { taskId, reportTime },
  });
}

export async function scheduleAllActiveTaskReminders() {
  const tasks = await prisma.humanTask.findMany({
    where: { status: "ACTIVE" },
    include: { workers: { where: { status: "ACTIVE" } } },
  });

  const now = new Date();

  for (const task of tasks) {
    if (task.workers.length === 0) continue;

    const scheduledTimes = Array.isArray(task.scheduledTimes) ? task.scheduledTimes : [];

    for (const timeStr of scheduledTimes) {
      const [hours, minutes] = (timeStr as string).split(":").map(Number);
      const dueAt = new Date(now);
      dueAt.setHours(hours, minutes, 0, 0);

      if (dueAt > now) {
        await scheduleTaskReminder(task.id, dueAt);
      }
    }
  }
}
