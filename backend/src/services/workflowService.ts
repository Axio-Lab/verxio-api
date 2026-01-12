import { basePrismaClient } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { NodeType } from "../lib/node-types";

// Use basePrismaClient for workflow model since extended client doesn't expose it
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
    id: string; // Node ID is required to maintain connection references
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

// Helper function to transform workflow with connections
function transformWorkflow(workflow: any): WorkflowResponse {
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

  // Get workflows with nodes
  const workflows = await prismaClient.workflow.findMany({
    where,
    skip,
    take,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      nodes: true,
      connections: true,
    },
  });

  const totalPages = Math.ceil(total / limit);

  return {
    workflows: workflows.map(transformWorkflow),
    total,
    page,
    limit,
    totalPages: totalPages || 1,
  };
};

/**
 * Get a single workflow by ID (with user validation)
 */
export const getWorkflow = async (id: string, userId: string): Promise<WorkflowResponse> => {
  if (!id) {
    throw new AppError("Workflow ID is required", 400);
  }

  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  const workflow = await prismaClient.workflow.findFirst({
    where: {
      id,
      userId, // Ensure user owns the workflow
    },
    include: {
      nodes: true,
      connections: true,
    },
  });

  if (!workflow) {
    throw new AppError("Workflow not found", 404);
  }

  return transformWorkflow(workflow);
};

/**
 * Get a single workflow by ID (without user validation - for public endpoints like webhooks)
 */
