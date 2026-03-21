import { inngest } from "../index";
import { NonRetriableError } from "inngest";
import { simpleAgentQuery } from "@/services/agent/agentService";
import * as goalService from "@/services/goalService";
import * as taskService from "@/services/agentTaskService";
import * as memoryService from "@/services/agentMemoryService";
import { deliverReport } from "@/services/goalReportService";
import { basePrismaClient } from "@/lib/prisma";

const prisma = basePrismaClient as any;

export const goalDecompose = inngest.createFunction(
  { id: "goal-decompose", name: "Goal Decompose" },
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

    const decomposition = await step.run("decompose-with-claude", async () => {
      const agentResult = await simpleAgentQuery({
        prompt: `You are a task decomposition engine. Given a high-level goal, break it into concrete sub-tasks with dependencies.
You have access to all Verxio tools and Composio integrations. When decomposing, consider what tools (Composio actions, workflows, etc.) each sub-task might use.
${memoryContext ? `\nContext from memory:\n${memoryContext}` : ""}

Goal: ${goal.name}
Objective: ${goal.objective}

Return a JSON array of tasks:
[{ "title": "...", "description": "...", "assignedAgent": "AgentRole", "tool": "optional_tool_name", "dependsOn": [] }]

dependsOn should reference the 0-based index of tasks this one depends on. For tool, use specific Composio action names when applicable (e.g. GOOGLEDOCS_CREATE_DOCUMENT, GMAIL_SEND_EMAIL). Keep tasks focused and actionable. Return ONLY the JSON array.`,
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
  { id: "goal-execute-next", name: "Goal Execute Next Tasks" },
  { event: "verxio/goal.execute-next" },
  async ({ event, step }) => {
    const { goalId, userId } = event.data;

    const nextTasks = await step.run("find-next-tasks", async () => {
      return taskService.getNextPendingTasks(goalId);
    });

    if (nextTasks.length === 0) return { done: true };

    for (const task of nextTasks) {
      await step.run(`execute-task-${task.id}`, async () => {
        await taskService.updateTaskStatus(task.id, "IN_PROGRESS");

        try {
          const memoryContext = await memoryService.buildMemoryContext(userId, goalId);
          const toolHint = task.tool
            ? `\nYou have access to all Verxio tools and Composio integrations. Prefer using tool: ${task.tool}`
            : "\nYou have access to all Verxio tools and Composio integrations (Google Docs, Sheets, etc.). Use them when appropriate.";

          const prompt = `You are ${task.assignedAgent || "a task execution agent"}.
${memoryContext ? `\nContext from memory:\n${memoryContext}` : ""}
${toolHint}

Complete the following task. If the task involves creating a document, report, or spreadsheet, use the appropriate Composio tool (e.g. GOOGLEDOCS_CREATE_DOCUMENT, GOOGLESHEETS_CREATE_SPREADSHEET).

Return your result as a JSON object: { "result": "...", "facts_learned": [{ "key": "...", "value": "..." }] }

Task: ${task.title}
Description: ${task.description || "No additional details"}
Input: ${task.input ? JSON.stringify(task.input) : "None"}`;

          const agentResult = await simpleAgentQuery({
            prompt,
            userId,
            maxTurns: 10,
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
            // raw text output
          }

          await taskService.updateTaskStatus(task.id, "COMPLETE", output);
        } catch (err: any) {
          await taskService.updateTaskStatus(task.id, "FAILED", undefined, err.message);
        }
      });
    }

    await step.run("check-and-continue", async () => {
      const goal = await prisma.agentGoal.findUnique({
        where: { id: goalId },
        include: { tasks: true },
      });
      const allDone = goal.tasks.every((t: any) =>
        ["COMPLETE", "FAILED", "SKIPPED"].includes(t.status)
      );
      if (!allDone) {
        await inngest.send({
          name: "verxio/goal.execute-next",
          data: { goalId, userId },
        });
      }
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
          await taskService.updateTaskStatus(taskId, "FAILED", undefined, "Approval rejected or timed out");
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
        prompt: `You are a quality evaluator. Given a task output and success criteria, decide whether to ACCEPT, RETRY, or ESCALATE.
You have access to all tools. If the output needs improvement, you can suggest specific tools or Composio actions to use on retry.

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
          await taskService.updateTaskStatus(taskId, "COMPLETE", { ...output, reflectionAccepted: true });
          await inngest.send({ name: "verxio/goal.execute-next", data: { goalId, userId } });
          break;
        case "retry": {
          const goal = await prisma.agentGoal.findUnique({ where: { id: goalId } });
          try {
            await taskService.retryTask(taskId, goal?.maxRetries ?? 3);
            await inngest.send({ name: "verxio/goal.execute-next", data: { goalId, userId } });
          } catch {
            await taskService.updateTaskStatus(taskId, "FAILED", undefined, "Max retries exceeded after reflection");
            await goalService.updateGoalStatus(goalId, "FAILED");
          }
          break;
        }
        case "escalate":
          await taskService.updateTaskStatus(taskId, "FAILED", undefined, `Escalated: ${decision.reasoning}`);
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
