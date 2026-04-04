import { inngest } from "../index";
import { NonRetriableError } from "inngest";
import { simpleAgentQuery } from "@/services/agent/agentService";
import * as goalService from "@/services/goalService";
import * as taskService from "@/services/agentTaskService";
import * as memoryService from "@/services/agentMemoryService";
import { deliverReport } from "@/services/goalReportService";
import { basePrismaClient } from "@/lib/prisma";

const prisma = basePrismaClient as any;

const BUILTIN_AGENT_ROLES = [
  '"ops-researcher" — research, data gathering, API lookups, industry analysis, documentation review',
  '"content-writer" — writing documents, reports, emails, proposals, SOPs, marketing copy',
  '"data-analyst" — data analysis, comparisons, spreadsheet creation, metrics, insights',
  '"task-executor" — concrete actions: creating docs via Composio, sending emails, API calls, integrations',
];

async function getAgentRolesDescription(userId: string): Promise<string> {
  const roles = [...BUILTIN_AGENT_ROLES];
  try {
    const { getActiveSubagents } = await import("@/services/customSubagentService");
    const customAgents = await getActiveSubagents(userId);
    for (const agent of customAgents) {
      roles.push(`"${agent.slug}" — ${agent.description}`);
    }
  } catch {
    // custom subagents not available, use built-in only
  }
  return roles.join("\n- ");
}

function buildUpstreamContext(
  dependsOn: string[],
  completedOutputs: Record<string, Record<string, unknown>>
): string {
  if (!dependsOn || dependsOn.length === 0) return "";
  const parts: string[] = [];
  for (const depId of dependsOn) {
    const output = completedOutputs[depId];
    if (output) {
      const summary = JSON.stringify(output).slice(0, 2000);
      parts.push(`[Output from upstream task ${depId}]:\n${summary}`);
    }
  }
  return parts.length > 0 ? `\nUpstream task outputs:\n${parts.join("\n\n")}` : "";
}

async function goalIsExecuting(goalId: string): Promise<boolean> {
  const g = await prisma.agentGoal.findUnique({
    where: { id: goalId },
    select: { status: true },
  });
  return g?.status === "EXECUTING";
}

async function executeGoalTask(
  task: any,
  userId: string,
  goalId: string,
  completedOutputs: Record<string, Record<string, unknown>>
): Promise<{ taskId: string; output: Record<string, unknown> }> {
  if (!(await goalIsExecuting(goalId))) {
    return { taskId: task.id, output: { aborted: true, reason: "goal_not_executing" } };
  }

  await taskService.updateTaskStatus(task.id, "IN_PROGRESS");

  try {
    const memoryContext = await memoryService.buildMemoryContext(userId, goalId);
    const upstreamContext = buildUpstreamContext(task.dependsOn || [], completedOutputs);
    const toolHint = task.tool ? `\nPrefer using tool: ${task.tool}` : "";

    const agentRole = task.assignedAgent || "task-executor";
    const prompt = `You are a specialized ${agentRole} agent on Verxio, an agent operations platform.
You are part of a team of AI agents working together to achieve a goal. You have access to all Verxio tools, Composio integrations, and subagents (both built-in and custom user-defined). Delegate to subagents when a subtask falls outside your specialty.
${memoryContext ? `\nContext from memory:\n${memoryContext}` : ""}${upstreamContext}${toolHint}

Complete the following task. Use the appropriate tools: Composio for app actions (GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN, GMAIL_SEND_EMAIL, etc.), WebSearch/WebFetch for research, browseWebsite for live web data.

Return your result as a JSON object: { "result": "...", "facts_learned": [{ "key": "...", "value": "..." }] }

Task: ${task.title}
Description: ${task.description || "No additional details"}
Input: ${task.input ? JSON.stringify(task.input) : "None"}`;

    const agentResult = await simpleAgentQuery({
      prompt,
      userId,
      maxTurns: 12,
    });

    const text = agentResult.result || "";
    let output: Record<string, unknown> = { rawResult: text };
    try {
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
      output = parsed;
      if (parsed.facts_learned) {
        for (const fact of parsed.facts_learned) {
          await memoryService.rememberFact(userId, {
            key: fact.key,
            value: fact.value,
            scope: "GOAL",
            goalId,
          });
        }
      }
    } catch {
      // raw text output is fine
    }

    if (!(await goalIsExecuting(goalId))) {
      await taskService.updateTaskStatus(task.id, "PENDING");
      return { taskId: task.id, output: { aborted: true, reason: "paused_or_stopped_during_run" } };
    }

    await taskService.updateTaskStatus(task.id, "COMPLETE", output);
    return { taskId: task.id, output };
  } catch (err: any) {
    if (await goalIsExecuting(goalId)) {
      await taskService.updateTaskStatus(task.id, "FAILED", undefined, err.message);
    } else {
      await taskService.updateTaskStatus(task.id, "PENDING");
    }
    return { taskId: task.id, output: { error: err.message } };
  }
}