export const getWorkflowById = async (id: string): Promise<WorkflowResponse> => {
  if (!id) {
    throw new AppError("Workflow ID is required", 400);
  }

  const workflow = await prismaClient.workflow.findFirst({
    where: {
      id,
    },
    include: {
      nodes: true,
      connections: true,
    },
  });

  if (!workflow) {
    throw new AppError("Workflow not found", 404);
  }

  return transformWorkflow(workflow);
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

  // Use transaction to ensure atomicity
  // Prisma Accelerate limits interactive transactions to 15 seconds max
  // Optimize transaction to complete within this limit
  await (prismaClient as any).$transaction(
    async (tx: any) => {
      // Delete all existing connections first (explicitly to avoid unique constraint issues)
      await tx.connection.deleteMany({
        where: { workflowId: id },
      });

      // Delete all existing nodes (connections should already be deleted, but this ensures cleanup)
      await tx.node.deleteMany({
        where: { workflowId: id },
      });

      // Prepare update data
      // Always update the workflow record to refresh updatedAt timestamp
      const updateData: any = {
        updatedAt: new Date(), // Explicitly update the timestamp
      };

      if (data.name && data.name.trim() !== "") {
        updateData.name = data.name.trim();
      }

      // Update workflow record (this ensures updatedAt is refreshed)
      // This is important to track when the workflow was last modified
      await tx.workflow.update({
        where: { id },
        data: updateData,
      });

      // Build node IDs set for connection validation
      // This avoids an extra database query later
      let nodeIds = new Set<string>();

      // Create nodes separately using upsert to preserve client-provided IDs
      // No deduplication - use all nodes as provided (AI-generated workflows should include all nodes)
      if (data.nodes.length > 0) {
        // Deduplicate nodes by ID to prevent errors, but log if duplicates are found
        const nodeMap = new Map<string, (typeof data.nodes)[0]>();
        const duplicateIds: string[] = [];

        for (const node of data.nodes) {
          if (nodeMap.has(node.id)) {
            duplicateIds.push(node.id);
            // Keep the last occurrence (or first, depending on preference)
            // For AI-generated workflows, we want to keep all nodes, so we'll keep the first
            continue;
          }
          nodeMap.set(node.id, node);
        }

        const uniqueNodes = Array.from(nodeMap.values());
        const nodesToCreate = uniqueNodes.map((node) => {
          // Validate node type exists in our NodeType constants
          if (node.type && !Object.values(NodeType).includes(node.type as any)) {
            throw new AppError(
              `Invalid node type: ${node.type}. Valid types are: ${Object.values(NodeType).join(", ")}`,
              400
            );
          }

          // Preserve the node ID from client so connections can reference it
          return {
            id: node.id, // Use client-provided ID
            workflowId: id,
            name: node.name,
            type: node.type as any, // Prisma will validate against the enum
            position: node.position,
            data: node.data || {},
          };
        });

        // Build node IDs set for connection validation BEFORE creating nodes
        // This avoids an extra database query
        nodeIds = new Set(nodesToCreate.map((n) => n.id));

        // Use createMany for better performance since we've already deleted all nodes
        // This is much faster than individual upserts in a loop
        if (nodesToCreate.length > 0) {
          // Split into batches of 1000 to avoid potential issues with very large arrays
          const batchSize = 1000;
          for (let i = 0; i < nodesToCreate.length; i += batchSize) {
            const batch = nodesToCreate.slice(i, i + batchSize);
            await tx.node.createMany({
              data: batch,
              skipDuplicates: true, // Safety net in case of race conditions
            });
          }
        }
      }

      // Create connections (transform source/target to fromNodeId/toNodeId)
      if (data.connections.length > 0) {
        // Verify all referenced nodes exist using the nodeIds we built earlier
        const missingNodes: string[] = [];
        for (const conn of data.connections) {
          if (!nodeIds.has(conn.source)) {
            missingNodes.push(`source=${conn.source}`);
          }
          if (!nodeIds.has(conn.target)) {
            missingNodes.push(`target=${conn.target}`);
          }
        }

        if (missingNodes.length > 0) {
          throw new AppError(
            `Connection references non-existent node(s): ${missingNodes.join(", ")}. ` +
              `Available node IDs: ${Array.from(nodeIds).join(", ")}`,
            400
          );
        }

        // Transform and deduplicate connections to avoid unique constraint violations
        const connectionMap = new Map<
          string,
          {
            workflowId: string;
            fromNodeId: string;
            toNodeId: string;
            fromOutput: string;
            toInput: string;
          }
        >();

        for (const conn of data.connections) {
          const fromOutput = conn.sourceHandle || "main";
          const toInput = conn.targetHandle || "main";

          // Create unique key for deduplication (matches the unique constraint)
          const uniqueKey = `${conn.source}:${conn.target}:${fromOutput}:${toInput}`;

          if (!connectionMap.has(uniqueKey)) {
            connectionMap.set(uniqueKey, {
              workflowId: id,
              fromNodeId: conn.source,
              toNodeId: conn.target,
              fromOutput,
              toInput,
            });
          }
        }

        // Create connections with transformed field names (deduplicated)
        const uniqueConnections = Array.from(connectionMap.values());

        if (uniqueConnections.length > 0) {
          // Since we deleted all connections at the start, we can directly create them
          // Split into batches of 1000 to avoid potential issues with very large arrays
          const batchSize = 1000;
          for (let i = 0; i < uniqueConnections.length; i += batchSize) {
            const batch = uniqueConnections.slice(i, i + batchSize);
            await tx.connection.createMany({
              data: batch,
              skipDuplicates: true, // Safety net in case of race conditions
            });
          }
        }
      }

      // Don't fetch the workflow inside the transaction - do it after to save time
      // The transaction just needs to complete the writes
      // No return needed - transaction completes successfully
    },
    {
      maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
      timeout: 15000, // Maximum time the transaction can run (15 seconds - Accelerate limit)
    }
  );

  // Fetch the complete workflow AFTER the transaction completes
  // This is faster and avoids transaction timeout issues
  const workflow = await prismaClient.workflow.findUnique({
    where: { id },
    include: {
      nodes: {
        orderBy: {
          createdAt: "asc", // Order nodes by creation time for consistency
        },
      },
      connections: {
        orderBy: {
          createdAt: "asc", // Order connections by creation time for consistency
        },
      },
    },
  });

  if (!workflow) {
    throw new AppError(`Workflow ${id} not found after update`, 404);
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
            // Continue with other nodes even if one fails
            // Cron scheduling errors are non-critical and don't block workflow save
          }
        }
      } catch (error) {
        // Cron scheduler import errors are non-critical
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
