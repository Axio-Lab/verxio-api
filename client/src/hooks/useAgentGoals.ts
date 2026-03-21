import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery, useProtectedMutation } from "@/hooks/useProtectedApi";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedPut,
  authenticatedDelete,
} from "@/lib/api-client";
import { toast } from "sonner";

export interface DeliveryAction {
  action: string;
  label: string;
  params?: Record<string, unknown>;
  enabled?: boolean;
}

export interface DeliveryConfig {
  messagingChannel?: boolean;
  composioActions?: DeliveryAction[];
}

export interface AgentGoal {
  id: string;
  userId: string;
  name: string;
  objective: string;
  status: string;
  decomposedAt?: string | null;
  completedAt?: string | null;
  reportingChannelId?: string | null;
  deliveryConfig?: DeliveryConfig | null;
  maxRetries: number;
  currentRetries: number;
  createdAt: string;
  updatedAt: string;
  tasks?: AgentTask[];
  memories?: AgentMemory[];
  watches?: AgentWatch[];
  _count?: { tasks: number };
}

export interface AgentTask {
  id: string;
  goalId: string;
  title: string;
  description?: string | null;
  status: string;
  assignedAgent?: string | null;
  tool?: string | null;
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  blockerReason?: string | null;
  dependsOn: string[];
  startedAt?: string | null;
  completedAt?: string | null;
  retries: number;
  createdAt: string;
}

export interface AgentMemory {
  id: string;
  userId: string;
  goalId?: string | null;
  scope: string;
  key: string;
  value: string;
  confidence: number;
  expiresAt?: string | null;
  lastAccessedAt: string;
  createdAt: string;
}

export interface AgentWatch {
  id: string;
  userId: string;
  goalId?: string | null;
  name: string;
  description?: string | null;
  triggerType: string;
  cronExpression?: string | null;
  thresholdCondition?: Record<string, unknown> | null;
  actionWorkflowId?: string | null;
  actionWorkflow?: { id: string; name: string } | null;
  status: string;
  lastFiredAt?: string | null;
  createdAt: string;
}

export function useAgentGoals() {
  return useProtectedQuery<{ goals: AgentGoal[] }>({
    queryKey: ["agent-goals"],
    queryFn: () => authenticatedGet<{ goals: AgentGoal[] }>("/api/agent-goals"),
  });
}

export function useAgentGoal(goalId: string) {
  return useProtectedQuery<{ goal: AgentGoal }>({
    queryKey: ["agent-goals", goalId],
    queryFn: () => authenticatedGet<{ goal: AgentGoal }>(`/api/agent-goals/${goalId}`),
    enabled: !!goalId,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useProtectedMutation<
    { goal: AgentGoal },
    Error,
    { name: string; objective: string; reportingChannelId?: string; deliveryConfig?: DeliveryConfig }
  >({
    mutationFn: (data) => authenticatedPost<{ goal: AgentGoal }>("/api/agent-goals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-goals"] });
      toast.success("Goal created and decomposition started");
    },
  });
}

export function useDeliveryActions() {
  return useProtectedQuery<{ actions: DeliveryAction[] }>({
    queryKey: ["delivery-actions"],
    queryFn: () =>
      authenticatedGet<{ actions: DeliveryAction[] }>("/api/agent-goals/delivery-actions/available"),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { goalId: string }>({
    mutationFn: ({ goalId }) => authenticatedDelete(`/api/agent-goals/${goalId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-goals"] });
      toast.success("Goal deleted");
    },
  });
}

export function useGoalTasks(goalId: string) {
  return useProtectedQuery<{ tasks: AgentTask[] }>({
    queryKey: ["agent-goals", goalId, "tasks"],
    queryFn: () => authenticatedGet<{ tasks: AgentTask[] }>(`/api/agent-goals/${goalId}/tasks`),
    enabled: !!goalId,
  });
}

export function useGoalMemories(goalId: string) {
  return useProtectedQuery<{ memories: AgentMemory[] }>({
    queryKey: ["agent-goals", goalId, "memories"],
    queryFn: () => authenticatedGet<{ memories: AgentMemory[] }>(`/api/agent-goals/${goalId}/memories`),
    enabled: !!goalId,
  });
}

export function useDeleteMemory() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { goalId: string; memoryId: string }>({
    mutationFn: ({ goalId, memoryId }) =>
      authenticatedDelete(`/api/agent-goals/${goalId}/memories/${memoryId}`),
    onSuccess: (_, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: ["agent-goals", goalId, "memories"] });
      toast.success("Memory deleted");
    },
  });
}

export function useAgentWatches() {
  return useProtectedQuery<{ watches: AgentWatch[] }>({
    queryKey: ["agent-watches"],
    queryFn: () => authenticatedGet<{ watches: AgentWatch[] }>("/api/agent-goals/watches"),
  });
}

export function useCreateWatch() {
  const queryClient = useQueryClient();
  return useProtectedMutation<{ watch: AgentWatch }, Error, { name: string; triggerType: string; cronExpression?: string; thresholdCondition?: Record<string, unknown>; actionWorkflowId?: string }>({
    mutationFn: (data) => authenticatedPost<{ watch: AgentWatch }>("/api/agent-goals/watches", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-watches"] });
      toast.success("Watch created");
    },
  });
}

export function usePauseWatch() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { watchId: string }>({
    mutationFn: ({ watchId }) => authenticatedPost(`/api/agent-goals/watches/${watchId}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-watches"] });
      toast.success("Watch paused");
    },
  });
}

export function useResumeWatch() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { watchId: string }>({
    mutationFn: ({ watchId }) => authenticatedPost(`/api/agent-goals/watches/${watchId}/resume`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-watches"] });
      toast.success("Watch resumed");
    },
  });
}

export function useApproveGoal() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { goalId: string }>({
    mutationFn: ({ goalId }) => authenticatedPost(`/api/agent-goals/${goalId}/approve`),
    onSuccess: (_, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: ["agent-goals", goalId] });
      toast.success("Goal approved");
    },
  });
}

export function useRejectGoal() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { goalId: string }>({
    mutationFn: ({ goalId }) => authenticatedPost(`/api/agent-goals/${goalId}/reject`),
    onSuccess: (_, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: ["agent-goals", goalId] });
      toast.success("Goal rejected");
    },
  });
}

export function useAiFillGoal() {
  return useProtectedMutation<
    { fields: { name: string; objective: string } },
    Error,
    { prompt: string }
  >({
    mutationFn: ({ prompt }) =>
      authenticatedPost<{ fields: { name: string; objective: string } }>(
        "/api/agent-goals/ai-fill",
        { prompt }
      ),
  });
}
