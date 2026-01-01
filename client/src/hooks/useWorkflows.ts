
import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery, useProtectedMutation } from "@/hooks/useProtectedApi";
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from "@/lib/api-client";
import { toast } from "sonner";

export interface WorkflowNode {
  id: string;
  workflowId: string;
  name: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowConnection {
  id: string;
  workflowId: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workflow {
  id: string;
  name: string;
  userId: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowsResponse {
  workflows: Workflow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useWorkflows(page: number = 1, limit: number = 10, search?: string) {
  return useProtectedQuery<WorkflowsResponse>({
    queryKey: ["workflows", page, limit, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) {
        params.append("search", search);
      }
      return authenticatedGet<WorkflowsResponse>(`/workflow?${params.toString()}`);
    },
  });
}

export function useWorkflow(id: string) {
  return useProtectedQuery<Workflow>({
    queryKey: ["workflow", id],
    queryFn: () => authenticatedGet<Workflow>(`/workflow/${id}`),
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useProtectedMutation<Workflow, Error, { name: string }>({
    mutationFn: (data) => authenticatedPost<Workflow>("/workflow/create", data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success(`Workflow "${data.name}" created`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to create workflow";
      toast.error(errorMessage);
    },
  });
}


export function useUpdateWorkflowName() {
  const queryClient = useQueryClient();

  return useProtectedMutation<Workflow, Error, { id: string; name: string }>({
    mutationFn: ({ id, ...data }) => authenticatedPut<Workflow>(`/workflow/update/name/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", data.id] });
      toast.success(`Workflow "${data.name}" updated`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to update workflow name";
      toast.error(errorMessage);
    },
  });
}

export interface UpdateWorkflowData {
  name?: string;
  nodes: Array<{
    id?: string;
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

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();

  return useProtectedMutation<Workflow, Error, { id: string; data: UpdateWorkflowData }>({
    mutationFn: ({ id, data }) => authenticatedPut<Workflow>(`/workflow/update/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", data.id] });
      toast.success(`Workflow "${data.name}" saved`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to save workflow";
      toast.error(errorMessage);
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();

  return useProtectedMutation<void, Error, { id: string; name: string }>({
    mutationFn: ({ id }) => authenticatedDelete(`/workflow/delete/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success(`Workflow "${variables.name}" deleted`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete workflow";
      toast.error(errorMessage);
    },
  });
}

export interface TriggerWorkflowResponse {
  success: boolean;
  message: string;
  workflowId: string;
  workflowName: string;
}

export function useTriggerWorkflow() {
  return useProtectedMutation<TriggerWorkflowResponse, Error, { id: string; data?: Record<string, any> }>({
    mutationFn: ({ id, data }) => {
      // Send data in the format expected by the backend: { data: {...} }
      const body = data ? { data } : {};
      return authenticatedPost<TriggerWorkflowResponse>(`/workflow/trigger/${id}`, body);
    },
    // Don't retry on 429 (Too Many Requests) errors
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('429') || error.message.includes('Too many requests')) {
        return false;
      }
      return failureCount < 2; // Retry up to 2 times for other errors
    },
    onSuccess: (data) => {
      toast.success(`Workflow "${data.workflowName}" executed`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to execute workflow";
      toast.error(errorMessage);
    },
  });
}

