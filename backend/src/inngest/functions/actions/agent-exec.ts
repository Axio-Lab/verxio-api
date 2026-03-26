import { NodeExecutor } from "../types";
import { simpleAgentQuery } from "@/services/agent/agentService";
import { NonRetriableError } from "inngest";

interface AgentExecData {
  variables: string;
  objective: string;
  selectedSubagents?: string[];
  strategy?: "parallel" | "sequential" | "auto";
  maxTurns?: number;
  attachments?: Array<{
    fileId?: string;
    fileName?: string;
    fileType?: string;
    url?: string;
    base64?: string;
    extractedText?: string;
  }>;
}

async function loadRoster(
  userId: string
): Promise<Record<string, { name: string; description: string; prompt: string }>> {
  const { getActiveSubagents, loadSubagentWithSkills } =
    await import("@/services/customSubagentService");

  const BUILTINS: Record<string, { name: string; description: string; prompt: string }> = {
    "ops-researcher": {
      name: "Ops Researcher",
      description:
        "Research specialist for business operations, industry data, APIs, and documentation.",
      prompt:
        "You are a research specialist on Verxio. Gather accurate, detailed, actionable information. Always cite sources.",
    },
    "content-writer": {
      name: "Content Writer",
      description:
        "Content creation specialist for documents, reports, emails, marketing copy, and proposals.",
      prompt:
        "You are a professional content writer on Verxio. Produce polished, ready-to-use output.",
    },
    "data-analyst": {
      name: "Data Analyst",
      description: "Data analysis specialist for insights, comparisons, and analytical output.",
      prompt:
        "You are a data analyst on Verxio. Be precise with numbers and sources. Key takeaways first.",
    },
    "task-executor": {
      name: "Task Executor",
      description:
        "Action executor for creating documents, sending communications, and running integrations.",
      prompt:
        "You are a task executor on Verxio. Execute precisely what is asked. Report what was done.",
    },
  };

  const roster = { ...BUILTINS };

  try {
    const customs = await getActiveSubagents(userId);
    for (const custom of customs) {
      const loaded = await loadSubagentWithSkills(userId, custom.id);
      if (!loaded) continue;
      const skillSection = loaded.skillContent ? `\n\nSkills:\n${loaded.skillContent}` : "";
      roster[loaded.slug] = {
        name: loaded.name,
        description: loaded.description,
        prompt: `${loaded.prompt}${skillSection}`,
      };
    }
  } catch {
    // custom loading failed, proceed with builtins only
  }

  return roster;
}

export const agentExecExecutor: NodeExecutor = async ({ data, nodeId, context, step, userId }) => {
  const execData = data as unknown as AgentExecData;

  if (!execData.objective) throw new NonRetriableError("AGENT_EXEC: objective is required");

  const variableName = execData.variables || "agentExec";
  const maxTurns = execData.maxTurns || 10;
  const strategy = execData.strategy || "auto";

  const initialContext = Object.entries(context)
    .filter(([k]) => k !== "decider")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join("\n");

  const attachmentContext = (execData.attachments || [])
    .map((a) => {
      const parts = [`File: ${a.fileName || "unnamed"} (${a.fileType || "unknown"})`];
      if (a.extractedText) parts.push(`Content: ${a.extractedText}`);
      if (a.url) parts.push(`URL: ${a.url}`);
      return parts.join("\n");
    })
    .join("\n---\n");

  const result = await step.run(`agent-exec-${nodeId}`, async () => {
    if (!userId) throw new NonRetriableError("AGENT_EXEC: userId is required");

    const roster = await loadRoster(userId);
    const selected = execData.selectedSubagents?.length
      ? execData.selectedSubagents.filter((s) => roster[s])
      : Object.keys(roster);

    if (selected.length === 0) {
      throw new NonRetriableError("AGENT_EXEC: no matching subagents found");
    }

    const rosterDescription = selected
      .map((slug) => `- **${roster[slug].name}** (${slug}): ${roster[slug].description}`)
      .join("\n");

    const coordinatorPrompt = `You are the Agent Coordinator on Verxio's agent operations platform.

## Objective
${execData.objective}

## Available Agents
${rosterDescription}

## Upstream Context
${initialContext || "(none)"}

${attachmentContext ? `## Attached Files\n${attachmentContext}` : ""}

## Instructions
You must accomplish the objective by leveraging the available agents. Think step by step:
1. Break the objective into subtasks.
2. For each subtask, specify which agent should handle it.
3. Execute each subtask thoroughly.
4. Synthesize all outputs into a final, cohesive deliverable.

${strategy === "parallel" ? "Run independent subtasks in parallel where possible." : ""}

Produce a comprehensive final output that directly addresses the objective. Be thorough and actionable.`;

    const queryResult = await simpleAgentQuery({
      prompt: coordinatorPrompt,
      userId,
      maxTurns,
    });

    return queryResult.result || "No output produced.";
  });

  return {
    ...context,
    [variableName]: {
      result,
      objective: execData.objective,
      selectedSubagents: execData.selectedSubagents || [],
      strategy,
    },
  };
};
