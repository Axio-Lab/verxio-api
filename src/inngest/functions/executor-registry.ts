import { NodeExecutor } from "./types";
import { manualTriggerExecutor } from "./triggers/manual-trigger";
import { httpTriggerExecutor } from "./triggers/http-trigger";
import { NodeType, type NodeTypeValue } from "@/lib/node-types";

// Registry of executors for each node type
// Note: We cast specific executors to base NodeExecutor type to allow different generic types
export const executorRegistry: Record<NodeTypeValue, NodeExecutor> = {
  [NodeType.MANUAL_TRIGGER]: manualTriggerExecutor,
  [NodeType.INITIAL]: async () => ({}),
  [NodeType.HTTP_REQUEST]: httpTriggerExecutor as NodeExecutor,
  [NodeType.WEBHOOK]: httpTriggerExecutor as NodeExecutor,
};

/**
 * Get the executor function for a given node type
 * @param nodeType - The type of node to get executor for
 * @returns The executor function for that node type
 */

export function getExecutor(nodeType: string): NodeExecutor {
  const executor = executorRegistry[nodeType as NodeTypeValue];
  if (!executor) {
    throw new Error(`No executor found for node type: ${nodeType}`);
  }
  return executor;
}