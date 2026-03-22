import { NodeExecutor } from "../types";
import { generateProgressReport, deliverReport } from "@/services/goalReportService";

export const reportExecutor: NodeExecutor = async ({ data, context }) => {
  const goalId = (data as any).goalId;
  const channelId = (data as any).channelId;

  let reportMarkdown = "";
  let deliveryResult: Record<string, unknown> = { delivered: false, reason: "No goalId provided" };

  if (goalId) {
    reportMarkdown = await generateProgressReport(goalId);
    deliveryResult = await deliverReport(goalId, channelId);
  }

  return {
    ...context,
    report: {
      markdown: reportMarkdown,
      delivery: deliveryResult,
    },
  };
};
