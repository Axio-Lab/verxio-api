import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery, useProtectedMutation } from "@/hooks/useProtectedApi";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedPut,
  authenticatedDelete,
} from "@/lib/api-client";
import { toast } from "sonner";

export interface Skill {
  id: string;
  name: string;
  description?: string;
  url?: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillsResponse {
  skills: Skill[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateSkillData {
  name?: string;
  description?: string;
  url?: string;
  content?: string;
}

export interface UpdateSkillData {
  name?: string;
  description?: string;
  url?: string;
  content?: string;
}

/**
 * Get skills with pagination
 */
export function useSkills(page: number = 1, limit: number = 10) {
  return useProtectedQuery<SkillsResponse>({
    queryKey: ["skills", page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      return authenticatedGet<SkillsResponse>(`/skill?${params.toString()}`);
    },
  });
}

/**
 * Get a single skill by ID
 * Uses cached data from skills list if available, then fetches fresh data
 */
export function useSkill(id: string) {
  const queryClient = useQueryClient();

  return useProtectedQuery<Skill>({
    queryKey: ["skill", id],
    queryFn: () => authenticatedGet<Skill>(`/skill/${id}`),
    enabled: !!id,
    // Use cached data from skills list if available
    placeholderData: () => {
      // Check all skills queries in cache
      const queries = queryClient.getQueriesData<SkillsResponse>({
        queryKey: ["skills"],
      });

      // Find the skill in any of the cached skills lists
      for (const [, data] of queries) {
        if (data?.skills) {
          const cachedSkill = data.skills.find((s) => s.id === id);
          if (cachedSkill) {
            return cachedSkill;
          }
        }
      }

      return undefined;
    },
  });
}

/**
 * Create a new skill
 */
export function useCreateSkill() {
  const queryClient = useQueryClient();

  return useProtectedMutation<Skill, Error, CreateSkillData>({
    mutationFn: (data) => authenticatedPost<Skill>("/skill", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      toast.success("Skill created successfully");
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to create skill";
      toast.error(errorMessage);
    },
  });
}

/**
 * Update a skill
 */
export function useUpdateSkill(skillId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<Skill, Error, UpdateSkillData>({
    mutationFn: (data) => authenticatedPut<Skill>(`/skill/${skillId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["skill", skillId] });
      toast.success("Skill updated successfully");
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to update skill";
      toast.error(errorMessage);
    },
  });
}

/**
 * Delete a skill
 */
export function useDeleteSkill() {
  const queryClient = useQueryClient();

  return useProtectedMutation<void, Error, string>({
    mutationFn: (id) => authenticatedDelete<void>(`/skill/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      toast.success("Skill deleted successfully");
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete skill";
      toast.error(errorMessage);
    },
  });
}
