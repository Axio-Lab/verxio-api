import { inngest } from "../index";
import { getWorkflow } from "../../services/workflowService";
import { NonRetriableError } from "inngest";
import { topologicalSort } from "../utils";
import { getExecutor } from "./executor-registry";
import { nodeStatusChannels } from "../channels";
import { createExecution, updateExecution, ExecutionStatus } from "../../services/executionService";

// Helper types
interface WorkflowNode {
  id: string;
  type: string;
  name?: string;
  data?: Record<string, unknown>;
}

interface WorkflowConnection {
  source: string;
  target: string;
}

// Helper functions
const TRIGGER_NODE_TYPES = [
  "MANUAL_TRIGGER",
  "GOOGLE_FORM_TRIGGER",
  "STRIPE_TRIGGER",
  "WEBHOOK",
] as const;

/**
 * Extract error information from an error object
 */
const getErrorInfo = (error: unknown): { message: string; stack?: string } => {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: "Unknown error" };
};

/**
 * Update execution record with error information
 */
const updateExecutionWithError = async (
  step: any,
  executionId: string,
  error: unknown,
  stepName: string
): Promise<void> => {
  await step.run(stepName, async () => {
    try {
      const { message, stack } = getErrorInfo(error);
      await updateExecution(executionId, {
        status: ExecutionStatus.FAILED,
        error: message,
        errorStack: stack,
        completedAt: new Date(),
      });
    } catch (updateError) {
      console.error(`Failed to update execution record in ${stepName}:`, updateError);
    }
  });
};

/**
 * Find the trigger node in the workflow
 */
const findTriggerNode = (nodes: WorkflowNode[], eventData: any): WorkflowNode | null => {
  // Check for specific trigger node IDs in event data
  const triggerNodeId =
    eventData.data?.googleFormNodeId ||
    eventData.data?.stripeNodeId ||
    eventData.data?.webhookNodeId ||
    null;

  if (triggerNodeId) {
    const node = nodes.find((n) => n.id === triggerNodeId);
    if (node) return node;
  }

  // Find first trigger node by type
  return nodes.find((node) => TRIGGER_NODE_TYPES.includes(node.type as any)) || null;
};

/**
 * Find all nodes reachable from the trigger node using BFS
 */
