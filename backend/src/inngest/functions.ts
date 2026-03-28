// Import all Inngest functions here and export them as an array
import { triggerWorkflow } from "./functions/trigger-workflow";
import {
  goalDecompose,
  goalExecuteNext,
  approvalGate,
  goalReflect,
  agentWatchFire,
} from "./functions/agent-orchestration";

// Export all Inngest functions
// Note: taskDailyReport removed — report generation now handled by cron scheduler
export const functions = [
  triggerWorkflow,
  goalDecompose,
  goalExecuteNext,
  approvalGate,
  goalReflect,
  agentWatchFire,
];
