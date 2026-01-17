import { basePrismaClient } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

// ExecutionStatus enum - must match Prisma schema
export enum ExecutionStatus {
  RUNNING = "RUNNING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

// Use basePrismaClient for Execution model since extended client doesn't expose it
const prismaClient = basePrismaClient as any;

export interface CreateExecutionData {
  workflowId: string;
  ingestEventId: string;
  status?: ExecutionStatus;
}

export interface UpdateExecutionData {
  status?: ExecutionStatus;
  error?: string;
  errorStack?: string;
  output?: Record<string, unknown>;
  completedAt?: Date;
}

export interface ExecutionResponse {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  error: string | null;
  errorStack: string | null;
  startedAt: Date;
  completedAt: Date | null;
  ingestEventId: string;
  output: Record<string, unknown> | null;
  workflow?: {
    id: string;
    name: string;
  };
}

/**
 * Create a new execution record
 */
export const createExecution = async (data: CreateExecutionData): Promise<ExecutionResponse> => {
  try {
    const execution = await prismaClient.execution.create({
      data: {
        workflowId: data.workflowId,
        ingestEventId: data.ingestEventId,
        status: data.status || ExecutionStatus.RUNNING,
      },
      select: {
        id: true,
        workflowId: true,
        status: true,
        error: true,
        errorStack: true,
        startedAt: true,
        completedAt: true,
        ingestEventId: true,
        output: true,
      },
    });

    return execution;
  } catch (error) {
    console.error("Error creating execution:", error);
    throw new AppError("Failed to create execution record", 500);
  }
};

/**
 * Update an execution record
 */
export const updateExecution = async (
  id: string,
  data: UpdateExecutionData
): Promise<ExecutionResponse> => {
  try {
    const updateData: any = {};

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (data.error !== undefined) {
      updateData.error = data.error;
    }

    if (data.errorStack !== undefined) {
      updateData.errorStack = data.errorStack;
    }

    if (data.output !== undefined) {
      updateData.output = data.output;
    }

    if (data.completedAt !== undefined) {
      updateData.completedAt = data.completedAt;
    } else if (data.status === ExecutionStatus.SUCCESS || data.status === ExecutionStatus.FAILED) {
      // Auto-set completedAt when status changes to SUCCESS or FAILED
      updateData.completedAt = new Date();
    }

    const execution = await prismaClient.execution.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        workflowId: true,
        status: true,
        error: true,
        errorStack: true,
        startedAt: true,
        completedAt: true,
        ingestEventId: true,
        output: true,
      },
    });

    return execution;
  } catch (error) {
    console.error("Error updating execution:", error);
    throw new AppError("Failed to update execution record", 500);
  }
};

/**
 * Get an execution by ID
 */
export const getExecution = async (id: string): Promise<ExecutionResponse | null> => {
  try {
    const execution = await prismaClient.execution.findUnique({
      where: { id },
      select: {
        id: true,
        workflowId: true,
        status: true,
        error: true,
        errorStack: true,
        startedAt: true,
        completedAt: true,
        ingestEventId: true,
        output: true,
        workflow: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return execution;
  } catch (error) {
    console.error("Error fetching execution:", error);
    throw new AppError("Failed to fetch execution record", 500);
  }
};

/**
 * Get executions by workflow ID
 */
export const getExecutionsByWorkflowId = async (
  workflowId: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  executions: ExecutionResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> => {
  try {
    const skip = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      prismaClient.execution.findMany({
        where: { workflowId },
        skip,
        take: limit,
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          workflowId: true,
          status: true,
          error: true,
          errorStack: true,
          startedAt: true,
          completedAt: true,
          ingestEventId: true,
          output: true,
          workflow: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prismaClient.execution.count({
        where: { workflowId },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      executions,
      total,
      page,
      limit,
      totalPages: totalPages || 1,
    };
  } catch (error) {
    console.error("Error fetching executions:", error);
    throw new AppError("Failed to fetch executions", 500);
  }
};

/**
 * Get execution by ingest event ID
 */
export const getExecutionByIngestEventId = async (
  ingestEventId: string
): Promise<ExecutionResponse | null> => {
  try {
    const execution = await prismaClient.execution.findUnique({
      where: { ingestEventId },
      select: {
        id: true,
        workflowId: true,
        status: true,
        error: true,
        errorStack: true,
        startedAt: true,
        completedAt: true,
        ingestEventId: true,
        output: true,
      },
    });

    return execution;
  } catch (error) {
    console.error("Error fetching execution by ingest event ID:", error);
    throw new AppError("Failed to fetch execution record", 500);
  }
};

/**
 * Get all executions for a user (across all their workflows)
 */
export const getExecutionsByUserId = async (
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  executions: ExecutionResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> => {
  try {
    const skip = (page - 1) * limit;

    // First, get all workflow IDs for this user
    const userWorkflows = await prismaClient.workflow.findMany({
      where: { userId },
      select: { id: true },
    });

    const workflowIds = userWorkflows.map((w: { id: string }) => w.id);

    // If user has no workflows, return empty result
    if (workflowIds.length === 0) {
      return {
        executions: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    const [executions, total] = await Promise.all([
      prismaClient.execution.findMany({
        where: {
          workflowId: {
            in: workflowIds,
          },
        },
        skip,
        take: limit,
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          workflowId: true,
          status: true,
          error: true,
          errorStack: true,
          startedAt: true,
          completedAt: true,
          ingestEventId: true,
          output: true,
          workflow: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prismaClient.execution.count({
        where: {
          workflowId: {
            in: workflowIds,
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      executions,
      total,
      page,
      limit,
      totalPages: totalPages || 1,
    };
  } catch (error) {
    console.error("Error fetching executions by user ID:", error);
    throw new AppError("Failed to fetch executions", 500);
  }
};