export const goalDecompose = inngest.createFunction(
  {
    id: "goal-decompose",
    name: "Goal Decompose",
    onFailure: async ({ event }) => {
      const { goalId } = event.data.event.data;
      if (goalId) {
        try {
          await goalService.updateGoalStatus(goalId, "STOPPED");
        } catch {}
      }
    },
  },
  { event: "verxio/goal.decompose" },
  async ({ event, step }) => {
    const { goalId, userId } = event.data;

    const goal = await step.run("load-goal", async () => {
      return prisma.agentGoal.findUnique({ where: { id: goalId } });
    });
    if (!goal) throw new NonRetriableError("Goal not found");

    const memoryContext = await step.run("load-memory", async () => {
      return memoryService.buildMemoryContext(userId, goalId);
    });

    const agentRoles = await step.run("load-agent-roles", async () => {
      return getAgentRolesDescription(userId);
    });

    const decomposition = await step.run("decompose-with-claude", async () => {
      const agentResult = await simpleAgentQuery({
        prompt: `You are a task decomposition engine on Verxio, an agent operations platform. Given a high-level goal, break it into concrete sub-tasks that a team of specialized AI agents will execute in parallel where possible.

You have access to all Verxio tools, Composio integrations, and a team of subagents (both built-in and custom user-defined). When decomposing, assign each task to the most appropriate agent role and specify what tools each task might use.

Available agent roles (use these for assignedAgent):
- ${agentRoles}
${memoryContext ? `\nContext from memory:\n${memoryContext}` : ""}

Goal: ${goal.name}
Objective: ${goal.objective}

Return a JSON array of tasks:
[{ "title": "...", "description": "...", "assignedAgent": "ops-researcher|content-writer|data-analyst|task-executor", "tool": "optional_tool_name", "dependsOn": [] }]

Rules:
- dependsOn references the 0-based index of tasks this one depends on. Tasks with no dependencies will run in parallel.
- For tool, use specific Composio action names when applicable (e.g. GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN, GMAIL_SEND_EMAIL).
- Design tasks so independent ones can run concurrently. Only add dependencies when a task genuinely needs output from another.
- Keep tasks focused and actionable. Return ONLY the JSON array.`,
        userId,
        maxTurns: 10,
      });

      const text = agentResult.result || "";
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("No JSON array found");
        return JSON.parse(jsonMatch[0]);
      } catch {
        throw new NonRetriableError(`Failed to parse decomposition: ${text.slice(0, 500)}`);
      }
    });

    const taskIds = await step.run("create-tasks", async () => {
      const ids: string[] = [];
      for (const [idx, t] of decomposition.entries()) {
        const depIds = (t.dependsOn || []).map((depIdx: number) => ids[depIdx]).filter(Boolean);
        const task = await taskService.createTask(goalId, {
          title: t.title,
          description: t.description,
          assignedAgent: t.assignedAgent,
          tool: t.tool,
          dependsOn: depIds,
        });
        ids.push(task.id);
      }
      return ids;
    });

    await step.run("update-goal-status", async () => {
      await goalService.updateGoalStatus(goalId, "EXECUTING");
    });

    await step.run("fire-execute-next", async () => {
      await inngest.send({
        name: "verxio/goal.execute-next",
        data: { goalId, userId },
      });
    });

    return { taskIds };
  }
);