const findReachableNodes = (
  triggerNode: WorkflowNode,
  nodes: WorkflowNode[],
  connections: WorkflowConnection[]
): Set<string> => {
  const reachableNodeIds = new Set<string>([triggerNode.id]);
  const adjacencyList = new Map<string, string[]>();

  // Build adjacency list
  for (const conn of connections) {
    if (!adjacencyList.has(conn.source)) {
      adjacencyList.set(conn.source, []);
    }
    adjacencyList.get(conn.source)!.push(conn.target);
  }

  // BFS traversal
  const queue = [triggerNode.id];
  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    const neighbors = adjacencyList.get(currentNodeId) || [];
    for (const neighborId of neighbors) {
      if (!reachableNodeIds.has(neighborId)) {
        reachableNodeIds.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  return reachableNodeIds;
};

/**
 * Validate and filter nodes
 */
const validateNodes = (nodes: any[]): WorkflowNode[] => {
  return nodes.filter((node) => {
    if (!node) {
      console.warn("Found null/undefined node in workflow, skipping");
      return false;
    }
    if (!node.id) {
      console.warn(`Found node without id: ${JSON.stringify(node)}, skipping`);
      return false;
    }
    if (!node.type) {
      console.warn(`Node ${node.id} (${node.name || "unnamed"}) is missing type, skipping`);
      return false;
    }
    return true;
  });
};

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
  {
    id: "trigger-workflow",
    retries: process.env.NODE_ENV === "production" ? 0 : 3,
  },
  {
    event: "workflow/trigger",
    channels: Object.values(nodeStatusChannels).map((channel) => channel()),
  },
  async ({ event, step, publish }) => {
    const { workflowId, userId } = event.data;
    const ingestEventId = (event as any).id;

    if (!ingestEventId) {
      throw new NonRetriableError("ingestEventId is required");
    }

    // Create execution record
    let executionId: string = "";
    try {
      const execution = await step.run("create-execution", async () => {
        return await createExecution({
          workflowId: workflowId || "unknown",
          ingestEventId,
          status: ExecutionStatus.RUNNING,
        });
      });
      executionId = execution.id;
    } catch (error) {
      console.error("Failed to create execution record:", error);
    }

    // Validate required parameters
    if (!workflowId) {
      if (executionId) {
        await updateExecutionWithError(
          step,
          executionId,
          new Error("workflowId is required"),
          "update-execution-validation-error"
        );
      }
      throw new NonRetriableError("workflowId is required");
    }

    if (!userId) {
      if (executionId) {
        await updateExecutionWithError(
          step,
          executionId,
          new Error("userId is required"),
          "update-execution-validation-error"
        );
      }
      throw new NonRetriableError("userId is required");
    }

    // Fetch and prepare workflow
    let workflow;
    try {
      workflow = await step.run("prepare-workflow", async () => {
        const fetchedWorkflow = await getWorkflow(workflowId, userId);

        // Find trigger node
        const triggerNode = findTriggerNode(fetchedWorkflow.nodes, event.data);
        if (!triggerNode) {
          throw new NonRetriableError("No trigger node found in workflow");
        }

        // Find all reachable nodes from trigger
        const connections = fetchedWorkflow.connections || [];
        const reachableNodeIds = findReachableNodes(
          triggerNode,
          fetchedWorkflow.nodes,
          connections
        );

        // Filter to only connected nodes and sort topologically
        const connectedNodes = fetchedWorkflow.nodes.filter((node: any) =>
          reachableNodeIds.has(node.id)
        );
        const sortedNodes = topologicalSort(connectedNodes, connections);

        return {
          ...fetchedWorkflow,
          nodes: sortedNodes,
        };
      });
    } catch (error) {
      if (executionId) {
        const { message } = getErrorInfo(error);
        await updateExecutionWithError(
          step,
          executionId,
          new Error(`Workflow preparation failed: ${message}`),
          "update-execution-prep-error"
        );
      }
      throw error;
    }

    // Initialize context with initial data from trigger
    let context = event.data.initialData || event.data.data || {};

    // Validate nodes array
    if (!Array.isArray(workflow.nodes)) {
      if (executionId) {
        await updateExecutionWithError(
          step,
          executionId,
          new Error("Workflow nodes must be an array"),
          "update-execution-validation-error"
        );
      }
      throw new NonRetriableError("Workflow nodes must be an array");
    }

    // Validate and filter nodes
    const validNodes = validateNodes(workflow.nodes);
    if (validNodes.length === 0) {
      if (executionId) {
        await updateExecutionWithError(
          step,
          executionId,
          new Error("Workflow has no valid nodes to execute. All nodes must have an id and type."),
          "update-execution-validation-error"
        );
      }
      throw new NonRetriableError(
        "Workflow has no valid nodes to execute. All nodes must have an id and type."
      );
    }

    // Execute workflow nodes
    try {
      for (const node of validNodes) {
        const executor = getExecutor(node.type);
        context = await executor({
          data: node.data as Record<string, unknown>,
          nodeId: node.id,
          context,
          step,
          publish,
          userId,
        });
      }

      // Update execution record on success
      if (executionId) {
        await step.run("update-execution-success", async () => {
          try {
            await updateExecution(executionId, {
              status: ExecutionStatus.SUCCESS,
              output: context,
              completedAt: new Date(),
            });
          } catch (error) {
            console.error("Failed to update execution record on success:", error);
          }
        });
      }

      return {
        workflowId,
        result: context,
      };
    } catch (error) {
      // Update execution record on failure
      if (executionId) {
        await updateExecutionWithError(step, executionId, error, "update-execution-error");
      }
      throw error;
    }
  }
);
