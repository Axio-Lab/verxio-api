import { inngest } from "../index";
import { getWorkflow } from "../../services/workflowService";
import { NonRetriableError } from "inngest";
import { topologicalSort } from "../utils";
import { getExecutor } from "./executor-registry";
import { nodeStatusChannels } from "../channels";

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
  sourceHandle?: string;
  targetHandle?: string;
}

// Helper functions
const TRIGGER_NODE_TYPES = [
  "MANUAL_TRIGGER",
  "TIMED_TRIGGER",
  "GOOGLE_FORM_TRIGGER",
  "STRIPE_TRIGGER",
  "WEBHOOK",
] as const;

/**
 * Find the trigger node in the workflow
 */
const findTriggerNode = (nodes: WorkflowNode[], eventData: any): WorkflowNode | null => {
  // Check for specific trigger node IDs in event data
  const triggerNodeId =
    eventData.data?.googleFormNodeId ||
    eventData.data?.stripeNodeId ||
    eventData.data?.webhookNodeId ||
    eventData.data?.timedTriggerNodeId ||
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
    const { workflowId, userId, timedTriggerNodeId } = event.data;

    // Validate required parameters
    if (!workflowId) {
      throw new NonRetriableError("workflowId is required");
    }

    if (!userId) {
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
      throw error;
    }

    // Initialize context with initial data from trigger
    let context = event.data.initialData || event.data.data || {};

    // Validate nodes array
    if (!Array.isArray(workflow.nodes)) {
      throw new NonRetriableError("Workflow nodes must be an array");
    }

    // Validate and filter nodes
    const validNodes = validateNodes(workflow.nodes);
    if (validNodes.length === 0) {
      throw new NonRetriableError(
        "Workflow has no valid nodes to execute. All nodes must have an id and type."
      );
    }

    // Execute workflow nodes with conditional routing support for DECIDER nodes
    try {
      const executedNodeIds = new Set<string>();
      const skippedNodeIds = new Set<string>();
      const nodeMap = new Map(validNodes.map((n) => [n.id, n]));

      // Track decider results for conditional routing
      const deciderResults = new Map<string, boolean>();

      // Build connection map with handle information: fromNodeId -> [{ toNodeId, sourceHandle }, ...]
      const connectionMapWithHandles = new Map<
        string,
        Array<{ target: string; sourceHandle?: string }>
      >();
      for (const conn of workflow.connections || []) {
        if (!connectionMapWithHandles.has(conn.source)) {
          connectionMapWithHandles.set(conn.source, []);
        }
        connectionMapWithHandles.get(conn.source)!.push({
          target: conn.target,
          sourceHandle: conn.sourceHandle,
        });
      }

      // Execute nodes in topological order
      for (const node of validNodes) {
        // Skip if already executed or explicitly skipped
        if (executedNodeIds.has(node.id) || skippedNodeIds.has(node.id)) {
          continue;
        }

        // Check if this node should be skipped due to a decider condition
        // Find if any decider node has marked this node to be skipped
        const shouldSkip = Array.from(deciderResults.entries()).some(([deciderId, result]) => {
          const deciderConnections = connectionMapWithHandles.get(deciderId) || [];
          // Check each connection from the decider
          for (const conn of deciderConnections) {
            if (conn.target === node.id) {
              // If decider is true, skip connections from "false" handle
              if (result === true && conn.sourceHandle === "false") {
                return true;
              }
              // If decider is false, skip connections from "true" handle
              if (result === false && conn.sourceHandle === "true") {
                return true;
              }
            }
          }
          return false;
        });

        if (shouldSkip) {
          skippedNodeIds.add(node.id);
          continue;
        }

        const executor = getExecutor(node.type);
        context = await executor({
          data: node.data as Record<string, unknown>,
          nodeId: node.id,
          context,
          step,
          publish,
          userId,
        });

        executedNodeIds.add(node.id);

        // Store decider result for conditional routing
        if (node.type === "DECIDER") {
          const deciderResult = (context as any).decider?.result;
          if (typeof deciderResult === "boolean") {
            deciderResults.set(node.id, deciderResult);
          }
        }
      }

      return {
        workflowId,
        result: context,
      };
    } catch (error) {
      throw error;
    }
  }
);
