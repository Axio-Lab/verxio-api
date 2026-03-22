// Import all Inngest functions here and export them as an array
import { triggerWorkflow } from "./functions/trigger-workflow";
import {
  goalDecompose,
  goalExecuteNext,
  approvalGate,
  goalReflect,
  agentWatchFire,
} from "./functions/agent-orchestration";
import {
  taskReminder,
  taskUpcomingReminder,
  taskGraceCheck,
  taskDailyReport,
  taskSchedulerCron,
} from "./functions/task-management";

// Export all Inngest functions
export const functions = [
  triggerWorkflow,
  goalDecompose,
  goalExecuteNext,
  approvalGate,
  goalReflect,
  agentWatchFire,
  taskReminder,
  taskUpcomingReminder,
  taskGraceCheck,
  taskDailyReport,
  taskSchedulerCron,
];
