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

    // For KLING_IMAGE2VIDEO nodes, merge image asset back into node.data
    if (node.type === "KLING_IMAGE2VIDEO" && node.assets && node.assets.length > 0) {
      const imageAsset =
        node.assets.find((a: any) => a.fileType === "kling-image2video-image") || node.assets[0];
      if (imageAsset) {
        nodeData.image = imageAsset.fileData || `asset:${imageAsset.filename}`;
        nodeData.imageFilename = imageAsset.filename;
      }
    }

    // For KLING_MULTI_IMAGE2VIDEO nodes, merge reference images back into node.data
    if (node.type === "KLING_MULTI_IMAGE2VIDEO" && node.assets && node.assets.length > 0) {
      const referenceAssets = node.assets.filter(
        (a: any) => a.fileType === "kling-multi-image2video-image"
      );
      if (referenceAssets.length > 0) {
        nodeData.referenceImages = referenceAssets.map((asset: any) => ({
          file: asset.fileData || `asset:${asset.filename}`,
          filename: asset.filename,
        }));
      }
    }

    // For KLING_IMAGE nodes, merge reference image back into node.data
    if (node.type === "KLING_IMAGE" && node.assets && node.assets.length > 0) {
      const imageAsset =
        node.assets.find((a: any) => a.fileType === "kling-image-reference") || node.assets[0];
      if (imageAsset) {
        nodeData.image = imageAsset.fileData || `asset:${imageAsset.filename}`;
        nodeData.imageFilename = imageAsset.filename;
      }
    }

    // For KLING_MULTI_IMAGE2IMAGE nodes, merge subject/scene/style images back into node.data
    if (node.type === "KLING_MULTI_IMAGE2IMAGE" && node.assets && node.assets.length > 0) {
      const subjectAssets = node.assets.filter(
        (a: any) => a.fileType === "kling-multi-image2image-subject"
      );
      if (subjectAssets.length > 0) {
        nodeData.subjectImages = subjectAssets.map((asset: any) => ({
          file: asset.fileData || `asset:${asset.filename}`,
          filename: asset.filename,
        }));
      }

      const sceneAsset = node.assets.find(
        (a: any) => a.fileType === "kling-multi-image2image-scene"
      );
      if (sceneAsset) {
        nodeData.scene_image = sceneAsset.fileData || `asset:${sceneAsset.filename}`;
        nodeData.sceneImageFilename = sceneAsset.filename;
      }

      const styleAsset = node.assets.find(
        (a: any) => a.fileType === "kling-multi-image2image-style"
      );
      if (styleAsset) {
        nodeData.style_image = styleAsset.fileData || `asset:${styleAsset.filename}`;
        nodeData.styleImageFilename = styleAsset.filename;
      }
    }

    // For KLING_OMNI_IMAGE nodes, merge reference images back into node.data
    if (node.type === "KLING_OMNI_IMAGE" && node.assets && node.assets.length > 0) {
      const referenceAssets = node.assets.filter(
        (a: any) => a.fileType === "kling-omni-image-image"
      );
      if (referenceAssets.length > 0) {
        nodeData.referenceImages = referenceAssets.map((asset: any) => ({
          file: asset.fileData || `asset:${asset.filename}`,
          filename: asset.filename,
        }));
      }
    }

    // For KLING_OMNI_VIDEO nodes, merge reference images back into node.data
    if (node.type === "KLING_OMNI_VIDEO" && node.assets && node.assets.length > 0) {
      const referenceAssets = node.assets.filter((a: any) =>
        [
          "kling-omni-video-image",
          "kling-omni-video-image-first_frame",
          "kling-omni-video-image-end_frame",
        ].includes(a.fileType)
      );
      if (referenceAssets.length > 0) {
        nodeData.referenceImages = referenceAssets.map((asset: any) => ({
          file: asset.fileData || `asset:${asset.filename}`,
          filename: asset.filename,
          type:
            asset.fileType === "kling-omni-video-image-first_frame"
              ? "first_frame"
              : asset.fileType === "kling-omni-video-image-end_frame"
                ? "end_frame"
                : "reference",
        }));
      }
    }

    // For KLING_MOTION_CONTROL nodes, merge image/video assets back into node.data
    if (node.type === "KLING_MOTION_CONTROL" && node.assets && node.assets.length > 0) {
      const imageAsset = node.assets.find((a: any) => a.fileType === "kling-motion-image");
      if (imageAsset) {
        nodeData.image = imageAsset.fileData || `asset:${imageAsset.filename}`;
        nodeData.imageFilename = imageAsset.filename;
      }
      const videoAsset = node.assets.find((a: any) => a.fileType === "kling-motion-video");
      if (videoAsset) {
        nodeData.video_url = videoAsset.fileData || `asset:${videoAsset.filename}`;
        nodeData.videoFilename = videoAsset.filename;
      }
    }

    // For SEEDANCE nodes, merge assets back into node.data
    if (node.type === "SEEDANCE" && node.assets && node.assets.length > 0) {
      // Reference images (for reference mode)
      const referenceAssets = node.assets.filter(
        (a: any) => a.fileType === "seedance-reference-image"
      );
      if (referenceAssets.length > 0) {
        nodeData.referenceImages = referenceAssets.map((asset: any) => ({
          file: asset.fileData || `asset:${asset.filename}`,
          filename: asset.filename,
        }));
      }
      // First frame image (for image mode)
      const firstFrameImageAsset = node.assets.find(
        (a: any) => a.fileType === "seedance-first-frame-image"
      );
      if (firstFrameImageAsset) {
        nodeData.firstFrameImage =
          firstFrameImageAsset.fileData || `asset:${firstFrameImageAsset.filename}`;
        nodeData.firstFrameImageFilename = firstFrameImageAsset.filename;
      }
      // First frame (for frames mode)
      const firstFrameAsset = node.assets.find((a: any) => a.fileType === "seedance-first-frame");
      if (firstFrameAsset) {
        nodeData.firstFrame = firstFrameAsset.fileData || `asset:${firstFrameAsset.filename}`;
        nodeData.firstFrameFilename = firstFrameAsset.filename;
      }
      // Last frame (for frames mode)
      const lastFrameAsset = node.assets.find((a: any) => a.fileType === "seedance-last-frame");
      if (lastFrameAsset) {
        nodeData.lastFrame = lastFrameAsset.fileData || `asset:${lastFrameAsset.filename}`;
        nodeData.lastFrameFilename = lastFrameAsset.filename;
      }
    }

    // For SEEDREAM nodes, merge assets back into node.data
    if (node.type === "SEEDREAM" && node.assets && node.assets.length > 0) {
      // Source image (for image mode)
      const sourceImageAsset = node.assets.find((a: any) => a.fileType === "seedream-source-image");
      if (sourceImageAsset) {
        nodeData.sourceImage = sourceImageAsset.fileData || `asset:${sourceImageAsset.filename}`;
        nodeData.sourceImageFilename = sourceImageAsset.filename;
      }

      // Reference images (for multi mode)
      const referenceAssets = node.assets.filter(
        (a: any) => a.fileType === "seedream-reference-image"
      );
      if (referenceAssets.length > 0) {
        nodeData.referenceImages = referenceAssets.map((asset: any) => ({
          file: asset.fileData || `asset:${asset.filename}`,
          filename: asset.filename,
        }));
      }
    }

    // Only update data if we modified it
    if (
      node.type === "REMOTION" ||
      node.type === "DESIGN_PRO" ||
      node.type === "VEO" ||
      node.type === "KLING_IMAGE2VIDEO" ||
      node.type === "KLING_MULTI_IMAGE2VIDEO" ||
      node.type === "KLING_IMAGE" ||
      node.type === "KLING_MULTI_IMAGE2IMAGE" ||
      node.type === "KLING_OMNI_IMAGE" ||
      node.type === "KLING_OMNI_VIDEO" ||
      node.type === "KLING_MOTION_CONTROL" ||
      node.type === "SEEDANCE" ||
      node.type === "SEEDREAM"
    ) {
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

  // Load assets WITH fileData for nodes that need them (VEO, DESIGN_PRO, REMOTION, KLING_*)
  // Load EACH ASSET ONE AT A TIME to avoid 5MB limit per query
  const assetsByNodeId = new Map<string, any[]>();

  for (const node of workflow.nodes) {
    const nodeType = node.type as string;
    const needsAssets = [
      "VEO",
      "DESIGN_PRO",
      "REMOTION",
      "KLING_IMAGE2VIDEO",
      "KLING_MULTI_IMAGE2VIDEO",
      "KLING_IMAGE",
      "KLING_MULTI_IMAGE2IMAGE",
      "KLING_OMNI_IMAGE",
      "KLING_OMNI_VIDEO",
      "KLING_MOTION_CONTROL",
      "SEEDANCE",
      "SEEDREAM",
    ].includes(nodeType);

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

  // Load assets WITH fileData for nodes that need them (VEO, DESIGN_PRO, REMOTION, KLING_*)
  // Load EACH ASSET ONE AT A TIME to avoid 5MB limit per query
  const assetsByNodeId = new Map<string, any[]>();

  for (const node of workflow.nodes) {
    const nodeType = node.type as string;
    const needsAssets = [
      "VEO",
      "DESIGN_PRO",
      "REMOTION",
      "KLING_IMAGE2VIDEO",
      "KLING_MULTI_IMAGE2VIDEO",
      "KLING_IMAGE",
      "KLING_MULTI_IMAGE2IMAGE",
      "KLING_OMNI_IMAGE",
      "KLING_OMNI_VIDEO",
      "KLING_MOTION_CONTROL",
      "SEEDANCE",
      "SEEDREAM",
    ].includes(nodeType);

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
    include: {
      nodes: {
        where: {
          type: NodeType.COMPOSIO_TRIGGER,
        },
        select: {
          id: true,
          data: true,
        },
      },
    },
  });

  if (!existingWorkflow) {
    throw new AppError("Workflow not found", 404);
  }

  const previousComposioTriggerIds = (existingWorkflow.nodes || [])
    .map((node: any) => (node.data as any)?.composioTriggerId)
    .filter((id: string | undefined): id is string => Boolean(id));

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

      // Extract KLING_IMAGE2VIDEO assets (image)
      if (node.type === "KLING_IMAGE2VIDEO" && nodeData) {
        if (nodeData.image && typeof nodeData.image === "string") {
          if (nodeData.image.startsWith("data:")) {
            assetsToStore.push({
              filename: nodeData.imageFilename || "kling-image2video.png",
              fileType: "kling-image2video-image",
              fileData: nodeData.image,
              isBackgroundAudio: false,
            });
          }
          // Remove image fields once stored (or if it's an asset placeholder)
          delete nodeData.image;
          delete nodeData.imageFilename;
        }
      }

      // Extract KLING_MULTI_IMAGE2VIDEO assets (reference images)
      if (node.type === "KLING_MULTI_IMAGE2VIDEO" && nodeData) {
        if (Array.isArray(nodeData.referenceImages) && nodeData.referenceImages.length > 0) {
          const validRefs = nodeData.referenceImages.filter(
            (r: any) => r.file && r.file.startsWith("data:")
          );
          validRefs.forEach((r: any, idx: number) => {
            assetsToStore.push({
              filename: r.filename || `kling-multi-image2video-${idx + 1}.png`,
              fileType: "kling-multi-image2video-image",
              fileData: r.file,
              isBackgroundAudio: false,
            });
          });
          delete nodeData.referenceImages;
        }
      }

      // Extract KLING_IMAGE assets (reference image)
      if (node.type === "KLING_IMAGE" && nodeData) {
        if (nodeData.image && typeof nodeData.image === "string") {
          if (nodeData.image.startsWith("data:")) {
            assetsToStore.push({
              filename: nodeData.imageFilename || "kling-image-reference.png",
              fileType: "kling-image-reference",
              fileData: nodeData.image,
              isBackgroundAudio: false,
            });
          }
          delete nodeData.image;
          delete nodeData.imageFilename;
        }
      }

      // Extract KLING_MULTI_IMAGE2IMAGE assets (subject/scene/style images)
      if (node.type === "KLING_MULTI_IMAGE2IMAGE" && nodeData) {
        if (Array.isArray(nodeData.subjectImages) && nodeData.subjectImages.length > 0) {
          const validSubjects = nodeData.subjectImages.filter(
            (r: any) => r.file && r.file.startsWith("data:")
          );
          validSubjects.forEach((r: any, idx: number) => {
            assetsToStore.push({
              filename: r.filename || `kling-multi-image2image-subject-${idx + 1}.png`,
              fileType: "kling-multi-image2image-subject",
              fileData: r.file,
              isBackgroundAudio: false,
            });
          });
          delete nodeData.subjectImages;
        }

        if (nodeData.scene_image && typeof nodeData.scene_image === "string") {
          if (nodeData.scene_image.startsWith("data:")) {
            assetsToStore.push({
              filename: nodeData.sceneImageFilename || "kling-multi-image2image-scene.png",
              fileType: "kling-multi-image2image-scene",
              fileData: nodeData.scene_image,
              isBackgroundAudio: false,
            });
          }
          delete nodeData.scene_image;
          delete nodeData.sceneImageFilename;
        }

        if (nodeData.style_image && typeof nodeData.style_image === "string") {
          if (nodeData.style_image.startsWith("data:")) {
            assetsToStore.push({
              filename: nodeData.styleImageFilename || "kling-multi-image2image-style.png",
              fileType: "kling-multi-image2image-style",
              fileData: nodeData.style_image,
              isBackgroundAudio: false,
            });
          }
          delete nodeData.style_image;
          delete nodeData.styleImageFilename;
        }
      }

      // Extract KLING_OMNI_IMAGE assets (reference images)
      if (node.type === "KLING_OMNI_IMAGE" && nodeData) {
        if (Array.isArray(nodeData.referenceImages) && nodeData.referenceImages.length > 0) {
          const validRefs = nodeData.referenceImages.filter(
            (r: any) => r.file && r.file.startsWith("data:")
          );
          validRefs.forEach((r: any, idx: number) => {
            assetsToStore.push({
              filename: r.filename || `kling-omni-image-${idx + 1}.png`,
              fileType: "kling-omni-image-image",
              fileData: r.file,
              isBackgroundAudio: false,
            });
          });
          delete nodeData.referenceImages;
        }
      }

      // Extract KLING_OMNI_VIDEO assets (reference images)
      if (node.type === "KLING_OMNI_VIDEO" && nodeData) {
        if (Array.isArray(nodeData.referenceImages) && nodeData.referenceImages.length > 0) {
          const validRefs = nodeData.referenceImages.filter(
            (r: any) => r.file && r.file.startsWith("data:")
          );
          validRefs.forEach((r: any, idx: number) => {
            const type = r.type === "first_frame" || r.type === "end_frame" ? r.type : "reference";
            const fileType =
              type === "first_frame"
                ? "kling-omni-video-image-first_frame"
                : type === "end_frame"
                  ? "kling-omni-video-image-end_frame"
                  : "kling-omni-video-image";
            assetsToStore.push({
              filename: r.filename || `kling-omni-video-${type}-${idx + 1}.png`,
              fileType,
              fileData: r.file,
              isBackgroundAudio: false,
            });
          });
          delete nodeData.referenceImages;
        }
      }

      // Extract KLING_MOTION_CONTROL assets (image/video)
      if (node.type === "KLING_MOTION_CONTROL" && nodeData) {
        if (nodeData.image && typeof nodeData.image === "string") {
          if (nodeData.image.startsWith("data:")) {
            assetsToStore.push({
              filename: nodeData.imageFilename || "kling-motion-image.png",
              fileType: "kling-motion-image",
              fileData: nodeData.image,
              isBackgroundAudio: false,
            });
          }
          delete nodeData.image;
          delete nodeData.imageFilename;
        }
        if (nodeData.video_url && typeof nodeData.video_url === "string") {
          if (nodeData.video_url.startsWith("data:")) {
            assetsToStore.push({
              filename: nodeData.videoFilename || "kling-motion-video.mp4",
              fileType: "kling-motion-video",
              fileData: nodeData.video_url,
              isBackgroundAudio: false,
            });
          }
          delete nodeData.video_url;
          delete nodeData.videoFilename;
        }
      }

      // Extract SEEDANCE assets (referenceImages, firstFrameImage, firstFrame, lastFrame)
      if (node.type === "SEEDANCE" && nodeData) {
        // Reference images (for reference mode)
        if (Array.isArray(nodeData.referenceImages) && nodeData.referenceImages.length > 0) {
          const validRefs = nodeData.referenceImages.filter(
            (r: any) => r.file && r.file.startsWith("data:")
          );
          validRefs.forEach((r: any, idx: number) => {
            assetsToStore.push({
              filename: r.filename || `seedance-reference-${idx + 1}.png`,
              fileType: "seedance-reference-image",
              fileData: r.file,
              isBackgroundAudio: false,
            });
          });
          delete nodeData.referenceImages;
        }
        // First frame image (for image mode)
        if (nodeData.firstFrameImage && typeof nodeData.firstFrameImage === "string") {
          if (nodeData.firstFrameImage.startsWith("data:")) {
            assetsToStore.push({
              filename: nodeData.firstFrameImageFilename || "seedance-first-frame.png",
              fileType: "seedance-first-frame-image",
              fileData: nodeData.firstFrameImage,
              isBackgroundAudio: false,
            });
          }
          delete nodeData.firstFrameImage;
          delete nodeData.firstFrameImageFilename;
        }
        // First frame (for frames mode)
        if (nodeData.firstFrame && typeof nodeData.firstFrame === "string") {
          if (nodeData.firstFrame.startsWith("data:")) {
            assetsToStore.push({
              filename: nodeData.firstFrameFilename || "seedance-first-frame.png",
              fileType: "seedance-first-frame",
              fileData: nodeData.firstFrame,
              isBackgroundAudio: false,
            });
          }
          delete nodeData.firstFrame;
          delete nodeData.firstFrameFilename;
        }
        // Last frame (for frames mode)
        if (nodeData.lastFrame && typeof nodeData.lastFrame === "string") {
          if (nodeData.lastFrame.startsWith("data:")) {
            assetsToStore.push({
              filename: nodeData.lastFrameFilename || "seedance-last-frame.png",
              fileType: "seedance-last-frame",
              fileData: nodeData.lastFrame,
              isBackgroundAudio: false,
            });
          }
          delete nodeData.lastFrame;
          delete nodeData.lastFrameFilename;
        }
      }

      // Extract SEEDREAM assets (sourceImage, referenceImages)
      if (node.type === "SEEDREAM" && nodeData) {
        // Source image (for image mode)
        if (nodeData.sourceImage && typeof nodeData.sourceImage === "string") {
          if (nodeData.sourceImage.startsWith("data:")) {
            assetsToStore.push({
              filename: nodeData.sourceImageFilename || "seedream-source-image.png",
              fileType: "seedream-source-image",
              fileData: nodeData.sourceImage,
              isBackgroundAudio: false,
            });
          }
          delete nodeData.sourceImage;
          delete nodeData.sourceImageFilename;
        }

        // Reference images (for multi mode)
        if (Array.isArray(nodeData.referenceImages) && nodeData.referenceImages.length > 0) {
          const validRefs = nodeData.referenceImages.filter(
            (r: any) => r.file && r.file.startsWith("data:")
          );
          validRefs.forEach((r: any, idx: number) => {
            assetsToStore.push({
              filename: r.filename || `seedream-reference-${idx + 1}.png`,
              fileType: "seedream-reference-image",
              fileData: r.file,
              isBackgroundAudio: false,
            });
          });
          delete nodeData.referenceImages;
        }
      }

      if (assetsToStore.length > 0) {
        assetsByNodeId[node.id.trim()] = assetsToStore;
      }

      const credentialId =
        (node as { credentialId?: string }).credentialId ??
        (node.data && (node.data as any).credentialId) ??
        null;
      return {
        id: node.id.trim(),
        workflowId: id,
        name: (node.name || node.id).trim(),
        type: node.type as any,
        position: node.position || { x: 0, y: 0 },
        data: nodeData,
        credentialId: credentialId || undefined,
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

  // Create assets AFTER workflow update (to avoid timeout)
  // This is safe because nodes are already created and have IDs
  // We need to create assets BEFORE building the response so we can include them
  const createdAssetsByNodeId = new Map<string, any[]>();

  if (Object.keys(assetsByNodeId).length > 0) {
    const allAssets = [];
    for (const [nodeId, assets] of Object.entries(assetsByNodeId)) {
      for (const asset of assets) {
        const assetData = {
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
        };
        allAssets.push(assetData);

        // Track assets by nodeId for response
        if (!createdAssetsByNodeId.has(nodeId)) {
          createdAssetsByNodeId.set(nodeId, []);
        }
        createdAssetsByNodeId.get(nodeId)!.push(assetData);
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

  // Build workflow response with assets attached to nodes
  const workflow = {
    ...workflowBase,
    nodes: nodesToCreate.map((n) => ({
      ...n,
      createdAt: new Date(),
      updatedAt: new Date(),
      credentialId: null,
      assets: createdAssetsByNodeId.get(n.id) || [],
    })),
    connections: connectionsToCreate.map((c, idx) => ({
      id: `conn-${idx}`, // Temporary ID for response
      ...c,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  };

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

  // Provision/reconcile Composio triggers for COMPOSIO_TRIGGER nodes
  // Async to avoid blocking save response path.
  const composioTriggerNodes = workflow.nodes.filter(
    (node: any) => node.type === NodeType.COMPOSIO_TRIGGER
  );
  if (composioTriggerNodes.length > 0 || previousComposioTriggerIds.length > 0) {
    process.nextTick(async () => {
      try {
        const { reconcileWorkflowComposioTriggers } =
          await import("./composio/composioTriggerService");
        await reconcileWorkflowComposioTriggers({
          workflowId: id,
          userId,
          nodes: composioTriggerNodes.map((node: any) => ({
            id: node.id,
            type: node.type,
            data: node.data || {},
          })),
          staleTriggerIds: previousComposioTriggerIds,
        });
      } catch (error) {
        console.error(`[Composio Trigger] Failed to reconcile workflow ${id}:`, error);
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
    include: {
      nodes: {
        where: {
          type: NodeType.COMPOSIO_TRIGGER,
        },
        select: {
          id: true,
          data: true,
        },
      },
    },
  });

  if (!existingWorkflow) {
    throw new AppError("Workflow not found", 404);
  }

  const composioTriggerIds = (existingWorkflow.nodes || [])
    .map((node: any) => (node.data as any)?.composioTriggerId)
    .filter((triggerId: string | undefined): triggerId is string => Boolean(triggerId));

  await prismaClient.workflow.delete({
    where: { id },
  });

  if (composioTriggerIds.length > 0) {
    process.nextTick(async () => {
      try {
        const { cleanupWorkflowComposioTriggers } =
          await import("./composio/composioTriggerService");
        await cleanupWorkflowComposioTriggers(composioTriggerIds);
      } catch (error) {
        console.error(`[Composio Trigger] Failed to cleanup workflow ${id}:`, error);
      }
    });
  }
};
