import { NodeType } from "@/lib/node-types";
import { createId } from "@paralleldrive/cuid2";

export interface WorkflowNode {
  id: string;
  type: string;
  data?: Record<string, unknown>;
}

export interface WorkflowConnection {
  id?: string;
  source: string;
  target: string;
  fromOutput?: string;
  toInput?: string;
}

export interface WorkflowBlueprint {
  nodes: Array<{
    id?: string;
    type: string;
    data?: Record<string, unknown>;
  }>;
  connections: WorkflowConnection[];
}

/**
 * Identifies trigger nodes in a workflow
 * Trigger nodes are nodes that start workflow execution
 */
export const identifyTriggerNodes = (nodes: WorkflowNode[]): WorkflowNode[] => {
  const triggerTypes = new Set<string>([
    NodeType.MANUAL_TRIGGER,
    NodeType.TIMED_TRIGGER,
    NodeType.WEBHOOK,
    NodeType.INITIAL,
    NodeType.GOOGLE_FORM_TRIGGER,
    NodeType.STRIPE_TRIGGER,
    NodeType.WHATSAPP_TRIGGER,
    NodeType.TELEGRAM_TRIGGER,
    NodeType.AIRTABLE_TRIGGER,
  ]);

  return nodes.filter((node) => triggerTypes.has(node.type));
};

/**
 * Identifies action nodes (non-trigger, non-initial nodes)
 */
export const identifyActionNodes = (nodes: WorkflowNode[]): WorkflowNode[] => {
  const triggerTypes = new Set<string>([
    NodeType.MANUAL_TRIGGER,
    NodeType.TIMED_TRIGGER,
    NodeType.WEBHOOK,
    NodeType.INITIAL,
    NodeType.GOOGLE_FORM_TRIGGER,
    NodeType.STRIPE_TRIGGER,
    NodeType.WHATSAPP_TRIGGER,
    NodeType.TELEGRAM_TRIGGER,
    NodeType.AIRTABLE_TRIGGER,
  ]);

  return nodes.filter((node) => !triggerTypes.has(node.type));
};

/**
 * Builds a connection graph from existing connections
 */
const buildConnectionGraph = (
  connections: WorkflowConnection[],
  nodeIds: Set<string>
): {
  incoming: Map<string, string[]>;
  outgoing: Map<string, string[]>;
} => {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  // Initialize maps for all nodes
  nodeIds.forEach((nodeId) => {
    incoming.set(nodeId, []);
    outgoing.set(nodeId, []);
  });

  // Build graph from connections
  connections.forEach((conn) => {
    if (nodeIds.has(conn.source) && nodeIds.has(conn.target)) {
      incoming.get(conn.target)?.push(conn.source);
      outgoing.get(conn.source)?.push(conn.target);
    }
  });

  return { incoming, outgoing };
};

/**
 * Validates if connections form a proper execution chain
 */
export const validateConnections = (
  blueprint: WorkflowBlueprint
): {
  valid: boolean;
  missingConnections: Array<{ source: string; target: string }>;
  isolatedNodes: string[];
  hasTrigger: boolean;
} => {
  const nodeIds = new Set(blueprint.nodes.map((n) => n.id || "").filter(Boolean));
  const triggers = identifyTriggerNodes(
    blueprint.nodes.map((n) => ({
      id: n.id || "",
      type: n.type,
    }))
  );
  const actions = identifyActionNodes(
    blueprint.nodes.map((n) => ({
      id: n.id || "",
      type: n.type,
    }))
  );

  const { incoming, outgoing } = buildConnectionGraph(blueprint.connections, nodeIds);

  const isolatedNodes: string[] = [];
  const missingConnections: Array<{ source: string; target: string }> = [];

  // Check for isolated action nodes (no incoming connections)
  actions.forEach((action) => {
    const incomingConnections = incoming.get(action.id) || [];
    if (incomingConnections.length === 0) {
      isolatedNodes.push(action.id);
    }
  });

  // Check if trigger connects to actions
  if (triggers.length > 0 && actions.length > 0) {
    triggers.forEach((trigger) => {
      const triggerOutgoing = outgoing.get(trigger.id) || [];
      if (triggerOutgoing.length === 0) {
        // Trigger not connected to any action
        if (actions.length > 0) {
          missingConnections.push({
            source: trigger.id,
            target: actions[0].id,
          });
        }
      }
    });
  }

  return {
    valid: isolatedNodes.length === 0 && missingConnections.length === 0,
    missingConnections,
    isolatedNodes,
    hasTrigger: triggers.length > 0,
  };
};

