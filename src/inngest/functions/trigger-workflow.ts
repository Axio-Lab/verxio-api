import { inngest } from "../index";
import { getWorkflow } from "../../services/workflowService";
import { NonRetriableError } from "inngest";
import { topologicalSort } from "../utils";

/**
 * Inngest function to trigger workflow execution
 * This function is triggered by the event "workflow/trigger"
 * 
 * Event payload should include:
 * - workflowId: string - The ID of the workflow to execute
 * - userId: string - The ID of the user who owns the workflow
 * - data?: any - Optional data to pass to the workflow execution
 */
export const triggerWorkflow = inngest.createFunction(
  { id: "trigger-workflow" },
  { event: "workflow/trigger" },
  async ({ event, step }) => {
    const { workflowId, userId } = event.data;

    // Validate required fields
    if (!workflowId) {
      throw new NonRetriableError("workflowId is required");
    }

    if (!userId) {
      throw new NonRetriableError("userId is required");
    }

    // Fetch workflow with nodes and connections, then sort nodes in topological order
    const workflow = await step.run("prepare-workflow", async () => {
      const workflow = await getWorkflow(workflowId, userId);
      // Sort nodes in topological order (dependencies first)
      const sortedNodes = topologicalSort(workflow.nodes, workflow.connections);
      return {
        ...workflow,
        nodes: sortedNodes,
      };
    });

    return workflow.nodes;
  }
);

