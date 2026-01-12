export interface NodePosition {
  x: number;
  y: number;
}

export interface CalculatePositionsOptions {
  nodeCount: number;
  startX?: number;
  startY?: number;
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalSpacing?: number;
  verticalSpacing?: number;
  nodesPerRow?: number;
}

/**
 * Calculates optimal positions for workflow nodes in a grid layout
 */
export const calculateNodePositions = (options: CalculatePositionsOptions): NodePosition[] => {
  const {
    nodeCount,
    startX = 100,
    startY = 100,
    nodeWidth = 200,
    nodeHeight = 100,
    horizontalSpacing = 250,
    verticalSpacing = 150,
    nodesPerRow = 3,
  } = options;

  const positions: NodePosition[] = [];

  for (let i = 0; i < nodeCount; i++) {
    const row = Math.floor(i / nodesPerRow);
    const col = i % nodesPerRow;

    positions.push({
      x: startX + col * (nodeWidth + horizontalSpacing),
      y: startY + row * (nodeHeight + verticalSpacing),
    });
  }

  return positions;
};

/**
 * Calculates positions for a workflow with connections
 * Positions nodes in layers based on their connection depth
 * Centers the entire layout around origin (0, 0) for proper fitView centering
 */
export const calculateWorkflowPositions = (params: {
  nodes: Array<{ id: string; type: string }>;
  connections: Array<{ source: string; target: string }>;
  startX?: number;
  startY?: number;
  horizontalSpacing?: number;
  verticalSpacing?: number;
}): Map<string, NodePosition> => {
  const {
    nodes,
    connections,
    startX = 0, // Start at origin for centering
    startY = 0, // Start at origin for centering
    horizontalSpacing = 350, // Increased for better horizontal spread
    verticalSpacing = 200, // Increased for better vertical spread
  } = params;

  const positions = new Map<string, NodePosition>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build adjacency list
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  nodes.forEach((node) => {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  });

  connections.forEach((conn) => {
    outgoing.get(conn.source)?.push(conn.target);
    incoming.get(conn.target)?.push(conn.source);
  });

  // Find nodes with no incoming edges (starting nodes)
  const startNodes = nodes.filter((node) => {
    const incomingEdges = incoming.get(node.id) || [];
    return incomingEdges.length === 0;
  });

  // Simple BFS-based layering
  const layers: string[][] = [];
  const visited = new Set<string>();
  const layerMap = new Map<string, number>();

  // Start with nodes that have no incoming edges
  if (startNodes.length > 0) {
    const queue: Array<{ nodeId: string; layer: number }> = startNodes.map((n) => ({
      nodeId: n.id,
      layer: 0,
    }));

    while (queue.length > 0) {
      const { nodeId, layer } = queue.shift()!;

      if (visited.has(nodeId)) {
        continue;
      }

      visited.add(nodeId);
      layerMap.set(nodeId, layer);

      if (!layers[layer]) {
        layers[layer] = [];
      }
      layers[layer].push(nodeId);

      // Add children to next layer
      const children = outgoing.get(nodeId) || [];
      children.forEach((childId) => {
        if (!visited.has(childId)) {
          queue.push({ nodeId: childId, layer: layer + 1 });
        }
      });
    }
  }

  // Handle isolated nodes
  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      const maxLayer = layers.length;
      if (!layers[maxLayer]) {
        layers[maxLayer] = [];
      }
      layers[maxLayer].push(node.id);
      layerMap.set(node.id, maxLayer);
    }
  });

  // Calculate bounding box first to center the entire layout
  const nodeWidth = 200;
  const nodeHeight = 100;
  let totalWidth = 0;
  let totalHeight = layers.length * verticalSpacing;

  // Find the maximum width across all layers
  layers.forEach((layerNodes) => {
    const layerWidth = Math.max(0, (layerNodes.length - 1) * horizontalSpacing);
    totalWidth = Math.max(totalWidth, layerWidth);
  });

  // Calculate positions based on layers, centered around origin
  layers.forEach((layerNodes, layerIndex) => {
    // Center vertically: start from negative half-height to positive half-height
    const layerY =
      -(totalHeight / 2) + layerIndex * verticalSpacing + totalHeight / layers.length / 2;

    // Center horizontally: start from negative half-width to positive half-width
    const nodesInLayer = layerNodes.length;
    const layerWidth = Math.max(0, (nodesInLayer - 1) * horizontalSpacing);
    const startLayerX = -(layerWidth / 2);

    layerNodes.forEach((nodeId, indexInLayer) => {
      positions.set(nodeId, {
        x: startLayerX + indexInLayer * horizontalSpacing,
        y: layerY,
      });
    });
  });

  return positions;
};
