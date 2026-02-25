import { inngest } from "../index";
import { NonRetriableError } from "inngest";
import { topologicalSort } from "../utils";
import { getExecutor } from "./executor-registry";
import { nodeStatusChannels } from "../channels";
import { prisma } from "@/lib/prisma";

// PublicChatRun is used for shareable chat; use type assertion for extended client
const publicChatRunDb = (prisma as any).publicChatRun as {
  update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
};

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
  "AIRTABLE_TRIGGER",
  "STRIPE_TRIGGER",
  "TELEGRAM_TRIGGER",
  "WHATSAPP_TRIGGER",
  "WEBHOOK",
  "COMPOSIO_TRIGGER",
] as const;

/**
 * Find the trigger node in the workflow
 * @param nodes - All workflow nodes
 * @param eventData - Event data that may contain specific trigger node IDs
 * @param connections - Workflow connections to check if trigger is connected
 */
const findTriggerNode = (
  nodes: WorkflowNode[],
  eventData: any,
  connections: WorkflowConnection[] = []
): WorkflowNode | null => {
  // Check for specific trigger node IDs in event data (webhook triggers, etc.)
  const triggerNodeId =
    eventData.googleFormNodeId ||
    eventData.airtableNodeId ||
    eventData.stripeNodeId ||
    eventData.webhookNodeId ||
    eventData.composioTriggerNodeId ||
    eventData.telegramNodeId ||
    eventData.whatsappNodeId ||
    eventData.timedTriggerNodeId ||
    eventData.data?.googleFormNodeId ||
    eventData.data?.airtableNodeId ||
    eventData.data?.stripeNodeId ||
    eventData.data?.webhookNodeId ||
    eventData.data?.composioTriggerNodeId ||
    eventData.data?.telegramNodeId ||
    eventData.data?.whatsappNodeId ||
    eventData.data?.timedTriggerNodeId ||
    null;

  if (triggerNodeId) {
    const node = nodes.find((n) => n.id === triggerNodeId);
    if (node) return node;
  }

  // For manual execution (no specific trigger node ID), prioritize connected trigger nodes
  // Build a set of connected node IDs (nodes that have outgoing connections)
  const connectedNodeIds = new Set<string>();
  for (const conn of connections) {
    connectedNodeIds.add(conn.source);
  }

  // Helper to check if a node is connected
  const isConnected = (node: WorkflowNode): boolean => {
    return connectedNodeIds.has(node.id);
  };

  // Priority order for manual execution:
  // 1. Connected MANUAL_TRIGGER (highest priority for manual execution)
  // 2. Other connected trigger nodes
  // 3. Unconnected MANUAL_TRIGGER (fallback)
  // 4. Other unconnected trigger nodes (last resort)

  // First, try to find a connected MANUAL_TRIGGER
  const connectedManualTrigger = nodes.find(
    (node) => node.type === "MANUAL_TRIGGER" && isConnected(node)
  );
  if (connectedManualTrigger) {
    return connectedManualTrigger;
  }

  // Then try other connected trigger nodes (prioritize by TRIGGER_NODE_TYPES order)
  for (const triggerType of TRIGGER_NODE_TYPES) {
    if (triggerType === "MANUAL_TRIGGER") continue; // Already checked
    const connectedTrigger = nodes.find((node) => node.type === triggerType && isConnected(node));
    if (connectedTrigger) {
      return connectedTrigger;
    }
  }

  // Fallback: unconnected MANUAL_TRIGGER
  const unconnectedManualTrigger = nodes.find((node) => node.type === "MANUAL_TRIGGER");
  if (unconnectedManualTrigger) {
    return unconnectedManualTrigger;
  }

  // Last resort: any unconnected trigger node
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
    const { workflowId, userId, timedTriggerNodeId, publicChatRunId, singleNodeId } = event.data;

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
      // Load workflow directly (not in step) to avoid serializing large workflow in step output
      // This prevents "output_too_large" errors when Inngest tries to queue the execution
      const { getWorkflowForExecution } = await import("../../services/workflowService");
      const fetchedWorkflow = await getWorkflowForExecution(workflowId, userId);
      const connections = fetchedWorkflow.connections || [];

      // If executing a single node, skip trigger node requirement and topology
      if (singleNodeId) {
        const targetNode = fetchedWorkflow.nodes.find((n: any) => n.id === singleNodeId);
        if (!targetNode) {
          throw new NonRetriableError(`Node with id "${singleNodeId}" not found in workflow`);
        }
        const nodeOverrides = (event.data?.data as any)?.nodeOverrides;
        const overrideData =
          nodeOverrides && typeof nodeOverrides === "object" ? nodeOverrides[singleNodeId] : null;
        const resolvedNode =
          overrideData && typeof overrideData === "object"
            ? {
                ...targetNode,
                data: {
                  ...(targetNode.data || {}),
                  ...overrideData,
                },
              }
            : targetNode;
        workflow = {
          ...fetchedWorkflow,
          nodes: [resolvedNode], // Only execute the single node
        };
      } else {
        // Find trigger node (pass connections to check if trigger is connected)
        const triggerNode = findTriggerNode(fetchedWorkflow.nodes, event.data, connections);
        if (!triggerNode) {
          throw new NonRetriableError("No trigger node found in workflow");
        }

        // Find all reachable nodes from trigger
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

        workflow = {
          ...fetchedWorkflow,
          nodes: sortedNodes,
        };
      }
    } catch (error) {
      throw error;
    }

    // Initialize context with initial data from trigger
    const rawContext = event.data.initialData || event.data.data || {};
    let context =
      rawContext && typeof rawContext === "object"
        ? { ...(rawContext as Record<string, any>) }
        : {};
    if ("nodeOverrides" in context) {
      delete context.nodeOverrides;
    }

    // Extract trigger-specific payloads and add to context
    if (event.data.data?.airtablePayload) {
      context.airtablePayload = event.data.data.airtablePayload;
    }
    if (event.data.data?.googleFormPayload) {
      context.googleFormPayload = event.data.data.googleFormPayload;
    }
    if (event.data.initialData?.whatsappPayload) {
      context.whatsappPayload = event.data.initialData.whatsappPayload;
    }
    if (event.data.initialData?.whatsappSessionRef) {
      context.whatsappSessionRef = event.data.initialData.whatsappSessionRef;
    }

    // Mark public chat run as RUNNING when used for shareable chat
    if (publicChatRunId && publicChatRunDb) {
      await publicChatRunDb.update({
        where: { id: publicChatRunId },
        data: { status: "RUNNING" },
      });
    }

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
    const workflowStartTime = Date.now();
    const nodeMetrics: Record<string, { duration: number; status: string; type: string }> = {};
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
        const nodeStart = Date.now();
        try {
          context = await executor({
            data: node.data as Record<string, unknown>,
            nodeId: node.id,
            context,
            step,
            publish,
            userId,
          });
          nodeMetrics[node.id] = {
            duration: Date.now() - nodeStart,
            status: "success",
            type: node.type,
          };
        } catch (nodeError) {
          nodeMetrics[node.id] = {
            duration: Date.now() - nodeStart,
            status: "failed",
            type: node.type,
          };
          throw nodeError;
        }

        executedNodeIds.add(node.id);

        // Store decider result for conditional routing
        if (node.type === "DECIDER") {
          const deciderResult = (context as any).decider?.result;
          if (typeof deciderResult === "boolean") {
            deciderResults.set(node.id, deciderResult);
          }
        }
      }

      const totalDuration = Date.now() - workflowStartTime;

      // Record execution history for ROI analytics
      try {
        await prisma.executionHistory.create({
          data: {
            workflowId,
            executionId: event.id || `exec_${Date.now()}`,
            success: true,
            duration: totalDuration,
            nodeMetrics: nodeMetrics as any,
          },
        });
      } catch {
        // Don't fail the workflow if analytics recording fails
      }

      // Persist result for public chat (shareable link) when run ID was provided
      if (publicChatRunId && publicChatRunDb) {
        await publicChatRunDb.update({
          where: { id: publicChatRunId },
          data: {
            status: "COMPLETED",
            output: context as object,
            completedAt: new Date(),
          },
        });
      }

      return {
        workflowId,
        result: context,
      };
    } catch (error) {
      const totalDuration = Date.now() - workflowStartTime;

      // Record failed execution for analytics
      try {
        await prisma.executionHistory.create({
          data: {
            workflowId,
            executionId: event.id || `exec_${Date.now()}`,
            success: false,
            duration: totalDuration,
            nodeMetrics: nodeMetrics as any,
            errorContext: { error: error instanceof Error ? error.message : String(error) },
          },
        });
      } catch {
        // Don't fail if analytics recording fails
      }

      if (publicChatRunId && publicChatRunDb) {
        await publicChatRunDb.update({
          where: { id: publicChatRunId },
          data: {
            status: "FAILED",
            error: error instanceof Error ? error.message : String(error),
            completedAt: new Date(),
          },
        });
      }
      throw error;
    }
  }
);
