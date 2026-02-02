import toposort from "toposort";

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
  const unconnectedNodes = nodes.filter((node) => !connectedNodeIds.has(node.id));

  // Return sorted connected nodes first, then unconnected nodes
  return [...sortedNodes, ...unconnectedNodes];
};

/**
 * Groups topologically sorted nodes by dependency level.
 * Nodes at the same level have no dependencies on each other and can run in parallel.
 *
 * @param sortedNodes - Nodes already in topological order
 * @param connections - Workflow connections (source -> target)
 * @returns Array of levels; each level is an array of nodes that can execute in parallel
 */
export function groupNodesByLevel(
  sortedNodes: any[],
  connections: any[]
): any[][] {
  const nodeIdSet = new Set(sortedNodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of sortedNodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const conn of connections) {
    if (!nodeIdSet.has(conn.source) || !nodeIdSet.has(conn.target)) {
      continue;
    }
    inDegree.set(conn.target, (inDegree.get(conn.target) ?? 0) + 1);
    adjacency.get(conn.source)!.push(conn.target);
  }

  const nodeMap = new Map(sortedNodes.map((n) => [n.id, n]));
  const levels: any[][] = [];
  let current = sortedNodes.filter((n) => inDegree.get(n.id) === 0);

  while (current.length > 0) {
    levels.push(current);
    const nextIds: string[] = [];
    for (const node of current) {
      for (const childId of adjacency.get(node.id) ?? []) {
        const newDegree = (inDegree.get(childId) ?? 0) - 1;
        inDegree.set(childId, newDegree);
        if (newDegree === 0) {
          nextIds.push(childId);
        }
      }
    }
    current = nextIds.map((id) => nodeMap.get(id)).filter((n): n is any => n != null);
  }

  return levels;
}
