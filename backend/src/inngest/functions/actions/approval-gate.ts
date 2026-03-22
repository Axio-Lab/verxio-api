import { NodeExecutor } from "../types";
import { inngest } from "@/inngest/index";

export const approvalGateExecutor: NodeExecutor = async ({ data, context, step, userId }) => {
  const actionDescription = (data as any).actionDescription || "Action requires approval";
  const riskLevel = (data as any).riskLevel || "medium";
  const goalId = (data as any).goalId;
  const taskId = (data as any).taskId;

  await inngest.send({
    name: "verxio/goal.approval-requested",
    data: {
      goalId,
      taskId,
      actionDescription,
      riskLevel,
      userId,
    },
  });

  const approval = await step.waitForEvent("wait-for-approval-gate", {
    event: "verxio/goal.approval-responded",
    match: "data.goalId",
    timeout: "24h",
  });

  const approved = approval?.data?.decision === "approve";

  return {
    ...context,
    approvalGate: {
      approved,
      actionDescription,
      riskLevel,
      respondedAt: approval ? new Date().toISOString() : null,
    },
  };
};
