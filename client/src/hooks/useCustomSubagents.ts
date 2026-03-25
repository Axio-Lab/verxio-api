import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery, useProtectedMutation } from "@/hooks/useProtectedApi";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedPut,
  authenticatedDelete,
} from "@/lib/api-client";
import { toast } from "sonner";

export interface CustomSubagent {
  id: string;
  name: string;
  slug: string;
  description: string;
  prompt: string;
  skillIds: string[];
  tools: string[];
  model: string;
  maxTurns: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubagentData {
  name: string;
  description: string;
  prompt: string;
  skillIds?: string[];
  tools?: string[];
  maxTurns?: number;
}

export interface UpdateSubagentData {
  name?: string;
  description?: string;
  prompt?: string;
  skillIds?: string[];
  tools?: string[];
  maxTurns?: number;
  isActive?: boolean;
}

export interface BuiltinSubagent {
  slug: string;
  name: string;
  description: string;
  isBuiltin: true;
}

export interface AvailableSubagentsResponse {
  builtinSubagents: BuiltinSubagent[];
  customSubagents: (CustomSubagent & { isBuiltin: false })[];
}

export function useCustomSubagents() {
  return useProtectedQuery<{ subagents: CustomSubagent[] }>({
    queryKey: ["custom-subagents"],
    queryFn: () =>
      authenticatedGet<{ subagents: CustomSubagent[] }>("/api/custom-subagents"),
  });
}

export function useAvailableSubagents() {
  return useProtectedQuery<AvailableSubagentsResponse>({
    queryKey: ["available-subagents"],
    queryFn: () =>
      authenticatedGet<AvailableSubagentsResponse>("/api/custom-subagents/available"),
  });
}

export function useCreateCustomSubagent() {
  const queryClient = useQueryClient();
  return useProtectedMutation<CustomSubagent, Error, CreateSubagentData>({
    mutationFn: (data) =>
      authenticatedPost<CustomSubagent>("/api/custom-subagents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-subagents"] });
      toast.success("Subagent created");
    },
  });
}

export function useUpdateCustomSubagent() {
  const queryClient = useQueryClient();
  return useProtectedMutation<
    CustomSubagent,
    Error,
    { id: string; data: UpdateSubagentData }
  >({
    mutationFn: ({ id, data }) =>
      authenticatedPut<CustomSubagent>(`/api/custom-subagents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-subagents"] });
      toast.success("Subagent updated");
    },
  });
}

export function useDeleteCustomSubagent() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => authenticatedDelete(`/api/custom-subagents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-subagents"] });
      toast.success("Subagent deleted");
    },
  });
}
