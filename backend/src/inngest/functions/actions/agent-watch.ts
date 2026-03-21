import { NodeExecutor } from "../types";
import * as agentWatchService from "@/services/agentWatchService";

export const agentWatchExecutor: NodeExecutor = async ({ data, context, userId }) => {
  const name = (data as any).name || "Untitled Watch";
  const triggerType = (data as any).triggerType || "CRON";
  const cronExpression = (data as any).cronExpression;
  const thresholdCondition = (data as any).thresholdCondition;
  const actionWorkflowId = (data as any).actionWorkflowId;
  const goalId = (data as any).goalId;

  const watch = await agentWatchService.createWatch(userId, {
    name,
    triggerType,
    cronExpression,
    thresholdCondition,
    actionWorkflowId,
    goalId,
  });

  return {
    ...context,
    agentWatch: {
      watchId: watch.id,
      name: watch.name,
      triggerType: watch.triggerType,
      status: watch.status,
    },
  };
};