/**
 * Builds a sequential execution chain from trigger to actions
 */
const buildExecutionChain = (
  triggerNode: WorkflowNode,
  actionNodes: WorkflowNode[],
  existingConnections: WorkflowConnection[]
): WorkflowConnection[] => {
  const newConnections: WorkflowConnection[] = [];
  const existingConnectionSet = new Set(existingConnections.map((c) => `${c.source}->${c.target}`));

  if (actionNodes.length === 0) {
    return [];
  }

  // Connect trigger to first action if not already connected
  const firstAction = actionNodes[0];
  const triggerToFirstKey = `${triggerNode.id}->${firstAction.id}`;
  if (!existingConnectionSet.has(triggerToFirstKey)) {
    newConnections.push({
      id: createId(),
      source: triggerNode.id,
      target: firstAction.id,
      fromOutput: "main",
      toInput: "main",
    });
  }

  // Connect actions sequentially
  for (let i = 0; i < actionNodes.length - 1; i++) {
    const current = actionNodes[i];
    const next = actionNodes[i + 1];
    const connectionKey = `${current.id}->${next.id}`;

    // Only add connection if it doesn't already exist
    if (!existingConnectionSet.has(connectionKey)) {
      // Check if current node is DECIDER - preserve multiple outputs
      if (current.type === NodeType.DECIDER) {
        // DECIDER nodes may have multiple outputs, so we skip automatic connection
        // But ensure there's at least one output
        const currentOutgoing = existingConnections.filter((c) => c.source === current.id);
        if (currentOutgoing.length === 0) {
          // No outputs from DECIDER, add connection to next action
          newConnections.push({
            id: createId(),
            source: current.id,
            target: next.id,
            fromOutput: "main",
            toInput: "main",
          });
        }
      } else {
        // Regular action node - connect to next
        newConnections.push({
          id: createId(),
          source: current.id,
          target: next.id,
          fromOutput: "main",
          toInput: "main",
        });
      }
    }
  }

  return newConnections;
};

/**
 * Ensures proper execution chain in a workflow blueprint
 * - Adds trigger node if missing
 * - Connects trigger to first action
 * - Connects actions sequentially
 * - Preserves existing valid connections
 */
