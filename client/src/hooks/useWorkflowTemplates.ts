import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery, useProtectedMutation } from "@/hooks/useProtectedApi";
import { authenticatedGet, authenticatedPost } from "@/lib/api-client";
import { toast } from "sonner";

export interface WorkflowTemplateListItem {
  id: string;
  name: string;
  shortDescription: string;
  pricing: string;
  creatorUsername: string;
  category: string;
  createdAt: string;
}

export interface WorkflowTemplateDetail extends WorkflowTemplateListItem {
  howItWorks: string;
  requirements: string | null;
  workflowId: string;
  workflowSnapshot: { nodes: unknown[]; connections: unknown[] };
}

export interface WorkflowTemplatesResponse {
  templates: WorkflowTemplateListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ExportTemplateInput {
  workflowId: string;
  name: string;
  shortDescription: string;
  howItWorks: string;
  requirements?: string;
  pricing?: string;
  category: string;
  creatorUsername: string;
}

export interface GenerateMetadataResponse {
  name: string;
  shortDescription: string;
  howItWorks: string;
  requirements: string;
  category: string;
}

export interface ImportTemplateResponse {
  workflowId: string;
  name: string;
}

export function useWorkflowTemplates(
  opts: { search?: string; category?: string; page?: number; limit?: number } = {}
) {
  const { search, category, page = 1, limit = 10 } = opts;
  return useProtectedQuery<WorkflowTemplatesResponse>({
    queryKey: ["workflow-templates", search, category, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      return authenticatedGet<WorkflowTemplatesResponse>(`/workflow-template?${params.toString()}`);
    },
  });
}

export function useWorkflowTemplate(id: string) {
  return useProtectedQuery<WorkflowTemplateDetail>({
    queryKey: ["workflow-template", id],
    queryFn: () => authenticatedGet<WorkflowTemplateDetail>(`/workflow-template/${id}`),
    enabled: !!id,
  });
}

export function useExportWorkflowAsTemplate() {
  const queryClient = useQueryClient();
  return useProtectedMutation<WorkflowTemplateDetail, Error, ExportTemplateInput>({
    mutationFn: (data) => authenticatedPost<WorkflowTemplateDetail>("/workflow-template", data),
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: ["workflow-templates"] });
      toast.success(`Template "${template.name}" created`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to export template");
    },
  });
}

export function useGenerateTemplateMetadata() {
  return useProtectedMutation<GenerateMetadataResponse, Error, string>({
    mutationFn: (workflowId) =>
      authenticatedPost<GenerateMetadataResponse>("/workflow-template/generate-metadata", {
        workflowId,
      }),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to generate template metadata");
    },
  });
}

export function useImportWorkflowTemplate() {
  const queryClient = useQueryClient();
  return useProtectedMutation<ImportTemplateResponse, Error, string>({
    mutationFn: (templateId) =>
      authenticatedPost<ImportTemplateResponse>(`/workflow-template/${templateId}/import`, {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-templates"] });
      toast.success(`Workflow "${data.name}" imported`);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to import template";
      if (msg.includes("premium") || msg.includes("Upgrade")) {
        toast.error("Upgrade to a premium plan to import this template.");
      } else {
        toast.error(msg);
      }
    },
  });
}
