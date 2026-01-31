import { basePrismaClient } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { NodeType } from "../lib/node-types";

const prismaClient = basePrismaClient as any;

export interface CreateWorkflowData {
  name: string;
  userId: string;
}

export interface UpdateWorkflowData {
  name: string;
}

export interface SaveWorkflowData {
  name?: string;
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    position: { x: number; y: number };
    data?: Record<string, any>;
  }>;
  connections: Array<{
    id?: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
}

export interface NodeResponse {
  id: string;
  workflowId: string;
  name: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectionResponse {
  id: string;
  workflowId: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to transform database connection to API response format
function transformConnection(connection: any): ConnectionResponse {
  return {
    id: connection.id,
    workflowId: connection.workflowId,
    source: connection.fromNodeId,
    target: connection.toNodeId,
    sourceHandle: connection.fromOutput,
    targetHandle: connection.toInput,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

/**
 * Strip base64 data URLs from node.data to reduce response size
 * Base64 images/audio are stored in NodeAsset table and loaded during execution
 * Frontend only needs metadata, not the actual binary data
 */
function stripBase64FromData(data: any): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => stripBase64FromData(item));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      // Check if it's a base64 data URL (images, audio, etc.)
      if (value.startsWith("data:") && value.includes("base64,")) {
        // Replace with placeholder - frontend knows asset exists
        const mimeMatch = value.match(/^data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : "unknown";
        result[key] = `[base64:${mimeType}]`;
      } else if (value.length > 100000) {
        // Any string over 100KB is likely binary/base64 data
        result[key] = `[large-data:${Math.round(value.length / 1024)}KB]`;
      } else {
        result[key] = value;
      }
    } else if (typeof value === "object" && value !== null) {
      result[key] = stripBase64FromData(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Helper function to transform workflow WITHOUT merging assets (for execution)
// This prevents large base64 data from being in node.data during execution
function transformWorkflowForExecution(workflow: any): any {
  return {
    id: workflow.id,
    name: workflow.name,
    userId: workflow.userId,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
    nodes: workflow.nodes || [],
    connections: (workflow.connections || []).map(transformConnection),
  };
}

// Helper function to transform workflow with connections
// Merges assets/images back into node.data for frontend compatibility
function transformWorkflow(workflow: any): WorkflowResponse {
  const transformedNodes = (workflow.nodes || []).map((node: any) => {
    const nodeData = { ...(node.data || {}) };

    if (node.type === "REMOTION" && node.assets && node.assets.length > 0) {
      // Find background audio asset
      const backgroundAudioAsset = node.assets.find((a: any) => a.isBackgroundAudio);
      if (backgroundAudioAsset) {
        // Only set fileData if it exists (execution context), otherwise keep existing or use placeholder
        if (backgroundAudioAsset.fileData) {
          nodeData.backgroundAudio = backgroundAudioAsset.fileData;
        } else if (!nodeData.backgroundAudio) {
          // Placeholder for frontend - indicates asset exists but data not loaded
          nodeData.backgroundAudio = `asset:${backgroundAudioAsset.filename}`;
        }
        nodeData.backgroundAudioFilename = backgroundAudioAsset.filename;
        nodeData.backgroundAudioVolume = backgroundAudioAsset.volume ?? 0.7;
      }

      // Find regular assets
      const regularAssets = node.assets.filter((a: any) => !a.isBackgroundAudio);
      if (regularAssets.length > 0) {
        nodeData.assets = regularAssets.map((asset: any) => ({
          file: asset.fileData || `asset:${asset.filename}`, // Placeholder if no fileData
          filename: asset.filename,
          type: asset.fileType,
          sceneDescription: asset.sceneDescription || undefined,
          startTime: asset.startTime ?? undefined,
          position: asset.position || undefined,
          size: asset.size || undefined,
        }));
      }
    }

    // For DESIGN_PRO nodes, merge images back into node.data
    if (node.type === "DESIGN_PRO" && node.assets && node.assets.length > 0) {
      const nodeMode = (nodeData.mode as string) || "generate";
      const isEditWithReferences = nodeMode === "editWithReferences";

      if (isEditWithReferences) {
        // For editWithReferences, ALL assets are reference images (no source image required)
        // Source image is optional and comes from node.data.sourceImage if provided (as URL)
        nodeData.referenceImages = node.assets.map((asset: any) => ({
          image: asset.fileData || `asset:${asset.filename}`,
          filename: asset.filename,
          mimeType:
            asset.fileData && asset.fileData.startsWith("data:")
              ? asset.fileData.match(/data:([^;]+)/)?.[1] || "image/png"
              : "image/png",
        }));
      } else {
        // For other modes (edit, chat), first asset is source image
        const sourceImageAsset = node.assets[0];
        if (sourceImageAsset) {
          if (sourceImageAsset.fileData) {
            // We have the actual file data - use it
            nodeData.sourceImage = sourceImageAsset.fileData;
            nodeData.sourceImageMimeType = sourceImageAsset.fileData.startsWith("data:")
              ? sourceImageAsset.fileData.match(/data:([^;]+)/)?.[1] || "image/png"
              : "image/png";
            nodeData.sourceImageFilename = sourceImageAsset.filename;
          } else {
            // No fileData (metadata-only load) - create placeholder
            // Always set placeholder, even if nodeData.sourceImage exists (it might be stale)
            nodeData.sourceImage = `asset:${sourceImageAsset.filename}`;
            nodeData.sourceImageMimeType = "image/png";
            nodeData.sourceImageFilename = sourceImageAsset.filename;
          }
        }

        // All other images are reference images
        const referenceImageAssets = node.assets.filter((a: any, idx: number) => idx !== 0);
        if (referenceImageAssets.length > 0) {
          nodeData.referenceImages = referenceImageAssets.map((asset: any) => ({
            image: asset.fileData || `asset:${asset.filename}`,
            filename: asset.filename,
            mimeType:
              asset.fileData && asset.fileData.startsWith("data:")
                ? asset.fileData.match(/data:([^;]+)/)?.[1] || "image/png"
                : "image/png",
          }));
        }
      }
    }

    // For VEO nodes, merge assets back into node.data
    if (node.type === "VEO" && node.assets && node.assets.length > 0) {
      // Source image
      const sourceImageAsset = node.assets.find((a: any) => a.fileType === "veo-source-image");
      if (sourceImageAsset) {
        nodeData.sourceImage = sourceImageAsset.fileData || `asset:${sourceImageAsset.filename}`;
        nodeData.sourceImageFilename = sourceImageAsset.filename;
      }

      // Reference images
      const referenceAssets = node.assets.filter((a: any) => a.fileType === "veo-reference-image");
      if (referenceAssets.length > 0) {
        nodeData.referenceImages = referenceAssets.map((asset: any) => ({
          file: asset.fileData || `asset:${asset.filename}`,
          filename: asset.filename,
        }));
      }

      // First frame
      const firstFrameAsset = node.assets.find((a: any) => a.fileType === "veo-first-frame");
      if (firstFrameAsset) {
        nodeData.firstFrame = firstFrameAsset.fileData || `asset:${firstFrameAsset.filename}`;
        nodeData.firstFrameFilename = firstFrameAsset.filename;
      }

      // Last frame
      const lastFrameAsset = node.assets.find((a: any) => a.fileType === "veo-last-frame");
      if (lastFrameAsset) {
        nodeData.lastFrame = lastFrameAsset.fileData || `asset:${lastFrameAsset.filename}`;
        nodeData.lastFrameFilename = lastFrameAsset.filename;
      }

      // Source video
      const sourceVideoAsset = node.assets.find((a: any) => a.fileType === "veo-source-video");
      if (sourceVideoAsset) {
        nodeData.sourceVideo = sourceVideoAsset.fileData || `asset:${sourceVideoAsset.filename}`;
        nodeData.sourceVideoFilename = sourceVideoAsset.filename;
      }
    }

    // Only update data if we modified it
    if (node.type === "REMOTION" || node.type === "DESIGN_PRO" || node.type === "VEO") {
      return {
        ...node,
        data: nodeData,
      };
    }

    return node;
  });

  return {
    id: workflow.id,
    name: workflow.name,
    userId: workflow.userId,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
    nodes: transformedNodes,
    connections: (workflow.connections || []).map(transformConnection),
  };
}

export interface WorkflowResponse {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  nodes: NodeResponse[];
  connections: ConnectionResponse[];
}

export interface WorkflowsListResponse {
  workflows: WorkflowResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Create a new workflow
 * Names must be unique per user (case-insensitive).
 */
export const createWorkflow = async (data: CreateWorkflowData): Promise<WorkflowResponse> => {
  if (!data.name || data.name.trim() === "") {
    throw new AppError("Workflow name is required", 400);
  }

  if (!data.userId) {
    throw new AppError("User ID is required", 400);
  }

  // Verify user exists
  const user = await prismaClient.user.findUnique({
    where: { id: data.userId },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const trimmedName = data.name.trim();

  // Ensure no workflow with the same name exists for this user (case-insensitive)
  const existing = await prismaClient.workflow.findFirst({
    where: {
      userId: data.userId,
      name: { equals: trimmedName, mode: "insensitive" },
    },
  });
  if (existing) {
    throw new AppError(
      `A workflow named "${trimmedName}" already exists. Please choose a different name.`,
      409
    );
  }

  const workflow = await prismaClient.workflow.create({
    data: {
      name: trimmedName,
      userId: data.userId,
      nodes: {
        create: {
          name: NodeType.INITIAL,
          type: NodeType.INITIAL,
          position: { x: 0, y: 0 },
        },
      },
    },
    include: {
      nodes: true,
      connections: true,
    },
  });

  return transformWorkflow(workflow);
};

/**
 * Get workflows with pagination and search
 */
export const getWorkflows = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
  search?: string
): Promise<WorkflowsListResponse> => {
  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  const skip = (page - 1) * limit;
  const take = limit;

  // Build where clause
  const where: any = {
    userId,
  };

  if (search && search.trim() !== "") {
    where.name = {
      contains: search.trim(),
      mode: "insensitive",
    };
  }

  // Get total count
  const total = await prismaClient.workflow.count({ where });

  // Get workflows WITHOUT node.data to avoid 5MB Accelerate limit
  // For list view, we only need basic node info (id, name, type, position)
  const workflows = await prismaClient.workflow.findMany({
    where,
    skip,
    take,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      connections: true,
      nodes: {
        select: {
          id: true,
          workflowId: true,
          name: true,
          type: true,
          position: true,
          credentialId: true,
          createdAt: true,
          updatedAt: true,
          // EXCLUDE data field - not needed for list view and can be huge
        },
      },
    },
  });

  const totalPages = Math.ceil(total / limit);

  return {
    workflows: workflows.map((workflow: any) => ({
      id: workflow.id,
      name: workflow.name,
      userId: workflow.userId,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      nodes: (workflow.nodes || []).map((node: any) => ({
        ...node,
        data: {}, // Empty data for list view - full data loaded when viewing individual workflow
      })),
      connections: (workflow.connections || []).map(transformConnection),
    })),
    total,
    page,
    limit,
    totalPages: totalPages || 1,
  };
};

/**
 * Get a single workflow by ID (with user validation)
 */
// Get workflow for execution (doesn't include assets - executors load them separately)
export const getWorkflowForExecution = async (id: string, userId: string): Promise<any> => {
  if (!id) {
    throw new AppError("Workflow ID is required", 400);
  }

  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  // Load workflow WITHOUT node.data first to avoid 5MB limit
  const workflow = await prismaClient.workflow.findFirst({
    where: { id, userId },
    select: {
      id: true,
      name: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      connections: true,
      nodes: {
        select: {
          id: true,
          workflowId: true,
          name: true,
          type: true,
          position: true,
          credentialId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!workflow) {
    throw new AppError("Workflow not found", 404);
  }

  const nodeIds = workflow.nodes.map((n: any) => n.id);

  // Load node.data ONE AT A TIME and strip base64 to stay under 5MB limit
  // Executors load actual assets from NodeAsset table during step.run()
  const nodeDataMap = new Map<string, any>();

  for (const nodeId of nodeIds) {
    try {
      const nodeRecord = await prismaClient.node.findUnique({
        where: { id: nodeId },
        select: { id: true, data: true },
      });
      if (nodeRecord) {
        // Strip base64 - executors load assets from NodeAsset table
        const cleanedData = stripBase64FromData(nodeRecord.data || {});
        nodeDataMap.set(nodeId, cleanedData);
      }
    } catch (error: any) {
      console.warn(`Node ${nodeId} data exceeds 5MB limit, returning empty data`);
      nodeDataMap.set(nodeId, { _dataExceedsLimit: true });
    }
  }

  // Reconstruct workflow with cleaned node data
  const workflowWithData = {
    ...workflow,
    nodes: workflow.nodes.map((node: any) => ({
      ...node,
      data: nodeDataMap.get(node.id) || {},
    })),
  };

  // Return workflow WITHOUT assets
  // Executors will load assets separately from database inside their step.run() calls
  return transformWorkflowForExecution(workflowWithData);
};

export const getWorkflow = async (id: string, userId: string): Promise<WorkflowResponse> => {
  if (!id) {
    throw new AppError("Workflow ID is required", 400);
  }

  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  // Load workflow WITHOUT node.data to avoid 5MB Accelerate limit
  // node.data can contain massive base64 images (8MB+ per node) that exceed the limit
  const workflow = await prismaClient.workflow.findFirst({
    where: { id, userId },
    select: {
      id: true,
      name: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      connections: true,
      nodes: {
        select: {
          id: true,
          workflowId: true,
          name: true,
          type: true,
          position: true,
          credentialId: true,
          createdAt: true,
          updatedAt: true,
          // EXCLUDE data field - it contains large base64 images (8MB+)
        },
      },
    },
  });

  if (!workflow) {
    throw new AppError("Workflow not found", 404);
  }

  const nodeIds = workflow.nodes.map((n: any) => n.id);

  // Load node.data ONE AT A TIME and strip base64 to stay under 5MB limit
  // Some nodes have 8MB+ of base64 data that would exceed the limit
  const nodeDataMap = new Map<string, any>();

  for (const nodeId of nodeIds) {
    try {
      const nodeRecord = await prismaClient.node.findUnique({
        where: { id: nodeId },
        select: { id: true, data: true },
      });
      if (nodeRecord) {
        // Strip base64 data from node.data - frontend doesn't need it
        // Base64 data is loaded from NodeAsset table during execution
        const cleanedData = stripBase64FromData(nodeRecord.data || {});
        nodeDataMap.set(nodeId, cleanedData);
      }
    } catch (error: any) {
      // If this single node exceeds 5MB, return empty data
      // The node likely has huge base64 that should be in NodeAsset table
      console.warn(`Node ${nodeId} data exceeds 5MB limit, returning empty data`);
      nodeDataMap.set(nodeId, { _dataExceedsLimit: true });
    }
  }

  // Load assets WITH fileData for nodes that need them (VEO, DESIGN_PRO, REMOTION)
  // Load EACH ASSET ONE AT A TIME to avoid 5MB limit per query
  const assetsByNodeId = new Map<string, any[]>();

  for (const node of workflow.nodes) {
    const nodeType = node.type as string;
    const needsAssets = ["VEO", "DESIGN_PRO", "REMOTION"].includes(nodeType);

    if (needsAssets) {
      // First, get asset IDs for this node (small query)
      const assetIds = await prismaClient.nodeAsset.findMany({
        where: { nodeId: node.id },
        select: { id: true },
      });

      if (assetIds.length > 0) {
        const nodeAssets: any[] = [];

        // Load each asset individually to avoid 5MB limit
        for (const { id: assetId } of assetIds) {
          try {
            const asset = await prismaClient.nodeAsset.findUnique({
              where: { id: assetId },
            });
            if (asset) {
              nodeAssets.push(asset);
            }
          } catch (error: any) {
            // Single asset exceeds 5MB - load metadata only for this asset
            console.warn(`Asset ${assetId} exceeds 5MB, loading metadata only`);
            const metadataOnly = await prismaClient.nodeAsset.findUnique({
              where: { id: assetId },
              select: {
                id: true,
                nodeId: true,
                filename: true,
                fileType: true,
                sceneDescription: true,
                startTime: true,
                position: true,
                size: true,
                isBackgroundAudio: true,
                volume: true,
                createdAt: true,
                updatedAt: true,
              },
            });
            if (metadataOnly) {
              nodeAssets.push(metadataOnly);
            }
          }
        }

        if (nodeAssets.length > 0) {
          assetsByNodeId.set(node.id, nodeAssets);
        }
      }
    }
  }

  // Reconstruct workflow with cleaned node data and assets
  const workflowWithData = {
    ...workflow,
    nodes: workflow.nodes.map((node: any) => ({
      ...node,
      data: nodeDataMap.get(node.id) || {},
      assets: assetsByNodeId.get(node.id) || [],
    })),
  };

  return transformWorkflow(workflowWithData);
};

/**
 * Get a single workflow by ID (without user validation - for public endpoints like webhooks)
 */
export const getWorkflowById = async (id: string): Promise<WorkflowResponse> => {
  if (!id) {
    throw new AppError("Workflow ID is required", 400);
  }

  // Load workflow WITHOUT node.data to avoid 5MB Accelerate limit
  const workflow = await prismaClient.workflow.findFirst({
    where: { id },
    select: {
      id: true,
      name: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      connections: true,
      nodes: {
        select: {
          id: true,
          workflowId: true,
          name: true,
          type: true,
          position: true,
          credentialId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!workflow) {
    throw new AppError("Workflow not found", 404);
  }

  const nodeIds = workflow.nodes.map((n: any) => n.id);

  // Load node.data ONE AT A TIME and strip base64 to stay under 5MB limit
  const nodeDataMap = new Map<string, any>();

  for (const nodeId of nodeIds) {
    try {
      const nodeRecord = await prismaClient.node.findUnique({
        where: { id: nodeId },
        select: { id: true, data: true },
      });
      if (nodeRecord) {
        const cleanedData = stripBase64FromData(nodeRecord.data || {});
        nodeDataMap.set(nodeId, cleanedData);
      }
    } catch (error: any) {
      console.warn(`Node ${nodeId} data exceeds 5MB limit, returning empty data`);
      nodeDataMap.set(nodeId, { _dataExceedsLimit: true });
    }
  }

  // Load assets WITH fileData for nodes that need them (VEO, DESIGN_PRO, REMOTION)
  // Load EACH ASSET ONE AT A TIME to avoid 5MB limit per query
  const assetsByNodeId = new Map<string, any[]>();

  for (const node of workflow.nodes) {
    const nodeType = node.type as string;
    const needsAssets = ["VEO", "DESIGN_PRO", "REMOTION"].includes(nodeType);

    if (needsAssets) {
      // First, get asset IDs for this node (small query)
      const assetIds = await prismaClient.nodeAsset.findMany({
        where: { nodeId: node.id },
        select: { id: true },
      });

      if (assetIds.length > 0) {
        const nodeAssets: any[] = [];

        // Load each asset individually to avoid 5MB limit
        for (const { id: assetId } of assetIds) {
          try {
            const asset = await prismaClient.nodeAsset.findUnique({
              where: { id: assetId },
            });
            if (asset) {
              nodeAssets.push(asset);
            }
          } catch (error: any) {
            // Single asset exceeds 5MB - load metadata only for this asset
            console.warn(`Asset ${assetId} exceeds 5MB, loading metadata only`);
            const metadataOnly = await prismaClient.nodeAsset.findUnique({
              where: { id: assetId },
              select: {
                id: true,
                nodeId: true,
                filename: true,
                fileType: true,
                sceneDescription: true,
                startTime: true,
                position: true,
                size: true,
                isBackgroundAudio: true,
                volume: true,
                createdAt: true,
                updatedAt: true,
              },
            });
            if (metadataOnly) {
              nodeAssets.push(metadataOnly);
            }
          }
        }

        if (nodeAssets.length > 0) {
          assetsByNodeId.set(node.id, nodeAssets);
        }
      }
    }
  }

  // Reconstruct workflow with cleaned node data and assets
  const workflowWithData = {
    ...workflow,
    nodes: workflow.nodes.map((node: any) => ({
      ...node,
      data: nodeDataMap.get(node.id) || {},
      assets: assetsByNodeId.get(node.id) || [],
    })),
  };

  return transformWorkflow(workflowWithData);
};

/**
 * Update a workflow name only
 */
export const updateWorkflowName = async (
  id: string,
  userId: string,
  data: UpdateWorkflowData
): Promise<WorkflowResponse> => {
  if (!id) {
    throw new AppError("Workflow ID is required", 400);
  }

  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  if (!data.name || data.name.trim() === "") {
    throw new AppError("Workflow name is required", 400);
  }

  // Verify workflow exists and belongs to user
  const existingWorkflow = await prismaClient.workflow.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!existingWorkflow) {
    throw new AppError("Workflow not found", 404);
  }

  const trimmedName = data.name.trim();

  // Ensure no other workflow has the same name for this user (case-insensitive)
  const duplicate = await prismaClient.workflow.findFirst({
    where: {
      userId,
      id: { not: id },
      name: { equals: trimmedName, mode: "insensitive" },
    },
  });
  if (duplicate) {
    throw new AppError(
      `A workflow named "${trimmedName}" already exists. Please choose a different name.`,
      409
    );
  }

  const workflow = await prismaClient.workflow.update({
    where: { id },
    data: {
      name: trimmedName,
    },
    include: {
      nodes: true,
      connections: true,
    },
  });

  return transformWorkflow(workflow);
};

/**
 * Update workflow with nodes and connections
 * This will delete all existing nodes and connections and create new ones
 */
export const updateWorkflowData = async (
  id: string,
  userId: string,
  data: SaveWorkflowData
): Promise<WorkflowResponse> => {
  if (!id) {
    throw new AppError("Workflow ID is required", 400);
  }

  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  // Verify workflow exists and belongs to user
  const existingWorkflow = await prismaClient.workflow.findFirst({
    where: { id, userId },
  });

  if (!existingWorkflow) {
    throw new AppError("Workflow not found", 404);
  }

  // Validate nodes
  if (!Array.isArray(data.nodes)) {
    throw new AppError("Nodes must be an array", 400);
  }

  // Validate that all nodes have IDs (required for connection references)
  for (const node of data.nodes) {
    if (!node.id || node.id.trim() === "") {
      throw new AppError("All nodes must have an ID to maintain connection references", 400);
    }
  }

  // Validate connections
  if (!Array.isArray(data.connections)) {
    throw new AppError("Connections must be an array", 400);
  }

  // ============================================================================
  // ALL HEAVY PREP WORK HAPPENS OUTSIDE THE TRANSACTION (to stay under 15s limit)
  // ============================================================================

  const assetsByNodeId: Record<
    string,
    Array<{
      filename: string;
      fileType: string;
      fileData: string;
      sceneDescription?: string;
      startTime?: number;
      position?: any;
      size?: any;
      isBackgroundAudio: boolean;
      volume?: number;
    }>
  > = {};

  // Create copies of nodes and connections that we can modify if IDs need to be remapped
  const nodesToProcess = [...data.nodes];
  const connectionsToProcess = [...data.connections];
  let nodeIds = new Set(nodesToProcess.map((node) => node.id?.trim()).filter(Boolean));

  // Check for duplicate IDs in the nodes array
  if (nodesToProcess.length > 0) {
    const seenIds = new Set<string>();
    for (const node of nodesToProcess) {
      const nodeId = node.id?.trim();
      if (!nodeId) {
        throw new AppError(`Node is missing required ID.`, 400);
      }
      if (seenIds.has(nodeId)) {
        throw new AppError(`Duplicate node ID: ${nodeId}. Each node must have a unique ID.`, 400);
      }
      seenIds.add(nodeId);
    }
  }

  // Check for conflicting node IDs in other workflows (OUTSIDE transaction)
  const nodeIdsToCreate = nodesToProcess.map((n) => n.id?.trim()).filter(Boolean);
  const existingNodes =
    nodeIdsToCreate.length > 0
      ? await prismaClient.node.findMany({
          where: { id: { in: nodeIdsToCreate }, workflowId: { not: id } },
          select: { id: true, workflowId: true },
        })
      : [];

  // Remap conflicting IDs
  const idMap = new Map<string, string>();
  if (existingNodes.length > 0) {
    for (const existingNode of existingNodes) {
      const newId = `${existingNode.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      idMap.set(existingNode.id, newId);
    }
    for (let i = 0; i < nodesToProcess.length; i++) {
      const oldId = nodesToProcess[i].id?.trim();
      if (oldId && idMap.has(oldId)) {
        nodesToProcess[i].id = idMap.get(oldId)!;
        nodeIds.delete(oldId);
        nodeIds.add(nodesToProcess[i].id);
      }
    }
    for (const conn of connectionsToProcess) {
      if (conn.source && idMap.has(conn.source)) conn.source = idMap.get(conn.source)!;
      if (conn.target && idMap.has(conn.target)) conn.target = idMap.get(conn.target)!;
    }
  }

  // Build nodesToCreate array with asset extraction (CPU intensive - OUTSIDE transaction)
  const nodesToCreate = nodesToProcess
    .map((node) => {
      if (node.type && !Object.values(NodeType).includes(node.type as any)) {
        throw new AppError(`Invalid node type: ${node.type}`, 400);
      }
      if (!node.id?.trim()) throw new AppError(`Node missing ID`, 400);
      if (!node.name?.trim()) throw new AppError(`Node ${node.id} missing name`, 400);
      if (!node.type) throw new AppError(`Node ${node.id} missing type`, 400);

      const nodeData = node.data || {};
      const assetsToStore: Array<{
        filename: string;
        fileType: string;
        fileData: string;
        sceneDescription?: string;
        startTime?: number;
        position?: any;
        size?: any;
        isBackgroundAudio: boolean;
        volume?: number;
      }> = [];

      // Extract REMOTION assets
      if (node.type === "REMOTION" && nodeData) {
        if (nodeData.backgroundAudio && nodeData.backgroundAudioFilename) {
          assetsToStore.push({
            filename: nodeData.backgroundAudioFilename,
            fileType: "audio",
            fileData: nodeData.backgroundAudio,
            isBackgroundAudio: true,
            volume: nodeData.backgroundAudioVolume ?? 0.7,
          });
          delete nodeData.backgroundAudio;
          delete nodeData.backgroundAudioFilename;
          delete nodeData.backgroundAudioVolume;
        }
        if (Array.isArray(nodeData.assets) && nodeData.assets.length > 0) {
          assetsToStore.push(
            ...nodeData.assets.map((a: any) => ({
              filename: a.filename,
              fileType: a.type || "image",
              fileData: a.file,
              sceneDescription: a.sceneDescription,
              startTime: a.startTime,
              position: a.position,
              size: a.size,
              isBackgroundAudio: false,
            }))
          );
          delete nodeData.assets;
        }
      }

      // Extract DESIGN_PRO assets
      if (node.type === "DESIGN_PRO" && nodeData) {
        const isEditWithRefs = (nodeData.mode as string) === "editWithReferences";
        if (!isEditWithRefs && nodeData.sourceImage && !nodeData.sourceImage.startsWith("asset:")) {
          assetsToStore.push({
            filename: nodeData.sourceImageFilename || "source-image.png",
            fileType: "image",
            fileData: nodeData.sourceImage,
            isBackgroundAudio: false,
          });
          delete nodeData.sourceImage;
          delete nodeData.sourceImageMimeType;
          delete nodeData.sourceImageFilename;
        } else if (nodeData.sourceImage?.startsWith("asset:")) {
          delete nodeData.sourceImage;
          delete nodeData.sourceImageMimeType;
          delete nodeData.sourceImageFilename;
        }
        if (Array.isArray(nodeData.referenceImages) && nodeData.referenceImages.length > 0) {
          const validRefs = nodeData.referenceImages.filter(
            (r: any) => r.image && !r.image.startsWith("asset:")
          );
          if (validRefs.length > 0) {
            assetsToStore.push(
              ...validRefs.map((r: any) => ({
                filename: r.filename || "reference-image.png",
                fileType: "image",
                fileData: r.image,
                isBackgroundAudio: false,
              }))
            );
          }
          delete nodeData.referenceImages;
        }
      }

      // Extract VEO assets (sourceImage, referenceImages, firstFrame, lastFrame, sourceVideo)
      if (node.type === "VEO" && nodeData) {
        // Source image
        if (nodeData.sourceImage && nodeData.sourceImage.startsWith("data:")) {
          assetsToStore.push({
            filename: nodeData.sourceImageFilename || "source-image.png",
            fileType: "veo-source-image",
            fileData: nodeData.sourceImage,
            isBackgroundAudio: false,
          });
          delete nodeData.sourceImage;
          delete nodeData.sourceImageFilename;
        }
        // Reference images (array of {file: base64, filename})
        if (Array.isArray(nodeData.referenceImages) && nodeData.referenceImages.length > 0) {
          const validRefs = nodeData.referenceImages.filter(
            (r: any) => r.file && r.file.startsWith("data:")
          );
          validRefs.forEach((r: any, idx: number) => {
            assetsToStore.push({
              filename: r.filename || `reference-${idx + 1}.png`,
              fileType: "veo-reference-image",
              fileData: r.file,
              isBackgroundAudio: false,
            });
          });
          delete nodeData.referenceImages;
        }
        // First frame
        if (nodeData.firstFrame && nodeData.firstFrame.startsWith("data:")) {
          assetsToStore.push({
            filename: nodeData.firstFrameFilename || "first-frame.png",
            fileType: "veo-first-frame",
            fileData: nodeData.firstFrame,
            isBackgroundAudio: false,
          });
          delete nodeData.firstFrame;
          delete nodeData.firstFrameFilename;
        }
        // Last frame
        if (nodeData.lastFrame && nodeData.lastFrame.startsWith("data:")) {
          assetsToStore.push({
            filename: nodeData.lastFrameFilename || "last-frame.png",
            fileType: "veo-last-frame",
            fileData: nodeData.lastFrame,
            isBackgroundAudio: false,
          });
          delete nodeData.lastFrame;
          delete nodeData.lastFrameFilename;
        }
        // Source video
        if (nodeData.sourceVideo && nodeData.sourceVideo.startsWith("data:")) {
          assetsToStore.push({
            filename: nodeData.sourceVideoFilename || "source-video.mp4",
            fileType: "veo-source-video",
            fileData: nodeData.sourceVideo,
            isBackgroundAudio: false,
          });
          delete nodeData.sourceVideo;
          delete nodeData.sourceVideoFilename;
        }
      }

      if (assetsToStore.length > 0) {
        assetsByNodeId[node.id.trim()] = assetsToStore;
      }

      return {
        id: node.id.trim(),
        workflowId: id,
        name: (node.name || node.id).trim(),
        type: node.type as any,
        position: node.position || { x: 0, y: 0 },
        data: nodeData,
      };
    })
    .filter((n) => n.id && n.type);

  // Build connectionsToCreate array (CPU intensive - OUTSIDE transaction)
  const validConnections = connectionsToProcess.filter(
    (conn: any) => nodeIds.has(conn.source) && nodeIds.has(conn.target)
  );
  const seenConnKeys = new Set<string>();
  const uniqueConnections = validConnections.filter((conn: any) => {
    const key = `${conn.source}:${conn.target}:${conn.sourceHandle || "main"}:${conn.targetHandle || "main"}`;
    if (seenConnKeys.has(key)) return false;
    seenConnKeys.add(key);
    return true;
  });
  const connectionsToCreate = uniqueConnections.map((conn: any) => ({
    workflowId: id,
    fromNodeId: conn.source,
    toNodeId: conn.target,
    fromOutput: conn.sourceHandle || "main",
    toInput: conn.targetHandle || "main",
  }));

  // ============================================================================
  // NO TRANSACTION: Prisma Accelerate has 15s hard limit, cascade deletes take too long
  // Do sequential operations - if any fail, user can retry the save
  // ============================================================================

  // Step 1: Delete existing connections (must be first due to foreign key constraints)
  await prismaClient.connection.deleteMany({ where: { workflowId: id } });

  // Step 2: Delete existing nodes (this cascade-deletes NodeAssets)
  await prismaClient.node.deleteMany({ where: { workflowId: id } });

  // Step 3: Update workflow name if provided (must be unique per user)
  if (data.name?.trim()) {
    const newName = data.name.trim();
    const duplicate = await prismaClient.workflow.findFirst({
      where: {
        userId,
        id: { not: id },
        name: { equals: newName, mode: "insensitive" },
      },
    });
    if (duplicate) {
      throw new AppError(
        `A workflow named "${newName}" already exists. Please choose a different name.`,
        409
      );
    }
    await prismaClient.workflow.update({ where: { id }, data: { name: newName } });
  }

  // Step 4: Create nodes
  if (nodesToCreate.length > 0) {
    const result = await prismaClient.node.createMany({ data: nodesToCreate });
    if (result.count !== nodesToCreate.length) {
      throw new AppError(
        `Failed to create nodes: expected ${nodesToCreate.length}, got ${result.count}`,
        500
      );
    }
  }

  // Step 5: Create connections
  if (connectionsToCreate.length > 0) {
    const result = await prismaClient.connection.createMany({ data: connectionsToCreate });
    if (result.count !== connectionsToCreate.length) {
      throw new AppError(
        `Failed to create connections: expected ${connectionsToCreate.length}, got ${result.count}`,
        500
      );
    }
  }

  // Step 6: Fetch workflow (without large node data to avoid 5MB Accelerate limit)
  const workflowBase = await prismaClient.workflow.findUnique({
    where: { id },
    select: { id: true, name: true, userId: true, createdAt: true, updatedAt: true },
  });

  if (!workflowBase) {
    throw new AppError("Workflow not found after update", 500);
  }

  // Build workflow response from data we already have (avoids fetching large node.data)
  const workflow = {
    ...workflowBase,
    nodes: nodesToCreate.map((n) => ({
      ...n,
      createdAt: new Date(),
      updatedAt: new Date(),
      credentialId: null,
      assets: [], // Assets created below
    })),
    connections: connectionsToCreate.map((c, idx) => ({
      id: `conn-${idx}`, // Temporary ID for response
      ...c,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  };

  // Create assets AFTER workflow update (to avoid timeout)
  // This is safe because nodes are already created and have IDs
  if (Object.keys(assetsByNodeId).length > 0) {
    const allAssets = [];
    for (const [nodeId, assets] of Object.entries(assetsByNodeId)) {
      for (const asset of assets) {
        allAssets.push({
          nodeId,
          filename: asset.filename,
          fileType: asset.fileType,
          fileData: asset.fileData,
          sceneDescription: asset.sceneDescription || null,
          startTime: asset.startTime ?? null,
          position: asset.position || null,
          size: asset.size || null,
          isBackgroundAudio: asset.isBackgroundAudio,
          volume: asset.volume ?? null,
        });
      }
    }

    if (allAssets.length > 0) {
      // Create assets in batches to avoid overwhelming the database
      // Process in chunks of 10 to balance performance and memory
      const batchSize = 10;
      for (let i = 0; i < allAssets.length; i += batchSize) {
        const batch = allAssets.slice(i, i + batchSize);
        await (prismaClient as any).nodeAsset.createMany({
          data: batch,
        });
      }
    }
  }

  const transformedWorkflow = transformWorkflow(workflow);

  // Schedule/update cron jobs for TIMED_TRIGGER nodes
  // Do this asynchronously after returning the response
  const timedTriggerNodes = workflow.nodes.filter((node: any) => node.type === "TIMED_TRIGGER");

  if (timedTriggerNodes.length > 0) {
    // Schedule asynchronously without blocking the response
    process.nextTick(async () => {
      try {
        const { scheduleTimedTrigger, cancelTimedTrigger } = await import("./cron-scheduler");

        for (const node of timedTriggerNodes) {
          try {
            const nodeData = (node.data as any) || {};
            const isEnabled =
              nodeData.enabled !== false && nodeData.enabled !== "false" && nodeData.enabled !== 0;

            if (isEnabled) {
              await scheduleTimedTrigger(id, userId, node.id, nodeData);
            } else {
              // Cancel cron job if disabled
              cancelTimedTrigger(node.id);
            }
          } catch (error) {
            console.error(`Failed to schedule cron job for timed trigger node ${node.id}:`, error);
            // Continue with other nodes even if one fails
          }
        }
      } catch (error) {
        console.error("Failed to import cron scheduler:", error);
      }
    });
  }

  return transformedWorkflow;
};

/**
 * Delete a workflow
 */
export const deleteWorkflow = async (id: string, userId: string): Promise<void> => {
  if (!id) {
    throw new AppError("Workflow ID is required", 400);
  }

  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  // Verify workflow exists and belongs to user
  const existingWorkflow = await prismaClient.workflow.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!existingWorkflow) {
    throw new AppError("Workflow not found", 404);
  }

  await prismaClient.workflow.delete({
    where: { id },
  });
};
