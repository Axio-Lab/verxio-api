import { NodeExecutor } from "../types";
import * as goalService from "@/services/goalService";

export const orchestratorExecutor: NodeExecutor = async ({ data, context, userId }) => {
  const objective = (data as any).objective || (data as any).goal || "";
  const name = (data as any).name || "Workflow Goal";
  const reportingChannelId = (data as any).reportingChannelId;

  const goal = await goalService.createGoal(userId, {
    name,
    objective,
    reportingChannelId,
  });

  return {
    ...context,
    orchestrator: {
      goalId: goal.id,
      name: goal.name,
      status: goal.status,
    },
  };
};
