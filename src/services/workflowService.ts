import { basePrismaClient } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
const { NodeType } = require('../../node_modules/.prisma/client');



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
export const createWorkflow = async (
  data: CreateWorkflowData
): Promise<WorkflowResponse> => {
  if (!data.name || data.name.trim() === '') {
    throw new AppError('Workflow name is required', 400);
  }

  if (!data.userId) {
    throw new AppError('User ID is required', 400);
  }

  // Verify user exists
  const user = await prismaClient.user.findUnique({
    where: { id: data.userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
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
    throw new AppError('User ID is required', 400);
  }

  const skip = (page - 1) * limit;
  const take = limit;

  // Build where clause
  const where: any = {
    userId,
  };

  if (search && search.trim() !== '') {
    where.name = {
      contains: search.trim(),
      mode: 'insensitive',
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
      createdAt: 'desc',
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
 * Get a single workflow by ID
 */
export const getWorkflow = async (
  id: string,
  userId: string
): Promise<WorkflowResponse> => {
  if (!id) {
    throw new AppError('Workflow ID is required', 400);
  }

  if (!userId) {
    throw new AppError('User ID is required', 400);
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
    throw new AppError('Workflow not found', 404);
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
    throw new AppError('Workflow ID is required', 400);
  }

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  if (!data.name || data.name.trim() === '') {
    throw new AppError('Workflow name is required', 400);
  }

  // Verify workflow exists and belongs to user
  const existingWorkflow = await prismaClient.workflow.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!existingWorkflow) {
    throw new AppError('Workflow not found', 404);
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
    throw new AppError('Workflow ID is required', 400);
  }

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  // Verify workflow exists and belongs to user
  const existingWorkflow = await prismaClient.workflow.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!existingWorkflow) {
    throw new AppError('Workflow not found', 404);
  }

  // Validate nodes
  if (!Array.isArray(data.nodes)) {
    throw new AppError('Nodes must be an array', 400);
  }

  // Validate that all nodes have IDs (required for connection references)
  for (const node of data.nodes) {
    if (!node.id || node.id.trim() === '') {
      throw new AppError('All nodes must have an ID to maintain connection references', 400);
    }
  }

  // Validate connections
  if (!Array.isArray(data.connections)) {
    throw new AppError('Connections must be an array', 400);
  }

  // Use transaction to ensure atomicity
  const workflow = await (prismaClient as any).$transaction(async (tx: any) => {
    // Delete all existing nodes (connections will be cascade deleted)
    await tx.node.deleteMany({
      where: { workflowId: id },
    });

    // Prepare update data
    const updateData: any = {};

    if (data.name && data.name.trim() !== '') {
      updateData.name = data.name.trim();
    }

    // Update workflow name first (if provided)
    await tx.workflow.update({
      where: { id },
      data: updateData,
    });

    // Create nodes separately using createMany to preserve client-provided IDs
    if (data.nodes.length > 0) {
      const nodesToCreate = data.nodes.map((node) => {
        // Access the enum value directly: NodeType[node.type] returns the enum value string
        let nodeType: any = node.type;
        
        // Validate and convert to enum value if it exists
        if (node.type && (NodeType as any)[node.type]) {
          nodeType = (NodeType as any)[node.type];
        } else if (node.type) {
          // If the type doesn't exist in enum, throw an error
          throw new AppError(
            `Invalid node type: ${node.type}. Valid types are: ${Object.keys(NodeType).join(', ')}`,
            400
          );
        }
        
        // Preserve the node ID from client so connections can reference it
        return {
          id: node.id, // Use client-provided ID
          workflowId: id,
          name: node.name,
          type: nodeType,
          position: node.position,
          data: node.data || {},
        };
      });

      // Use createMany to create nodes with their IDs
      await tx.node.createMany({
        data: nodesToCreate,
        skipDuplicates: false, // Fail if duplicate IDs exist
      });
    }

    // Fetch the newly created nodes to verify they exist
    const createdNodes = await tx.node.findMany({
      where: { workflowId: id },
      select: { id: true },
    });
    const nodeIds = new Set(createdNodes.map((n: any) => n.id));

    // Create connections (transform source/target to fromNodeId/toNodeId)
    if (data.connections.length > 0) {
      // Verify all referenced nodes exist
      
      for (const conn of data.connections) {
        if (!nodeIds.has(conn.source) || !nodeIds.has(conn.target)) {
          throw new AppError(
            `Connection references non-existent node: source=${conn.source}, target=${conn.target}`,
            400
          );
        }
      }

      // Create connections with transformed field names
      await tx.connection.createMany({
        data: data.connections.map((conn) => ({
          workflowId: id,
          fromNodeId: conn.source,
          toNodeId: conn.target,
          fromOutput: conn.sourceHandle || 'main',
          toInput: conn.targetHandle || 'main',
        })),
      });
    }

    // Fetch the complete workflow with all relations
    return await tx.workflow.findUnique({
      where: { id },
      include: {
        nodes: true,
        connections: true,
      },
    });
  });

  return transformWorkflow(workflow);
};

/**
 * Delete a workflow
 */
export const deleteWorkflow = async (
  id: string,
  userId: string
): Promise<void> => {
  if (!id) {
    throw new AppError('Workflow ID is required', 400);
  }

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  // Verify workflow exists and belongs to user
  const existingWorkflow = await prismaClient.workflow.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!existingWorkflow) {
    throw new AppError('Workflow not found', 404);
  }

  await prismaClient.workflow.delete({
    where: { id },
  });
};