export const ensureExecutionChain = (
  blueprint: WorkflowBlueprint
): {
  nodes: WorkflowBlueprint["nodes"];
  connections: WorkflowConnection[];
  addedTrigger?: boolean;
  addedConnections: number;
} => {
  // Ensure all nodes have IDs
  const nodesWithIds = blueprint.nodes.map((node, index) => ({
    ...node,
    id: node.id || `node-${index}`,
  }));

  // Identify triggers and actions
  const triggers = identifyTriggerNodes(nodesWithIds.map((n) => ({ id: n.id!, type: n.type })));
  const actions = identifyActionNodes(nodesWithIds.map((n) => ({ id: n.id!, type: n.type })));

  let finalNodes = [...nodesWithIds];
  let finalConnections = [...blueprint.connections];
  let addedTrigger = false;

  // If no trigger exists, add MANUAL_TRIGGER
  if (triggers.length === 0) {
    const triggerId = createId();
    finalNodes.unshift({
      id: triggerId,
      type: NodeType.MANUAL_TRIGGER,
      data: {
        label: "Start Workflow",
        variables: "start",
      },
    });
    triggers.push({
      id: triggerId,
      type: NodeType.MANUAL_TRIGGER,
    });
    addedTrigger = true;
  }

  // If no actions exist, return early
  if (actions.length === 0) {
    return {
      nodes: finalNodes,
      connections: finalConnections,
      addedTrigger,
      addedConnections: 0,
    };
  }

  // Use the first trigger (or newly added trigger)
  const primaryTrigger = triggers[0];

  // Build connection graph to understand current state
  const nodeIds = new Set(finalNodes.map((n) => n.id!));
  const { incoming, outgoing } = buildConnectionGraph(finalConnections, nodeIds);

  // Check which actions are isolated (no incoming connections)
  const isolatedActions = actions.filter((action) => {
    const incomingConnections = incoming.get(action.id) || [];
    return incomingConnections.length === 0;
  });

  // If trigger doesn't connect to any action, connect it to first isolated action
  const triggerOutgoing = outgoing.get(primaryTrigger.id) || [];
  if (triggerOutgoing.length === 0 && isolatedActions.length > 0) {
    finalConnections.push({
      id: createId(),
      source: primaryTrigger.id,
      target: isolatedActions[0].id,
      fromOutput: "main",
      toInput: "main",
    });
  }

  // Build sequential chain for actions
  // Find the execution order by following connections from trigger
  const visited = new Set<string>();
  const executionOrder: WorkflowNode[] = [];

  // Start from trigger
  const queue: string[] = [primaryTrigger.id];
  visited.add(primaryTrigger.id);

  // BFS to find execution order
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = finalNodes.find((n) => n.id === currentId);

    if (currentNode && actions.some((a) => a.id === currentId)) {
      executionOrder.push({
        id: currentNode.id!,
        type: currentNode.type,
      });
    }

    const children = outgoing.get(currentId) || [];
    children.forEach((childId) => {
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push(childId);
      }
    });
  }

  // Add any remaining isolated actions to execution order
  isolatedActions.forEach((action) => {
    if (!executionOrder.some((n) => n.id === action.id)) {
      executionOrder.push(action);
    }
  });

  // If execution order is empty but we have actions, use all actions
  if (executionOrder.length === 0 && actions.length > 0) {
    executionOrder.push(...actions);
  }

  // Build connections for execution order
  if (executionOrder.length > 0) {
    // Connect trigger to first action in execution order
    const firstActionInOrder = executionOrder[0];
    const triggerConnected = finalConnections.some(
      (c) => c.source === primaryTrigger.id && c.target === firstActionInOrder.id
    );

    if (!triggerConnected) {
      finalConnections.push({
        id: createId(),
        source: primaryTrigger.id,
        target: firstActionInOrder.id,
        fromOutput: "main",
        toInput: "main",
      });
    }

    // Connect actions sequentially
    for (let i = 0; i < executionOrder.length - 1; i++) {
      const current = executionOrder[i];
      const next = executionOrder[i + 1];

      // Check if connection already exists
      const connectionExists = finalConnections.some(
        (c) => c.source === current.id && c.target === next.id
      );

      if (!connectionExists) {
        // Check if current is DECIDER - don't override multiple outputs
        const currentOutgoing = finalConnections.filter((c) => c.source === current.id);

        // If DECIDER has outputs, don't add automatic connection
        // Otherwise, add sequential connection
        if (current.type !== NodeType.DECIDER || currentOutgoing.length === 0) {
          finalConnections.push({
            id: createId(),
            source: current.id,
            target: next.id,
            fromOutput: "main",
            toInput: "main",
          });
        }
      }
    }
  } else if (actions.length > 0) {
    // If no execution order found (isolated nodes), connect all actions sequentially
    // Connect trigger to first action
    const firstAction = actions[0];
    if (
      !finalConnections.some((c) => c.source === primaryTrigger.id && c.target === firstAction.id)
    ) {
      finalConnections.push({
        id: createId(),
        source: primaryTrigger.id,
        target: firstAction.id,
        fromOutput: "main",
        toInput: "main",
      });
    }

    // Connect all actions in order
    for (let i = 0; i < actions.length - 1; i++) {
      const current = actions[i];
      const next = actions[i + 1];
      if (!finalConnections.some((c) => c.source === current.id && c.target === next.id)) {
        finalConnections.push({
          id: createId(),
          source: current.id,
          target: next.id,
          fromOutput: "main",
          toInput: "main",
        });
      }
    }
  }

  const addedConnections = finalConnections.length - blueprint.connections.length;

  return {
    nodes: finalNodes,
    connections: finalConnections,
    addedTrigger,
    addedConnections,
  };
};

// Type helper for NodeType values
type NodeTypeValue = (typeof NodeType)[keyof typeof NodeType];
