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

    // Only update data if we modified it
    if (node.type === "REMOTION" || node.type === "DESIGN_PRO") {
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

  const workflow = await prismaClient.workflow.create({
    data: {
      name: data.name.trim(),
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

  // Get workflows with nodes (exclude assets to avoid large response size)
  // Assets are only needed when viewing/editing a single workflow, not in the list
  const workflows = await prismaClient.workflow.findMany({
    where,
    skip,
    take,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      nodes: {
        // Don't include assets - they contain large base64 data and cause Prisma response limit errors
        // Assets will be loaded separately when viewing/editing individual workflows
      },
      connections: true,
    },
  });

  const totalPages = Math.ceil(total / limit);

  // Transform workflows without merging assets (assets not loaded for list view)
  // Use a simplified transform that doesn't expect assets
  return {
    workflows: workflows.map((workflow: any) => ({
      id: workflow.id,
      name: workflow.name,
      userId: workflow.userId,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      nodes: workflow.nodes || [],
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

  const workflow = await prismaClient.workflow.findFirst({
    where: {
      id,
      userId,
    },
    include: {
      nodes: {},
      connections: true,
    },
  });

  if (!workflow) {
    throw new AppError("Workflow not found", 404);
  }

  // Return workflow WITHOUT assets
  // Executors will load assets separately from database inside their step.run() calls
  return transformWorkflowForExecution(workflow);
};

export const getWorkflow = async (id: string, userId: string): Promise<WorkflowResponse> => {
  if (!id) {
    throw new AppError("Workflow ID is required", 400);
  }

  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  // Load workflow without assets - frontend doesn't need base64 data, only metadata
  // Assets are only loaded during execution via getWorkflowForExecution
  const workflow = await prismaClient.workflow.findFirst({
    where: {
      id,
      userId, // Ensure user owns the workflow
    },
    include: {
      nodes: {
        // Don't include assets - frontend doesn't need base64 data
        // Assets are loaded separately during execution only
      },
      connections: true,
    },
  });

  if (!workflow) {
    throw new AppError("Workflow not found", 404);
  }

  // Load only asset metadata (filename, type) for display, not the actual fileData
  // This allows frontend to show what assets exist without loading large base64 data
  const nodesNeedingAssets = (workflow.nodes || []).filter(
    (node: any) => node.type === "REMOTION" || node.type === "DESIGN_PRO"
  );
  const nodeIds = nodesNeedingAssets.map((node: any) => node.id);

  // Load only metadata fields, not fileData
  const assetMetadata =
    nodeIds.length > 0
      ? await prismaClient.nodeAsset.findMany({
          where: {
            nodeId: { in: nodeIds },
          },
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
            // Explicitly exclude fileData to avoid loading large base64
          },
        })
      : [];

  // Group metadata by nodeId
  const assetsByNodeId = new Map<string, any[]>();
  for (const asset of assetMetadata) {
    if (!assetsByNodeId.has(asset.nodeId)) {
      assetsByNodeId.set(asset.nodeId, []);
    }
    assetsByNodeId.get(asset.nodeId)!.push(asset);
  }

  // Attach asset metadata to nodes (without fileData)
  const workflowWithAssetMetadata = {
    ...workflow,
    nodes: (workflow.nodes || []).map((node: any) => {
      return {
        ...node,
        assets: assetsByNodeId.get(node.id) || [],
      };
    }),
  };

  // Transform workflow - this will create placeholders for assets in node.data
  // The frontend dialog can work with just filenames/metadata
  return transformWorkflow(workflowWithAssetMetadata);
};

/**
 * Get a single workflow by ID (without user validation - for public endpoints like webhooks)
 */
export const getWorkflowById = async (id: string): Promise<WorkflowResponse> => {
  if (!id) {
    throw new AppError("Workflow ID is required", 400);
  }

  // Load workflow without assets - frontend doesn't need base64 data, only metadata
  // Assets are only loaded during execution via getWorkflowForExecution
  const workflow = await prismaClient.workflow.findFirst({
    where: {
      id,
    },
    include: {
      nodes: {
        // Don't include assets - frontend doesn't need base64 data
        // Assets are loaded separately during execution only
      },
      connections: true,
    },
  });

  if (!workflow) {
    throw new AppError("Workflow not found", 404);
  }

  // Load only asset metadata (filename, type) for display, not the actual fileData
  // This allows frontend to show what assets exist without loading large base64 data
  const nodesNeedingAssets = (workflow.nodes || []).filter(
    (node: any) => node.type === "REMOTION" || node.type === "DESIGN_PRO"
  );
  const nodeIds = nodesNeedingAssets.map((node: any) => node.id);

  // Load only metadata fields, not fileData
  const assetMetadata =
    nodeIds.length > 0
      ? await prismaClient.nodeAsset.findMany({
          where: {
            nodeId: { in: nodeIds },
          },
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
            // Explicitly exclude fileData to avoid loading large base64
          },
        })
      : [];

  // Group metadata by nodeId
  const assetsByNodeId = new Map<string, any[]>();
  for (const asset of assetMetadata) {
    if (!assetsByNodeId.has(asset.nodeId)) {
      assetsByNodeId.set(asset.nodeId, []);
    }
    assetsByNodeId.get(asset.nodeId)!.push(asset);
  }

  // Attach asset metadata to nodes (without fileData)
  const workflowWithAssetMetadata = {
    ...workflow,
    nodes: (workflow.nodes || []).map((node: any) => ({
      ...node,
      assets: assetsByNodeId.get(node.id) || [],
    })),
  };

  // Transform workflow - this will create placeholders for assets in node.data
  // The frontend dialog can work with just filenames/metadata
  return transformWorkflow(workflowWithAssetMetadata);
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

  const workflow = await prismaClient.workflow.update({
    where: { id },
    data: {
      name: data.name.trim(),
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
    where: {
      id,
      userId,
    },
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

  // Extract assets from Remotion nodes before transaction (to avoid transaction timeout)
  // Store them separately and merge back after transaction
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

  // Use transaction to ensure atomicity
  // Set timeout to 15 seconds (Accelerate's hard limit - cannot be exceeded)
  // For workflows with large data (e.g., Remotion nodes with base64 assets), we optimize by:
  // - Removing redundant verification queries
  // - Using efficient batch operations
  // - Minimizing data serialization overhead
  // - Storing assets separately outside node.data
  const workflow = await (prismaClient as any).$transaction(
    async (tx: any) => {
      // Delete all existing connections, node assets, and nodes in parallel to optimize transaction speed
      // This reduces transaction time, which is critical for workflows with large data (e.g., Remotion nodes with base64 assets)
      // Note: Node assets are deleted via cascade when nodes are deleted, but we delete explicitly for clarity
      // Get node IDs before deletion (for deleting associated assets)
      const nodeIdsToDelete = await tx.node.findMany({
        where: { workflowId: id },
        select: { id: true },
      });
      const nodeIdArray = nodeIdsToDelete.map((n: { id: string }) => n.id);

      await Promise.all([
        tx.connection.deleteMany({
          where: { workflowId: id },
        }),
        nodeIdArray.length > 0
          ? (tx as any).nodeAsset.deleteMany({
              where: { nodeId: { in: nodeIdArray } },
            })
          : Promise.resolve(),
        tx.node.deleteMany({
          where: { workflowId: id },
        }),
      ]);

      // Prepare update data
      const updateData: any = {};

      if (data.name && data.name.trim() !== "") {
        updateData.name = data.name.trim();
      }

      // Update workflow name first (if provided)
      await tx.workflow.update({
        where: { id },
        data: updateData,
      });

      // Create copies of nodes and connections that we can modify if IDs need to be remapped
      const nodesToProcess = [...data.nodes];
      const connectionsToProcess = [...data.connections];

      // Build nodeIds from nodesToProcess BEFORE creating nodes
      // This represents what we EXPECT to create - the current state of the canvas
      let nodeIds = new Set(nodesToProcess.map((node) => node.id?.trim()).filter(Boolean));

      // Create nodes separately using createMany to preserve client-provided IDs
      if (nodesToProcess.length > 0) {
        // Check for duplicate IDs in the nodes array
        const duplicateIds: string[] = [];
        const seenIds = new Set<string>();

        for (const node of nodesToProcess) {
          const nodeId = node.id?.trim();
          if (!nodeId) {
            throw new AppError(
              `Node is missing required ID. All nodes must have a unique, non-empty ID.`,
              400
            );
          }
          if (seenIds.has(nodeId)) {
            duplicateIds.push(nodeId);
          } else {
            seenIds.add(nodeId);
          }
        }

        if (duplicateIds.length > 0) {
          throw new AppError(
            `Duplicate node IDs found in request: ${duplicateIds.join(", ")}. Each node must have a unique ID.`,
            400
          );
        }

        // Check if any of the node IDs we're trying to create already exist in the database
        // Node IDs are globally unique, so we need to check across all workflows
        const nodeIdsToCreate = nodesToProcess.map((n) => n.id?.trim()).filter(Boolean);
        const existingNodes = await tx.node.findMany({
          where: {
            id: { in: nodeIdsToCreate },
          },
          select: { id: true, workflowId: true },
        });

        // Track ID remappings for nodes that exist in other workflows
        const idMap = new Map<string, string>();

        if (existingNodes.length > 0) {
          // Filter to only check nodes in other workflows (we just deleted nodes in this workflow)
          const conflictingInOtherWorkflows = existingNodes.filter((n: any) => n.workflowId !== id);

          if (conflictingInOtherWorkflows.length > 0) {
            // Node IDs exist in other workflows - we need to generate new IDs
            console.warn(
              `[WorkflowService] Node IDs already exist in other workflows, generating new IDs:`,
              conflictingInOtherWorkflows.map((n: any) => n.id)
            );

            // Generate new unique IDs for conflicting nodes
            for (const existingNode of conflictingInOtherWorkflows) {
              // Generate a new unique ID by appending a random suffix
              const newId = `${existingNode.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
              idMap.set(existingNode.id, newId);
            }

            // Update node IDs in the nodes array
            for (let i = 0; i < nodesToProcess.length; i++) {
              const oldId = nodesToProcess[i].id?.trim();
              if (oldId && idMap.has(oldId)) {
                nodesToProcess[i].id = idMap.get(oldId)!;
                // Update nodeIds set
                nodeIds.delete(oldId);
                nodeIds.add(nodesToProcess[i].id);
              }
            }

            // Update connections that reference the remapped node IDs
            for (const conn of connectionsToProcess) {
              const oldSource = conn.source?.trim();
              const oldTarget = conn.target?.trim();
              if (oldSource && idMap.has(oldSource)) {
                conn.source = idMap.get(oldSource)!;
              }
              if (oldTarget && idMap.has(oldTarget)) {
                conn.target = idMap.get(oldTarget)!;
              }
            }
          }
        }

        // Use nodesToProcess (which may have been remapped) instead of data.nodes
        const nodesToCreate = nodesToProcess
          .map((node) => {
            // Validate node type exists in our NodeType constants
            if (node.type && !Object.values(NodeType).includes(node.type as any)) {
              throw new AppError(
                `Invalid node type: ${node.type}. Valid types are: ${Object.values(NodeType).join(", ")}`,
                400
              );
            }

            // Validate required fields
            if (!node.id || node.id.trim() === "") {
              throw new AppError(
                `Node is missing required ID. All nodes must have a unique ID.`,
                400
              );
            }

            if (!node.name || node.name.trim() === "") {
              throw new AppError(`Node ${node.id} is missing required name.`, 400);
            }

            if (!node.type) {
              throw new AppError(`Node ${node.id} is missing required type.`, 400);
            }

            // Extract assets/images from node data to store separately (prevents transaction timeout)
            const nodeData = node.data || {};
            let assetsToStore: Array<{
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

            // Check if this is a Remotion node with assets
            if (node.type === "REMOTION" && nodeData) {
              // Extract background audio if present
              if (nodeData.backgroundAudio && nodeData.backgroundAudioFilename) {
                assetsToStore.push({
                  filename: nodeData.backgroundAudioFilename,
                  fileType: "audio",
                  fileData: nodeData.backgroundAudio,
                  isBackgroundAudio: true,
                  volume: nodeData.backgroundAudioVolume ?? 0.7,
                });
                // Remove from node.data to keep it small
                delete nodeData.backgroundAudio;
                delete nodeData.backgroundAudioFilename;
                delete nodeData.backgroundAudioVolume;
              }

              // Extract regular assets if present
              if (Array.isArray(nodeData.assets) && nodeData.assets.length > 0) {
                assetsToStore.push(
                  ...nodeData.assets.map((asset: any) => ({
                    filename: asset.filename,
                    fileType: asset.type || "image",
                    fileData: asset.file,
                    sceneDescription: asset.sceneDescription,
                    startTime: asset.startTime,
                    position: asset.position,
                    size: asset.size,
                    isBackgroundAudio: false,
                  }))
                );
                // Remove from node.data to keep it small
                delete nodeData.assets;
              }
            }

            // Check if this is a DESIGN_PRO node with images
            if (node.type === "DESIGN_PRO" && nodeData) {
              // Determine node mode to handle sourceImage extraction differently
              const nodeMode = (nodeData.mode as string) || "generate";
              const isEditWithReferences = nodeMode === "editWithReferences";

              // Extract source image if present (skip placeholders like "asset:filename")
              // For editWithReferences, sourceImage is optional - don't extract it as an asset
              // (it can be provided as URL in node.data for optional baseImage, or omitted entirely)
              // For other modes (edit, chat), extract it as the first asset
              if (
                !isEditWithReferences &&
                nodeData.sourceImage &&
                !nodeData.sourceImage.startsWith("asset:")
              ) {
                // Use provided filename or generate a default one
                const filename = nodeData.sourceImageFilename || "source-image.png";
                assetsToStore.push({
                  filename: filename,
                  fileType: "image",
                  fileData: nodeData.sourceImage,
                  isBackgroundAudio: false,
                });
                // Remove from node.data to keep it small
                delete nodeData.sourceImage;
                delete nodeData.sourceImageMimeType;
                delete nodeData.sourceImageFilename;
              } else if (nodeData.sourceImage?.startsWith("asset:")) {
                // Placeholder - asset already exists in database, just remove from node.data
                delete nodeData.sourceImage;
                delete nodeData.sourceImageMimeType;
                delete nodeData.sourceImageFilename;
              }
              // For editWithReferences, if sourceImage is provided (URL or base64), keep it in node.data
              // It will be used as optional baseImage when loading

              // Extract reference images if present (skip placeholders)
              if (Array.isArray(nodeData.referenceImages) && nodeData.referenceImages.length > 0) {
                const validRefImages = nodeData.referenceImages.filter(
                  (refImg: any) => refImg.image && !refImg.image.startsWith("asset:")
                );
                if (validRefImages.length > 0) {
                  assetsToStore.push(
                    ...validRefImages.map((refImg: any) => ({
                      filename: refImg.filename || "reference-image.png",
                      fileType: "image",
                      fileData: refImg.image,
                      isBackgroundAudio: false,
                    }))
                  );
                }
                // Remove from node.data to keep it small (even if they were placeholders)
                delete nodeData.referenceImages;
              }
            }

            // Store assets separately (not in the node object - Prisma doesn't recognize _assets)
            if (assetsToStore.length > 0) {
              assetsByNodeId[node.id.trim()] = assetsToStore;
            }

            // Preserve the node ID from client so connections can reference it
            // Note: Do NOT include _assets in the return object - it's stored separately in assetsByNodeId
            return {
              id: node.id.trim(), // Use client-provided ID, trim whitespace
              workflowId: id,
              name: (node.name || node.id).trim(),
              type: node.type as any, // Prisma will validate against the enum
              position: node.position || { x: 0, y: 0 },
              data: nodeData, // Store data without large assets
            };
          })
          .filter((node) => {
            // Filter out any nodes that failed validation (shouldn't happen, but safety check)
            return node.id && node.type;
          });

        // nodesToCreate already doesn't have _assets field (we never added it to the return object)
        // Assets are stored in assetsByNodeId (declared outside transaction)
        const nodesToCreateWithoutAssets = nodesToCreate;

        // Use createMany to create nodes with their IDs (without large asset data)
        // We delete all nodes first, so there should be no duplicates
        // Remove skipDuplicates to ensure we catch any issues instead of silently failing
        const createResult = await tx.node.createMany({
          data: nodesToCreateWithoutAssets,
        });

        // Note: Assets are NOT created here to avoid transaction timeout
        // They will be created AFTER the transaction completes (see below)

        // Log for debugging - this is critical to understand what's happening
        if (createResult.count !== nodesToCreateWithoutAssets.length) {
          console.error(
            `[WorkflowService] CRITICAL: Created ${createResult.count} nodes but expected ${nodesToCreate.length} for workflow ${id}`
          );
          console.error(
            `[WorkflowService] This likely means some nodes were skipped due to duplicate IDs or validation errors`
          );

          // Throw error instead of silently failing
          // Note: Removed verification query to optimize transaction speed
          throw new AppError(
            `Failed to create all nodes. Expected ${nodesToCreateWithoutAssets.length} but only created ${createResult.count}.`,
            500
          );
        }
      }

      // Create connections (transform source/target to fromNodeId/toNodeId)
      if (data.connections.length > 0) {
        // Filter out connections that reference nodes not in the current canvas state
        // This makes the system resilient to stale connections from the frontend
        const validConnections = connectionsToProcess.filter((conn: any) => {
          const sourceExists = nodeIds.has(conn.source);
          const targetExists = nodeIds.has(conn.target);
          return sourceExists && targetExists;
        });

        // Log if any connections were filtered out (for debugging)
        const filteredCount = data.connections.length - validConnections.length;
        if (filteredCount > 0) {
          const invalidConnections = data.connections.filter((conn) => {
            const sourceExists = nodeIds.has(conn.source);
            const targetExists = nodeIds.has(conn.target);
            return !sourceExists || !targetExists;
          });
          console.warn(
            `[WorkflowService] Filtered out ${filteredCount} invalid connection(s) that reference nodes not in current canvas state:`,
            invalidConnections.map((c) => ({
              source: c.source,
              target: c.target,
              sourceExists: nodeIds.has(c.source),
              targetExists: nodeIds.has(c.target),
            })),
            `Available node IDs from canvas: ${Array.from(nodeIds).join(", ")}`
          );
        }

        // Check for duplicate connections in the validConnections array
        // A connection is unique by: fromNodeId, toNodeId, fromOutput, toInput
        const connectionKey = (conn: any) =>
          `${conn.source}:${conn.target}:${conn.sourceHandle || "main"}:${conn.targetHandle || "main"}`;

        const seenConnections = new Set<string>();
        const duplicateConnections: string[] = [];
        const uniqueConnections = validConnections.filter((conn: any) => {
          const key = connectionKey(conn);
          if (seenConnections.has(key)) {
            duplicateConnections.push(key);
            return false;
          }
          seenConnections.add(key);
          return true;
        });

        if (duplicateConnections.length > 0) {
          console.warn(
            `[WorkflowService] Filtered out ${duplicateConnections.length} duplicate connection(s):`,
            duplicateConnections
          );
        }

        // Create connections with transformed field names (only unique ones)
        if (uniqueConnections.length > 0) {
          const connectionsToCreate = uniqueConnections.map((conn: any) => ({
            workflowId: id,
            fromNodeId: conn.source,
            toNodeId: conn.target,
            fromOutput: conn.sourceHandle || "main",
            toInput: conn.targetHandle || "main",
          }));

          // We delete all connections first, so there should be no duplicates
          // Remove skipDuplicates to ensure we catch any issues instead of silently failing
          const createConnectionsResult = await tx.connection.createMany({
            data: connectionsToCreate,
          });

          // Log for debugging - this is critical to understand what's happening
          if (createConnectionsResult.count !== uniqueConnections.length) {
            console.error(
              `[WorkflowService] CRITICAL: Created ${createConnectionsResult.count} connections but expected ${uniqueConnections.length} for workflow ${id}`
            );
            console.error(
              `[WorkflowService] This likely means some connections were skipped due to duplicates or validation errors`
            );

            // Throw error instead of silently failing
            // Note: Removed verification query to optimize transaction speed
            throw new AppError(
              `Failed to create all connections. Expected ${uniqueConnections.length} but only created ${createConnectionsResult.count}.`,
              500
            );
          }
        }
      }

      // Fetch the complete workflow with all relations
      return await tx.workflow.findUnique({
        where: { id },
        include: {
          nodes: true,
          connections: true,
        },
      });
    },
    {
      timeout: 15000, // 15 seconds timeout (Accelerate's hard limit - cannot be exceeded)
      maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
    }
  );

  // Create assets AFTER transaction completes (to avoid timeout)
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
