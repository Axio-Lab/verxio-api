import toposort from "toposort";
import { inngest } from "./index";

/**
 * Sorts workflow nodes in topological order based on their connections
 * This ensures nodes are executed in the correct order (dependencies first)
 * 
 * @param nodes - Array of workflow nodes
 * @param connections - Array of connections between nodes (source -> target)
 * @returns Array of nodes sorted in topological order (dependencies first)
 */
export const topologicalSort = (nodes: any[], connections: any[]): any[] => {
  // If no connections, return nodes as-is (they're all independent)
  if (connections.length === 0) {
    return nodes;
  }

  // Create edges array for toposort: [source, target] pairs
  const edges: [string, string][] = connections.map((connection: any) => [
    connection.source,
    connection.target,
  ]);

  // Track which nodes are connected (have incoming or outgoing edges)
  const connectedNodeIds = new Set<string>();
  for (const connection of connections) {
    connectedNodeIds.add(connection.source);
    connectedNodeIds.add(connection.target);
  }

  // Get all node IDs that are part of the graph (have connections)
  const allNodeIds = Array.from(connectedNodeIds);

  // Perform topological sort using toposort.array to include all connected nodes
  // toposort.array(nodes, edges) ensures all nodes are included in the sort
  let sortedNodeIds: string[];
  try {
    sortedNodeIds = toposort.array(allNodeIds, edges);
    // Remove duplicates (shouldn't be necessary, but safe)
    sortedNodeIds = [...new Set(sortedNodeIds)];
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cyclic")) {
      throw new Error("Workflow contains a cycle");
    }
    throw error;
  }

  // Map sorted node IDs back to node objects
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const sortedNodes = sortedNodeIds
    .map((nodeId) => nodeMap.get(nodeId))
    .filter((node): node is any => node !== undefined);

  // Add nodes with no connections at the end (they can run in any order)
  const unconnectedNodes = nodes.filter(
    (node) => !connectedNodeIds.has(node.id)
  );

  // Return sorted connected nodes first, then unconnected nodes
  return [...sortedNodes, ...unconnectedNodes];
};

