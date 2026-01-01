// Import NodeType from Prisma-generated client
const { NodeType } = require('../../../node_modules/.prisma/client');
import { NodeExecutor } from "./types";
import { manualTriggerExecutor } from "./triggers/manual-trigger";
import { httpTriggerExecutor } from "./triggers/http-trigger";

// Type for the NodeType enum values
type NodeTypeValue = typeof NodeType[keyof typeof NodeType];

// Registry of executors for each node type
export const executorRegistry: Record<NodeTypeValue, NodeExecutor> = {
  [NodeType.MANUAL_TRIGGER]: manualTriggerExecutor,
  [NodeType.INITIAL]: async () => ({}),
  [NodeType.HTTP_REQUEST]: httpTriggerExecutor,
  [NodeType.WEBHOOK]: httpTriggerExecutor,
};

/**
 * Get the executor function for a given node type
 * @param nodeType - The type of node to get executor for
 * @returns The executor function for that node type
 */
export function getExecutor(nodeType: string): NodeExecutor {
  const executor = executorRegistry[nodeType];
  if (!executor) {
    throw new Error(`No executor found for node type: ${nodeType}`);
  }
  return executor;
}