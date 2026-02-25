import { prisma } from "../lib/prisma";

const db = prisma as any;

const MANUAL_TIME_ESTIMATES_MS: Record<string, number> = {
  GMAIL: 2 * 60 * 1000,
  GOOGLE_SHEETS: 1 * 60 * 1000,
  GOOGLE_DOCS: 3 * 60 * 1000,
  GOOGLE_SLIDES: 5 * 60 * 1000,
  GOOGLE_DRIVE: 1 * 60 * 1000,
  GOOGLE_CALENDAR: 1 * 60 * 1000,
  GOOGLE_MEET: 2 * 60 * 1000,
  AIRTABLE: 1 * 60 * 1000,
  SLACK: 1 * 60 * 1000,
  DISCORD: 1 * 60 * 1000,
  TELEGRAM: 1 * 60 * 1000,
  WHATSAPP: 1 * 60 * 1000,
  HTTP_REQUEST: 2 * 60 * 1000,
  CODE_BLOCK: 5 * 60 * 1000,
  DESIGN: 15 * 60 * 1000,
  DESIGN_PRO: 20 * 60 * 1000,
  VEO: 30 * 60 * 1000,
  REMOTION: 20 * 60 * 1000,
  ANTHROPIC: 5 * 60 * 1000,
  GEMINI: 5 * 60 * 1000,
  OPENAI: 5 * 60 * 1000,
  STRAPI: 10 * 60 * 1000,
  COMPOSIO_ACTION: 3 * 60 * 1000,
  AGENT_TEAM: 30 * 60 * 1000,
};

const DEFAULT_MANUAL_TIME_MS = 2 * 60 * 1000;

export async function getAnalyticsDashboard(userId: string, hourlyRate: number = 50) {
  const workflows: Array<{ id: string; name: string; nodes: any[] }> = await db.workflow.findMany({
    where: { userId },
    select: { id: true, name: true, nodes: { select: { type: true } } },
  });

  const workflowIds = workflows.map((w: any) => w.id);
  if (workflowIds.length === 0) {
    return {
      totalTimeSavedMs: 0,
      totalMoneySaved: 0,
      totalExecutions: 0,
      successRate: 100,
      workflows: [],
      executionsByDay: [],
    };
  }

  const executions = await db.executionHistory.findMany({
    where: { workflowId: { in: workflowIds } },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const workflowMap = new Map(workflows.map((w: any) => [w.id, w]));

  let totalTimeSavedMs = 0;
  let successCount = 0;
  const workflowStats = new Map<
    string,
    { executions: number; timeSavedMs: number; successCount: number }
  >();
  const dayBuckets = new Map<string, number>();

  for (const exec of executions) {
    const wf = workflowMap.get(exec.workflowId);
    if (!wf) continue;

    const stats = workflowStats.get(exec.workflowId) || {
      executions: 0,
      timeSavedMs: 0,
      successCount: 0,
    };
    stats.executions++;

    if (exec.success) {
      stats.successCount++;
      successCount++;
    }

    // Estimate manual time from node types
    const nodes: any[] = wf.nodes || [];
    let manualTimeMs = 0;
    for (const node of nodes) {
      manualTimeMs += MANUAL_TIME_ESTIMATES_MS[node.type] || DEFAULT_MANUAL_TIME_MS;
    }

    const timeSaved = Math.max(0, manualTimeMs - (exec.duration || 0));
    stats.timeSavedMs += timeSaved;
    totalTimeSavedMs += timeSaved;

    workflowStats.set(exec.workflowId, stats);

    const day = new Date(exec.createdAt).toISOString().split("T")[0];
    dayBuckets.set(day, (dayBuckets.get(day) || 0) + 1);
  }

  const totalExecutions = executions.length;
  const totalMoneySaved = (totalTimeSavedMs / (1000 * 60 * 60)) * hourlyRate;

  const workflowAnalytics = Array.from(workflowStats.entries())
    .map(([wfId, stats]) => {
      const wf = workflowMap.get(wfId);
      return {
        workflowId: wfId,
        name: wf?.name || "Unknown",
        executions: stats.executions,
        timeSavedMs: stats.timeSavedMs,
        moneySaved: (stats.timeSavedMs / (1000 * 60 * 60)) * hourlyRate,
        successRate:
          stats.executions > 0 ? Math.round((stats.successCount / stats.executions) * 100) : 0,
      };
    })
    .sort((a, b) => b.timeSavedMs - a.timeSavedMs);

  const executionsByDay = Array.from(dayBuckets.entries())
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-30);

  return {
    totalTimeSavedMs,
    totalMoneySaved: Math.round(totalMoneySaved * 100) / 100,
    totalExecutions,
    successRate: totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 100,
    workflows: workflowAnalytics,
    executionsByDay,
  };
}

export async function generateAIInsight(userId: string): Promise<string> {
  const dashboard = await getAnalyticsDashboard(userId);

  if (dashboard.totalExecutions === 0) {
    return "No workflow executions yet. Start automating to see insights!";
  }

  const timeSavedHours = Math.round((dashboard.totalTimeSavedMs / (1000 * 60 * 60)) * 10) / 10;
  const topWorkflows = dashboard.workflows.slice(0, 3);

  let insight = `**Weekly Automation Summary**\n\n`;
  insight += `You've run ${dashboard.totalExecutions} workflow executions saving approximately ${timeSavedHours} hours ($${dashboard.totalMoneySaved}).\n\n`;
  insight += `Success rate: ${dashboard.successRate}%\n\n`;

  if (topWorkflows.length > 0) {
    insight += `**Top workflows:**\n`;
    for (const wf of topWorkflows) {
      const hrs = Math.round((wf.timeSavedMs / (1000 * 60 * 60)) * 10) / 10;
      insight += `- ${wf.name}: ${wf.executions} runs, ~${hrs}h saved\n`;
    }
  }

  if (dashboard.successRate < 90) {
    insight += `\n**Recommendation:** Your success rate is below 90%. Consider reviewing failing workflows to improve reliability.`;
  }

  return insight;
}
