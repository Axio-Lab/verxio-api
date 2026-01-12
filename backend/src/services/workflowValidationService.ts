import { NodeType } from "@/lib/node-types";
import type { WorkflowContext } from "@/inngest/functions/types";
import {
  identifyTriggerNodes,
  identifyActionNodes,
  validateConnections,
} from "./workflowConnectionService";

export interface WorkflowBlueprint {
  nodes: Array<{
    id?: string;
    type: string;
    data: Record<string, unknown>;
    position?: { x: number; y: number };
  }>;
  connections: Array<{
    source: string;
    target: string;
    fromOutput?: string;
    toInput?: string;
  }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a generated workflow blueprint
 */
export const validateWorkflowBlueprint = (blueprint: WorkflowBlueprint): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate nodes
  if (!blueprint.nodes || !Array.isArray(blueprint.nodes)) {
    errors.push("Workflow must have a nodes array");
    return { valid: false, errors, warnings };
  }

  if (blueprint.nodes.length === 0) {
    errors.push("Workflow must have at least one node");
    return { valid: false, errors, warnings };
  }

  // Collect node IDs for connection validation
  const nodeIds = new Set<string>();

  for (const [index, node] of blueprint.nodes.entries()) {
    // Validate node structure
    if (!node.type) {
      errors.push(`Node at index ${index} is missing a type`);
      continue;
    }

    // Validate node type exists (either existing type or CODE_BLOCK)
    const validTypes = Object.values(NodeType);
    if (!validTypes.includes(node.type as any) && node.type !== NodeType.CODE_BLOCK) {
      errors.push(`Node at index ${index} has invalid type: ${node.type}`);
      continue;
    }

    // Validate CODE_BLOCK nodes have required fields
    if (node.type === NodeType.CODE_BLOCK) {
      if (!node.data || typeof node.data !== "object") {
        errors.push(`CODE_BLOCK node at index ${index} is missing data object`);
        continue;
      }

      // Code may not exist yet if it's being generated - make it a warning instead of error
      // The workflow generation service will generate code after initial validation
      if (!node.data.code || typeof node.data.code !== "string") {
        warnings.push(`CODE_BLOCK node at index ${index} is missing code (will be generated)`);
        // Don't add as error - code will be generated during workflow generation
      }

      if (!node.data.label || typeof node.data.label !== "string") {
        warnings.push(`CODE_BLOCK node at index ${index} should have a label`);
      }

      if (!node.data.variables || typeof node.data.variables !== "string") {
        warnings.push(`CODE_BLOCK node at index ${index} should have a variables field`);
      }
    }

    // Validate existing node types have required fields
    if (node.type !== NodeType.CODE_BLOCK) {
      if (!node.data || typeof node.data !== "object") {
        warnings.push(`Node ${node.type} at index ${index} should have a data object`);
      }
    }

    // Track node ID
    const nodeId = node.id || `node-${index}`;
    if (nodeIds.has(nodeId)) {
      errors.push(`Duplicate node ID: ${nodeId}`);
    }
    nodeIds.add(nodeId);
  }

  // Validate connections
  if (blueprint.connections && Array.isArray(blueprint.connections)) {
    for (const [index, connection] of blueprint.connections.entries()) {
      if (!connection.source || !connection.target) {
        errors.push(`Connection at index ${index} is missing source or target`);
        continue;
      }

      if (!nodeIds.has(connection.source)) {
        errors.push(
          `Connection at index ${index} references non-existent source node: ${connection.source}`
        );
      }

      if (!nodeIds.has(connection.target)) {
        errors.push(
          `Connection at index ${index} references non-existent target node: ${connection.target}`
        );
      }
    }
  }

  // Validate execution flow
  const workflowNodes = blueprint.nodes.map((n) => ({
    id: n.id || "",
    type: n.type,
    data: n.data,
  }));

  const triggers = identifyTriggerNodes(workflowNodes);
  const actions = identifyActionNodes(workflowNodes);

  // Check if workflow has at least one trigger
  if (triggers.length === 0 && actions.length > 0) {
    warnings.push(
      "Workflow has action nodes but no trigger node. A trigger will be added automatically."
    );
  }

  // Validate execution chain
  const connectionValidation = validateConnections(blueprint);
  if (!connectionValidation.hasTrigger && actions.length > 0) {
    warnings.push(
      "Workflow has action nodes but no trigger node. A trigger will be added automatically."
    );
  }

  if (connectionValidation.isolatedNodes.length > 0) {
    warnings.push(
      `Some nodes are isolated (not connected): ${connectionValidation.isolatedNodes.join(", ")}. Connections will be added automatically.`
    );
  }

  // Check if all action nodes are reachable from trigger nodes
  if (triggers.length > 0 && actions.length > 0) {
    const nodeIds = new Set(workflowNodes.map((n) => n.id));
    const incoming = new Map<string, string[]>();
    const outgoing = new Map<string, string[]>();

    nodeIds.forEach((nodeId) => {
      incoming.set(nodeId, []);
      outgoing.set(nodeId, []);
    });

    blueprint.connections?.forEach((conn) => {
      if (nodeIds.has(conn.source) && nodeIds.has(conn.target)) {
        incoming.get(conn.target)?.push(conn.source);
        outgoing.get(conn.source)?.push(conn.target);
      }
    });

    // BFS from triggers to find reachable nodes
    const reachable = new Set<string>();
    const queue: string[] = triggers.map((t) => t.id);
    queue.forEach((id) => reachable.add(id));

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = outgoing.get(currentId) || [];
      children.forEach((childId) => {
        if (!reachable.has(childId)) {
          reachable.add(childId);
          queue.push(childId);
        }
      });
    }

    // Check for unreachable action nodes
    const unreachableActions = actions.filter((action) => !reachable.has(action.id));

    if (unreachableActions.length > 0) {
      warnings.push(
        `Some action nodes are not reachable from trigger nodes: ${unreachableActions.map((a) => a.id).join(", ")}. Connections will be added automatically.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};
