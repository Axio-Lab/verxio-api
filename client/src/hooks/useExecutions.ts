import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery } from "@/hooks/useProtectedApi";
import { authenticatedGet } from "@/lib/api-client";

export enum ExecutionStatus {
  RUNNING = "RUNNING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

export interface Execution {
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

export interface ExecutionsResponse {
  executions: Execution[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Get executions for a workflow with pagination
 * Automatically polls for updates when there are RUNNING executions
 */
export function useExecutions(workflowId: string, page: number = 1, limit: number = 20) {
  return useProtectedQuery<ExecutionsResponse>({
    queryKey: ["executions", workflowId, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      return authenticatedGet<ExecutionsResponse>(
        `/execution/workflow/${workflowId}?${params.toString()}`
      );
    },
    enabled: !!workflowId,
    staleTime: 0, // Always consider data stale to allow immediate refetch
    refetchOnWindowFocus: true, // Refetch when window regains focus
    // Poll every 3 seconds if there are RUNNING executions
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.executions) {
        const hasRunning = data.executions.some((exec) => exec.status === ExecutionStatus.RUNNING);
        return hasRunning ? 3000 : false; // Poll every 3s if running, otherwise don't poll
      }
      return false;
    },
  });
}

/**
 * Get a single execution by ID
 * Uses cached data from executions list if available, then fetches fresh data
 * Automatically polls for updates when execution status is RUNNING
 */
export function useExecution(id: string) {
  const queryClient = useQueryClient();

  return useProtectedQuery<Execution>({
    queryKey: ["execution", id],
    queryFn: () => authenticatedGet<Execution>(`/execution/${id}`),
    enabled: !!id,
    staleTime: 0, // Always consider data stale to allow immediate refetch
    refetchOnWindowFocus: true, // Refetch when window regains focus
    // Poll every 3 seconds if execution is RUNNING
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === ExecutionStatus.RUNNING ? 3000 : false;
    },
    // Use cached data from executions list if available
    placeholderData: () => {
      // Check all executions queries in cache
      const queries = queryClient.getQueriesData<ExecutionsResponse>({
        queryKey: ["executions"],
      });

      // Search through cached execution lists to find this execution
      for (const [, data] of queries) {
        if (data?.executions) {
          const cachedExecution = data.executions.find((exec) => exec.id === id);
          if (cachedExecution) {
            return cachedExecution;
          }
        }
      }

      return undefined;
    },
  });
}

/**
 * Get all executions for the authenticated user (across all workflows)
 * Automatically polls for updates when there are RUNNING executions
 */
export function useAllExecutions(page: number = 1, limit: number = 20) {
  return useProtectedQuery<ExecutionsResponse>({
    queryKey: ["executions", "all", page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      return authenticatedGet<ExecutionsResponse>(`/execution?${params.toString()}`);
    },
    staleTime: 0, // Always consider data stale to allow immediate refetch
    refetchOnWindowFocus: true, // Refetch when window regains focus
    // Poll every 3 seconds if there are RUNNING executions
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.executions) {
        const hasRunning = data.executions.some((exec) => exec.status === ExecutionStatus.RUNNING);
        return hasRunning ? 3000 : false; // Poll every 3s if running, otherwise don't poll
      }
      return false;
    },
  });
}

/**
 * Prefetch execution data for instant loading
 * Useful for prefetching when hovering over execution items in a list
 */
export const prefetchExecution = async (queryClient: any, id: string) => {
  await queryClient.prefetchQuery({
    queryKey: ["execution", id],
    queryFn: () => authenticatedGet<Execution>(`/execution/${id}`),
  });
};
