import { inngest } from "../index";
import { getWorkflow } from "../../services/workflowService";
import { NonRetriableError } from "inngest";
import { topologicalSort } from "../utils";
import { getExecutor } from "./executor-registry";
import { httpRequestChannel } from "../channels/http-request";

/**
 * Inngest function to trigger workflow execution
 * This function is triggered by the event "workflow/trigger"
 * 
 * Event payload should include:
 * - workflowId: string - The ID of the workflow to execute
 * - userId: string - The ID of the user who owns the workflow
 * - data?: any - Optional data to pass to the workflow execution (used as initial context)
 * 
 * @returns {Object} Returns an object with workflowId and context
 * - workflowId: string - The ID of the executed workflow
 * - context: Record<string, unknown> - The final context after workflow execution
 */
export const triggerWorkflow = inngest.createFunction(
  { id: "trigger-workflow" },
  { event: "workflow/trigger" ,
    channels: [
      httpRequestChannel()
    ],
  },
  async ({ event, step, publish }) => {
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

    // Initialize the context with any initial data from the trigger
    // Note: The route handler sends 'data' but we check both 'data' and 'initialData' for compatibility
    let context = event.data.initialData || event.data.data || {};

    // Validate nodes array and filter out any invalid nodes
    if (!Array.isArray(workflow.nodes)) {
      throw new NonRetriableError("Workflow nodes must be an array");
    }

    // Filter out any undefined/null nodes and validate each node
    const validNodes = workflow.nodes.filter((node: any) => {
      if (!node) {
        console.warn("Found null/undefined node in workflow, skipping");
        return false;
      }
      if (!node.id) {
        console.warn(`Found node without id: ${JSON.stringify(node)}, skipping`);
        return false;
      }
      if (!node.type) {
        console.warn(`Node ${node.id} (${node.name || 'unnamed'}) is missing type, skipping`);
        return false;
      }
      return true;
    });

    if (validNodes.length === 0) {
      throw new NonRetriableError(
        "Workflow has no valid nodes to execute. All nodes must have an id and type."
      );
    }

    // Execute each valid node in the workflow
    for (const node of validNodes) {
      const executor = getExecutor(node.type);
      context = await executor({
        data: node.data as Record<string, unknown>,
        nodeId: node.id,
        context,
        step,
        publish,
      });
    }

    return {
      workflowId,
      result: context
    };
  }
);

