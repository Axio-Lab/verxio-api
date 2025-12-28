import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export interface CreateWorkflowData {
  name: string;
  userId: string;
}

export interface UpdateWorkflowData {
  name: string;
}

export interface WorkflowResponse {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
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
  const user = await (prisma as any).user.findUnique({
    where: { id: data.userId },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const workflow = await (prisma as any).workflow.create({
    data: {
      name: data.name.trim(),
      userId: data.userId,
    },
  });

  return workflow;
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
  const total = await (prisma as any).workflow.count({ where });

  // Get workflows
  const workflows = await (prisma as any).workflow.findMany({
    where,
    skip,
    take,
    orderBy: {
      createdAt: 'desc',
    },
  });

  const totalPages = Math.ceil(total / limit);

  return {
    workflows,
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

  const workflow = await (prisma as any).workflow.findFirst({
    where: {
      id,
      userId, // Ensure user owns the workflow
    },
  });

  if (!workflow) {
    throw new AppError('Workflow not found', 404);
  }

  return workflow;
};

/**
 * Update a workflow
 */
export const updateWorkflow = async (
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
  const existingWorkflow = await (prisma as any).workflow.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!existingWorkflow) {
    throw new AppError('Workflow not found', 404);
  }

  const workflow = await (prisma as any).workflow.update({
    where: { id },
    data: {
      name: data.name.trim(),
    },
  });

  return workflow;
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
  const existingWorkflow = await (prisma as any).workflow.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!existingWorkflow) {
    throw new AppError('Workflow not found', 404);
  }

  await (prisma as any).workflow.delete({
    where: { id },
  });
};

