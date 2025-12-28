
import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery, useProtectedMutation } from "@/hooks/useProtectedApi";
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from "@/lib/api-client";
import { toast } from "sonner";

export interface Workflow {
  id: string;
  name: string;
  userId: string;
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
      return authenticatedGet<WorkflowsResponse>(`/workflows?${params.toString()}`);
    },
  });
}

export function useWorkflow(id: string) {
  return useProtectedQuery<Workflow>({
    queryKey: ["workflow", id],
    queryFn: () => authenticatedGet<Workflow>(`/workflows/${id}`),
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useProtectedMutation<Workflow, Error, { name: string }>({
    mutationFn: (data) => authenticatedPost<Workflow>("/workflows", data),
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


export function useUpdateWorkflow() {
  const queryClient = useQueryClient();

  return useProtectedMutation<Workflow, Error, { id: string; name: string }>({
    mutationFn: ({ id, ...data }) => authenticatedPut<Workflow>(`/workflows/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", data.id] });
      toast.success(`Workflow "${data.name}" updated`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to update workflow";
      toast.error(errorMessage);
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();

  return useProtectedMutation<void, Error, { id: string; name: string }>({
    mutationFn: ({ id }) => authenticatedDelete(`/workflows/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success(`Workflow "${variables.name}" removed`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete workflow";
      toast.error(errorMessage);
    },
  });
}

