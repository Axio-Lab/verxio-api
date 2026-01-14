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
  // Set timeout to 15 seconds (Accelerate's maximum limit) for workflows with many nodes/connections
  // (default is 5 seconds which is too short for large workflows)
  // Optimized by removing redundant verification queries to improve performance
  const workflow = await (prismaClient as any).$transaction(
    async (tx: any) => {
      // Delete all existing connections first (must delete before nodes due to foreign key)
      await tx.connection.deleteMany({
        where: { workflowId: id },
      });

      // Delete all existing nodes
      await tx.node.deleteMany({
        where: { workflowId: id },
      });

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

            // Preserve the node ID from client so connections can reference it
            return {
              id: node.id.trim(), // Use client-provided ID, trim whitespace
              workflowId: id,
              name: (node.name || node.id).trim(),
              type: node.type as any, // Prisma will validate against the enum
              position: node.position || { x: 0, y: 0 },
              data: node.data || {},
            };
          })
          .filter((node) => {
            // Filter out any nodes that failed validation (shouldn't happen, but safety check)
            return node.id && node.type;
          });

        // Use createMany to create nodes with their IDs
        // We delete all nodes first, so there should be no duplicates
        // Remove skipDuplicates to ensure we catch any issues instead of silently failing
        const createResult = await tx.node.createMany({
          data: nodesToCreate,
        });

        // Log for debugging - this is critical to understand what's happening
        if (createResult.count !== nodesToCreate.length) {
          console.error(
            `[WorkflowService] CRITICAL: Created ${createResult.count} nodes but expected ${nodesToCreate.length} for workflow ${id}`
          );
          console.error(
            `[WorkflowService] This likely means some nodes were skipped due to duplicate IDs or validation errors`
          );

          // Throw error instead of silently failing
          // Note: Removed verification query to optimize transaction speed
          throw new AppError(
            `Failed to create all nodes. Expected ${nodesToCreate.length} but only created ${createResult.count}.`,
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
      timeout: 15000, // 15 seconds timeout (Accelerate's maximum limit)
      maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
    }
  );

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