export const goalExecuteNext = inngest.createFunction(
  {
    id: "goal-execute-next",
    name: "Goal Execute Next Tasks",
    cancelOn: [{ event: "verxio/goal.paused", match: "data.goalId" }],
    onFailure: async ({ event }) => {
      const { goalId } = event.data.event.data;
      if (goalId) {
        try {
          await goalService.updateGoalStatus(goalId, "STOPPED");
        } catch {}
      }
    },
  },
  { event: "verxio/goal.execute-next" },
  async ({ event, step }) => {
    const { goalId, userId } = event.data;

    const goalStatus = await step.run("check-goal-status", async () => {
      const g = await prisma.agentGoal.findUnique({
        where: { id: goalId },
        select: { status: true },
      });
      return g?.status;
    });

    if (goalStatus === "PAUSED" || goalStatus === "STOPPED") {
      return { paused: true };
    }

    const nextTasks = await step.run("find-next-tasks", async () => {
      return taskService.getNextPendingTasks(goalId);
    });

    if (nextTasks.length === 0) {
      // All tasks done or blocked — run synthesis if all are complete
      await step.run("synthesize-goal", async () => {
        const goal = await prisma.agentGoal.findUnique({
          where: { id: goalId },
          include: { tasks: { orderBy: { createdAt: "asc" } } },
        });
        if (!goal) return;

        const allDone = goal.tasks.every((t: any) =>
          ["COMPLETE", "FAILED", "SKIPPED"].includes(t.status)
        );
        if (!allDone) return;

        const completedTasks = goal.tasks.filter((t: any) => t.status === "COMPLETE");
        if (completedTasks.length === 0) return;

        const taskSummaries = completedTasks
          .map((t: any) => {
            const outputStr = t.output ? JSON.stringify(t.output).slice(0, 1500) : "No output";
            return `- **${t.title}** (${t.assignedAgent || "agent"}): ${outputStr}`;
          })
          .join("\n");

        const synthResult = await simpleAgentQuery({
          prompt: `You are a goal coordinator on Verxio. A team of specialized agents has completed their tasks for the following goal. Synthesize their outputs into a cohesive summary and final deliverable.

Goal: ${goal.name}
Objective: ${goal.objective}

Completed task outputs:
${taskSummaries}

Produce a clear, actionable synthesis that:
1. Summarizes what was accomplished across all tasks
2. Highlights key findings, deliverables, or actions taken
3. Notes any gaps or follow-up items
4. Provides the final deliverable in a format appropriate to the goal

Return JSON: { "synthesis": "...", "deliverables": ["list of URLs, documents, or outputs created"], "followUps": ["any recommended next steps"] }`,
          userId,
          maxTurns: 5,
        });

        const text = synthResult.result || "";
        try {
          const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
          await memoryService.rememberFact(userId, {
            key: `goal-${goalId}-synthesis`,
            value: parsed.synthesis || text,
            scope: "GOAL",
            goalId,
          });
        } catch {
          await memoryService.rememberFact(userId, {
            key: `goal-${goalId}-synthesis`,
            value: text.slice(0, 2000),
            scope: "GOAL",
            goalId,
          });
        }
      });

      return { done: true };
    }

    // Load outputs from already-completed tasks so downstream tasks have context
    const completedOutputs: Record<string, Record<string, unknown>> = await step.run(
      "load-completed-outputs",
      async () => {
        const doneTasks = await prisma.agentTask.findMany({
          where: { goalId, status: "COMPLETE" },
          select: { id: true, output: true },
        });
        const map: Record<string, Record<string, unknown>> = {};
        for (const t of doneTasks) {
          if (t.output) map[t.id] = t.output as Record<string, unknown>;
        }
        return map;
      }
    );

    // Execute all ready tasks in parallel
    await step.run("execute-batch", async () => {
      const promises = nextTasks.map((task: any) =>
        executeGoalTask(task, userId, goalId, completedOutputs)
      );
      return Promise.all(promises);
    });

    // Re-check: fire another round if more tasks are now unblocked (only while still executing)
    await step.run("check-and-continue", async () => {
      const g = await prisma.agentGoal.findUnique({
        where: { id: goalId },
        select: { status: true },
      });
      if (g?.status !== "EXECUTING") return;
      await inngest.send({
        name: "verxio/goal.execute-next",
        data: { goalId, userId },
      });
    });
  }
);

