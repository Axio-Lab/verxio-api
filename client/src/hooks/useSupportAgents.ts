import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery, useProtectedMutation } from "@/hooks/useProtectedApi";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedPut,
  authenticatedDelete,
} from "@/lib/api-client";
import { toast } from "sonner";

export interface SupportAgent {
  id: string;
  publicId: string;
  name: string;
  description?: string | null;
  knowledgeBaseIds: string[];
  fallbackEmail?: string | null;
  greeting: string;
  brandColor: string;
  position: string;
  status: string;
  conversations: number;
  mode?: string;
  skillIds?: string[];
  soulMd?: string | null;
  campaignContext?: string | null;
  funnelRules?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt?: string;
}

export interface SupportAgentsResponse {
  agents: SupportAgent[];
}

export interface CreateSupportAgentData {
  name: string;
  description?: string;
  knowledgeBaseIds?: string[];
  fallbackEmail?: string;
  greeting?: string;
  brandColor?: string;
  position?: string;
  mode?: string;
  skillIds?: string[];
  soulMd?: string | null;
  campaignContext?: string | null;
  funnelRules?: Record<string, unknown> | null;
}

export type UpdateSupportAgentData = Partial<CreateSupportAgentData> & {
  status?: string;
};

export function useSupportAgents() {
  return useProtectedQuery<SupportAgentsResponse>({
    queryKey: ["support-agents"],
    queryFn: () => authenticatedGet<SupportAgentsResponse>("/api/support-agents"),
  });
}

export function useCreateSupportAgent() {
  const queryClient = useQueryClient();
  return useProtectedMutation<SupportAgent, Error, CreateSupportAgentData>({
    mutationFn: (data) => authenticatedPost<SupportAgent>("/api/support-agents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-agents"] });
      toast.success("Support agent created");
    },
  });
}

export function useUpdateSupportAgent() {
  const queryClient = useQueryClient();
  return useProtectedMutation<SupportAgent, Error, { id: string; data: UpdateSupportAgentData }>({
    mutationFn: ({ id, data }) => authenticatedPut<SupportAgent>(`/api/support-agents/${id}`, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["support-agents"] });
      if (variables.data?.status !== undefined) {
        const statusLabel = variables.data.status === "active" ? "active" : "disabled";
        toast.success(`${data.name} is now ${statusLabel}`);
      } else {
        toast.success("Support agent updated");
      }
    },
  });
}

export function useDeleteSupportAgent() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => authenticatedDelete(`/api/support-agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-agents"] });
      toast.success("Support agent deleted");
    },
  });
}
