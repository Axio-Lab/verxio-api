import { basePrismaClient } from "@/lib/prisma";
import { updateGoalStatus } from "./goalService";

const prisma = basePrismaClient as any;

export interface AgentTaskCreateInput {
  title: string;
  description?: string;
  assignedAgent?: string;
  tool?: string;
  input?: Record<string, unknown>;
  dependsOn?: string[];
}

export async function createTask(goalId: string, data: AgentTaskCreateInput) {
  return prisma.agentTask.create({
    data: {
      goalId,
      title: data.title,
      description: data.description ?? null,
      assignedAgent: data.assignedAgent ?? null,
      tool: data.tool ?? null,
      input: data.input ?? null,
      dependsOn: data.dependsOn ?? [],
      status: "PENDING",
    },
  });
}

export async function updateTaskStatus(
  taskId: string,
  status: string,
  output?: Record<string, unknown>,
  blockerReason?: string
) {
  const task = await prisma.agentTask.update({
    where: { id: taskId },
    data: {
      status,
      output: output ?? undefined,
      blockerReason: blockerReason ?? null,
      ...(status === "PENDING" ? { startedAt: null, completedAt: null } : {}),
      ...(status === "IN_PROGRESS" ? { startedAt: new Date() } : {}),
      ...(status === "COMPLETE" || status === "FAILED" || status === "SKIPPED"
        ? { completedAt: new Date() }
        : {}),
    },
  });

  // Check if all tasks in the goal are done
  const allTasks = await prisma.agentTask.findMany({
    where: { goalId: task.goalId },
    select: { status: true },
  });

  const allDone = allTasks.every((t: { status: string }) =>
    ["COMPLETE", "FAILED", "SKIPPED"].includes(t.status)
  );
  const anyFailed = allTasks.some((t: { status: string }) => t.status === "FAILED");

  if (allDone) {
    await updateGoalStatus(task.goalId, anyFailed ? "FAILED" : "COMPLETE");
  } else if (status === "FAILED") {
    // Skip dependents that can never unblock due to a failed dependency
    const failedId = task.id;
    const pendingDependents = allTasks.filter(
      (t: { status: string; dependsOn: string[] }) =>
        t.status === "PENDING" && t.dependsOn.includes(failedId)
    );
    for (const dep of pendingDependents) {
      await updateTaskStatus(
        dep.id,
        "SKIPPED",
        undefined,
        `Skipped: dependency ${failedId} failed`
      );
    }
  }

  return task;
}

export async function getNextPendingTasks(goalId: string) {
  const goal = await prisma.agentGoal.findUnique({
    where: { id: goalId },
    select: { status: true },
  });
  if (goal?.status === "PAUSED" || goal?.status === "STOPPED") {
    return [];
  }

  const allTasks = await prisma.agentTask.findMany({
    where: { goalId },
  });

  const completedIds = new Set(
    allTasks
      .filter((t: { status: string; id: string }) => ["COMPLETE", "SKIPPED"].includes(t.status))
      .map((t: { id: string }) => t.id)
  );

  return allTasks.filter((t: { status: string; dependsOn: string[] }) => {
    if (t.status !== "PENDING") return false;
    return t.dependsOn.every((depId: string) => completedIds.has(depId));
  });
}

export async function retryTask(taskId: string, maxRetries: number) {
  const task = await prisma.agentTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  if (task.retries >= maxRetries) throw new Error("Max retries exceeded");

  return prisma.agentTask.update({
    where: { id: taskId },
    data: {
      status: "PENDING",
      retries: { increment: 1 },
      blockerReason: null,
    },
  });
}

export async function getGoalTasks(goalId: string) {
  return prisma.agentTask.findMany({
    where: { goalId },
    orderBy: { createdAt: "asc" },
  });
}
