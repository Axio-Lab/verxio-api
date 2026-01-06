// Import all Inngest functions here and export them as an array
import { triggerWorkflow } from "./functions/trigger-workflow";
import { checkTimedTriggers } from "./functions/check-timed-triggers";

// Export all Inngest functions
export const functions = [triggerWorkflow, checkTimedTriggers];
