import { NodeExecutor } from "../types";
import { simpleAgentQuery } from "@/services/agent/agentService";
import { inngest } from "@/inngest/index";

export const reflectExecutor: NodeExecutor = async ({ data, context, userId }) => {
  const successCriteria = (data as any).successCriteria || "Output should be complete and accurate";
  const previousOutput = context;

  const agentResult = await simpleAgentQuery({
    prompt: `You are a quality evaluator. Given a task output and success criteria, decide whether to accept, retry, or escalate.
You have access to all tools. If evaluation requires checking external sources, use them.

Task Output: ${JSON.stringify(previousOutput).slice(0, 3000)}

Success Criteria: ${successCriteria}

Return JSON: { "decision": "accept" | "retry" | "escalate", "reasoning": "..." }`,
    userId,
    maxTurns: 5,
  });

  const text = agentResult.result || "";
  let decision = { decision: "accept", reasoning: "Default accept" };
  try {
    decision = JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
  } catch {
    // fallback
  }

  if (decision.decision === "retry" && (data as any).goalId && (data as any).taskId) {
    await inngest.send({
      name: "verxio/goal.reflect",
      data: {
        goalId: (data as any).goalId,
        taskId: (data as any).taskId,
        output: previousOutput,
        successCriteria,
        userId,
      },
    });
  }

  return {
    ...context,
    reflect: decision,
  };
};
