import { NodeExecutor } from "../types";
import { simpleAgentQuery } from "@/services/agent/agentService";
import { NonRetriableError } from "inngest";

interface AgentConfig {
  name: string;
  role: string;
  personality?: string;
  knowledgeBaseId?: string;
  workflowId?: string;
  tools?: string[];
}

interface AgentTeamData {
  variables: string;
  objective: string;
  strategy: "sequential" | "parallel" | "supervisor";
  agents: AgentConfig[];
  maxRounds?: number;
}

async function runSubAgent(
  agent: AgentConfig,
  objective: string,
  inputContext: string,
  userId: string
): Promise<string> {
  let systemContext = `You are ${agent.name}, a ${agent.role}.`;
  if (agent.personality) systemContext += `\n\n${agent.personality}`;

  // Add KB context if linked
  if (agent.knowledgeBaseId) {
    try {
      const { searchKnowledge } = await import("@/services/knowledgeBaseService");
      const chunks = await searchKnowledge(agent.knowledgeBaseId, objective, 3);
      if (chunks.length > 0) {
        systemContext += "\n\nRelevant knowledge:\n" + chunks.map((c) => c.content).join("\n---\n");
      }
    } catch {
      // KB search failed
    }
  }

  const prompt = `${systemContext}\n\nObjective: ${objective}\n\nInput context:\n${inputContext}\n\nProvide your output for this task.`;

  const result = await simpleAgentQuery({
    prompt,
    userId,
    workflowId: agent.workflowId,
    maxTurns: 5,
    traceType: "agent_team_sub",
  });

  return result.result || "No output from agent.";
}

async function executeSequential(
  agents: AgentConfig[],
  objective: string,
  userId: string,
  initialContext: string
): Promise<string> {
  let context = initialContext;

  for (const agent of agents) {
    const result = await runSubAgent(agent, objective, context, userId);
    context = `[${agent.name} (${agent.role}) output]:\n${result}\n\n${context}`;
  }

  return context;
}

async function executeParallel(
  agents: AgentConfig[],
  objective: string,
  userId: string,
  initialContext: string
): Promise<string> {
  const results = await Promise.all(
    agents.map((agent) => runSubAgent(agent, objective, initialContext, userId))
  );

  return agents
    .map((agent, i) => `[${agent.name} (${agent.role}) output]:\n${results[i]}`)
    .join("\n\n---\n\n");
}

async function executeSupervisor(
  agents: AgentConfig[],
  objective: string,
  userId: string,
  initialContext: string,
  maxRounds: number
): Promise<string> {
  let aggregatedResults = initialContext;

  for (let round = 0; round < maxRounds; round++) {
    // Supervisor decides which agents to run
    const supervisorPrompt = `You are a supervisor agent orchestrating a team.

Objective: ${objective}

Available agents:
${agents.map((a, i) => `${i}. ${a.name} (${a.role})`).join("\n")}

Current results:
${aggregatedResults}

${round === 0 ? "This is the first round. Delegate the task to the appropriate agents." : "Review the results and decide if the objective is met."}

Respond with ONLY a JSON object:
{"done": true/false, "delegations": [{"agentIndex": 0, "task": "specific task"}], "finalOutput": "only if done=true"}`;

    const supervisorResult = await simpleAgentQuery({
      prompt: supervisorPrompt,
      userId,
      maxTurns: 3,
      traceType: "agent_team_supervisor",
    });

    const responseText = supervisorResult.result || "";
    let parsed: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { done: true, finalOutput: responseText };
    } catch {
      parsed = { done: true, finalOutput: responseText };
    }

    if (parsed.done) {
      return parsed.finalOutput || aggregatedResults;
    }

    // Execute delegated tasks
    const delegations = parsed.delegations || [];
    for (const delegation of delegations) {
      const agent = agents[delegation.agentIndex];
      if (!agent) continue;
      const result = await runSubAgent(
        agent,
        delegation.task || objective,
        aggregatedResults,
        userId
      );
      aggregatedResults += `\n\n[${agent.name} round ${round + 1}]:\n${result}`;
    }
  }

  return aggregatedResults;
}

export const agentTeamExecutor: NodeExecutor = async ({ data, nodeId, context, step, userId }) => {
  const teamData = data as unknown as AgentTeamData;

  if (!teamData.objective) throw new NonRetriableError("AGENT_TEAM: objective is required");
  if (!teamData.agents || teamData.agents.length === 0)
    throw new NonRetriableError("AGENT_TEAM: at least one agent is required");

  const strategy = teamData.strategy || "sequential";
  const maxRounds = teamData.maxRounds || 5;
  const variableName = teamData.variables || "agentTeam";

  // Build initial context from upstream nodes
  const initialContext = Object.entries(context)
    .filter(([k]) => k !== "decider")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join("\n");

  const result = await step.run(`agent-team-${nodeId}`, async () => {
    switch (strategy) {
      case "sequential":
        return executeSequential(teamData.agents, teamData.objective, userId!, initialContext);
      case "parallel":
        return executeParallel(teamData.agents, teamData.objective, userId!, initialContext);
      case "supervisor":
        return executeSupervisor(
          teamData.agents,
          teamData.objective,
          userId!,
          initialContext,
          maxRounds
        );
      default:
        return executeSequential(teamData.agents, teamData.objective, userId!, initialContext);
    }
  });

  return {
    ...context,
    [variableName]: {
      result,
      strategy,
      agentCount: teamData.agents.length,
      objective: teamData.objective,
    },
  };
};