export const approvalGate = inngest.createFunction(
  { id: "goal-approval-gate", name: "Goal Approval Gate" },
  { event: "verxio/goal.approval-requested" },
  async ({ event, step }) => {
    const { goalId, taskId, actionDescription, riskLevel, userId } = event.data;

    await step.run("notify-owner", async () => {
      const goal = await prisma.agentGoal.findUnique({
        where: { id: goalId },
        include: { reportingChannel: true },
      });
      if (goal?.reportingChannel) {
        const msg = `Approval Required\n\nGoal: ${goal.name}\nAction: ${actionDescription}\nRisk Level: ${riskLevel}\n\nPlease approve or reject this action from your dashboard.`;
        await deliverReport(goalId, goal.reportingChannelId);
        console.log("[ApprovalGate] Notification sent:", msg.slice(0, 100));
      }
      await goalService.updateGoalStatus(goalId, "AWAITING_APPROVAL");
      if (taskId) {
        await taskService.updateTaskStatus(taskId, "AWAITING_APPROVAL");
      }
    });

    const approval = await step.waitForEvent("wait-for-approval", {
      event: "verxio/goal.approval-responded",
      match: "data.goalId",
      timeout: "24h",
    });

    if (!approval || approval.data.decision === "reject") {
      await step.run("handle-rejection", async () => {
        if (taskId) {
          await taskService.updateTaskStatus(
            taskId,
            "FAILED",
            undefined,
            "Approval rejected or timed out"
          );
        }
        await goalService.updateGoalStatus(goalId, "FAILED");
      });
      return { approved: false };
    }

    await step.run("handle-approval", async () => {
      if (taskId) {
        await taskService.updateTaskStatus(taskId, "COMPLETE", { approved: true });
      }
      await goalService.updateGoalStatus(goalId, "EXECUTING");
      await inngest.send({
        name: "verxio/goal.execute-next",
        data: { goalId, userId },
      });
    });

    return { approved: true };
  }
);

export const goalReflect = inngest.createFunction(
  { id: "goal-reflect", name: "Goal Reflect" },
  { event: "verxio/goal.reflect" },
  async ({ event, step }) => {
    const { goalId, taskId, output, successCriteria, userId } = event.data;

    const decision = await step.run("evaluate-output", async () => {
      const agentResult = await simpleAgentQuery({
        prompt: `You are a quality evaluator on Verxio's agent operations platform. A specialized agent completed a task as part of a team goal. Evaluate the output against the success criteria and decide whether to ACCEPT, RETRY, or ESCALATE.

Task Output: ${JSON.stringify(output).slice(0, 3000)}

Success Criteria: ${successCriteria}

Return JSON: { "decision": "accept" | "retry" | "escalate", "reasoning": "..." }`,
        userId,
        maxTurns: 5,
      });

      const text = agentResult.result || "";
      try {
        return JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
      } catch {
        return { decision: "accept", reasoning: "Could not parse reflection" };
      }
    });

    await step.run("act-on-decision", async () => {
      switch (decision.decision) {
        case "accept":
          await taskService.updateTaskStatus(taskId, "COMPLETE", {
            ...output,
            reflectionAccepted: true,
          });
          await inngest.send({ name: "verxio/goal.execute-next", data: { goalId, userId } });
          break;
        case "retry": {
          const goal = await prisma.agentGoal.findUnique({ where: { id: goalId } });
          try {
            await taskService.retryTask(taskId, goal?.maxRetries ?? 3);
            await inngest.send({ name: "verxio/goal.execute-next", data: { goalId, userId } });
          } catch {
            await taskService.updateTaskStatus(
              taskId,
              "FAILED",
              undefined,
              "Max retries exceeded after reflection"
            );
            await goalService.updateGoalStatus(goalId, "FAILED");
          }
          break;
        }
        case "escalate":
          await taskService.updateTaskStatus(
            taskId,
            "FAILED",
            undefined,
            `Escalated: ${decision.reasoning}`
          );
          break;
      }
    });

    return decision;
  }
);

export const agentWatchFire = inngest.createFunction(
  { id: "agent-watch-fire", name: "Agent Watch Fire" },
  { event: "verxio/watch.fired" },
  async ({ event, step }) => {
    const { watchId, actionWorkflowId } = event.data;

    await step.run("update-last-fired", async () => {
      await prisma.agentWatch.update({
        where: { id: watchId },
        data: { lastFiredAt: new Date() },
      });
    });

    if (actionWorkflowId) {
      await step.run("trigger-workflow", async () => {
        await inngest.send({
          name: "workflow/trigger",
          data: { workflowId: actionWorkflowId },
        });
      });
    }
  }
);
