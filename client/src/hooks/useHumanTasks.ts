import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery, useProtectedMutation } from "@/hooks/useProtectedApi";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedPut,
  authenticatedDelete,
} from "@/lib/api-client";
import { toast } from "sonner";
import type { DeliveryConfig } from "@/hooks/useAgentGoals";

export interface HumanTask {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  supportAgentId?: string | null;
  evidenceType: string;
  recurrenceType: string;
  recurrenceInterval?: number | null;
  scheduledTimes: string[];
  timezone: string;
  acceptanceRules: string[];
  scoringEnabled: boolean;
  passingScore: number;
  graceMinutes: number;
  resubmissionAllowed: boolean;
  reportTime: string;
  reportChannelId?: string | null;
  deliveryConfig?: DeliveryConfig | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  workers?: HumanWorker[];
  submissions?: TaskSubmission[];
  _count?: { workers: number; submissions: number; reports: number };
}

export interface HumanWorker {
  id: string;
  humanTaskId: string;
  name: string;
  phone?: string | null;
  platform: string;
  externalId: string;
  supportChannelId?: string | null;
  role?: string | null;
  status: string;
  onboardedAt?: string | null;
  createdAt: string;
  submissions?: Array<{ status: string; dueAt: string; aiScore?: number | null }>;
}

export interface TaskSubmission {
  id: string;
  humanTaskId: string;
  workerId: string;
  worker?: { id: string; name: string; platform: string };
  dueAt: string;
  submittedAt?: string | null;
  latenessSeconds?: number | null;
  imageUrl?: string | null;
  rawMessage?: string | null;
  aiScore?: number | null;
  aiFindings?: string | null;
  aiFeedback?: string | null;
  status: string;
  vetAttempts: number;
  reportIncluded: boolean;
  createdAt: string;
}

export interface TaskComplianceReport {
  id: string;
  humanTaskId: string;
  periodStart: string;
  periodEnd: string;
  summaryMarkdown: string;
  totalSubmissions: number;
  missedCount: number;
  avgScore?: number | null;
  passRate?: number | null;
  flaggedWorkerIds: string[];
  deliveredAt?: string | null;
  deliveredTo?: Record<string, unknown> | null;
  createdAt: string;
}

export interface CreateHumanTaskData {
  name: string;
  description?: string;
  supportAgentId?: string;
  evidenceType?: string;
  recurrenceType?: string;
  recurrenceInterval?: number;
  scheduledTimes?: string[];
  timezone?: string;
  acceptanceRules?: string[];
  scoringEnabled?: boolean;
  passingScore?: number;
  graceMinutes?: number;
  resubmissionAllowed?: boolean;
  reportTime?: string;
  reportChannelId?: string;
  deliveryConfig?: DeliveryConfig;
}

export type UpdateHumanTaskData = Partial<CreateHumanTaskData> & { status?: string };

export function useHumanTasks() {
  return useProtectedQuery<{ tasks: HumanTask[] }>({
    queryKey: ["human-tasks"],
    queryFn: () => authenticatedGet<{ tasks: HumanTask[] }>("/api/human-tasks"),
  });
}

export function useHumanTask(taskId: string) {
  return useProtectedQuery<{ task: HumanTask }>({
    queryKey: ["human-tasks", taskId],
    queryFn: () => authenticatedGet<{ task: HumanTask }>(`/api/human-tasks/${taskId}`),
    enabled: !!taskId,
  });
}

export function useCreateHumanTask() {
  const queryClient = useQueryClient();
  return useProtectedMutation<{ task: HumanTask }, Error, CreateHumanTaskData>({
    mutationFn: (data) => authenticatedPost<{ task: HumanTask }>("/api/human-tasks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["human-tasks"] });
      toast.success("Task created");
    },
  });
}

export function useUpdateHumanTask() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { taskId: string; data: UpdateHumanTaskData }>({
    mutationFn: ({ taskId, data }) => authenticatedPut(`/api/human-tasks/${taskId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["human-tasks"] });
      toast.success("Task updated");
    },
  });
}

export function useDeleteHumanTask() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { taskId: string }>({
    mutationFn: ({ taskId }) => authenticatedDelete(`/api/human-tasks/${taskId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["human-tasks"] });
      toast.success("Task archived");
    },
  });
}

export function usePauseHumanTask() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { taskId: string }>({
    mutationFn: ({ taskId }) => authenticatedPost(`/api/human-tasks/${taskId}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["human-tasks"] });
      toast.success("Task paused");
    },
  });
}

export function useResumeHumanTask() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { taskId: string }>({
    mutationFn: ({ taskId }) => authenticatedPost(`/api/human-tasks/${taskId}/resume`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["human-tasks"] });
      toast.success("Task resumed");
    },
  });
}

export function useTaskWorkers(taskId: string) {
  return useProtectedQuery<{ workers: HumanWorker[] }>({
    queryKey: ["human-tasks", taskId, "workers"],
    queryFn: () => authenticatedGet<{ workers: HumanWorker[] }>(`/api/human-tasks/${taskId}/workers`),
    enabled: !!taskId,
  });
}

export function useAddWorker() {
  const queryClient = useQueryClient();
  return useProtectedMutation<{ worker: HumanWorker }, Error, { taskId: string; data: { name: string; platform: string; externalId: string; phone?: string; supportChannelId?: string; role?: string } }>({
    mutationFn: ({ taskId, data }) => authenticatedPost<{ worker: HumanWorker }>(`/api/human-tasks/${taskId}/workers`, data),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ["human-tasks", taskId, "workers"] });
      queryClient.invalidateQueries({ queryKey: ["human-tasks"] });
      toast.success("Worker added");
    },
  });
}

export function useRemoveWorker() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { taskId: string; workerId: string }>({
    mutationFn: ({ taskId, workerId }) => authenticatedDelete(`/api/human-tasks/${taskId}/workers/${workerId}`),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ["human-tasks", taskId, "workers"] });
      queryClient.invalidateQueries({ queryKey: ["human-tasks"] });
      toast.success("Worker removed");
    },
  });
}

export function useTaskSubmissions(taskId: string, filters?: { workerId?: string; status?: string; date?: string }) {
  const params = new URLSearchParams();
  if (filters?.workerId) params.set("workerId", filters.workerId);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.date) params.set("date", filters.date);
  const qs = params.toString();

  return useProtectedQuery<{ submissions: TaskSubmission[] }>({
    queryKey: ["human-tasks", taskId, "submissions", filters],
    queryFn: () => authenticatedGet<{ submissions: TaskSubmission[] }>(`/api/human-tasks/${taskId}/submissions${qs ? `?${qs}` : ""}`),
    enabled: !!taskId,
    refetchInterval: 30000,
  });
}

export function useTaskReports(taskId: string) {
  return useProtectedQuery<{ reports: TaskComplianceReport[] }>({
    queryKey: ["human-tasks", taskId, "reports"],
    queryFn: () => authenticatedGet<{ reports: TaskComplianceReport[] }>(`/api/human-tasks/${taskId}/reports`),
    enabled: !!taskId,
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useProtectedMutation<{ report: TaskComplianceReport }, Error, { taskId: string }>({
    mutationFn: ({ taskId }) => authenticatedPost<{ report: TaskComplianceReport }>(`/api/human-tasks/${taskId}/reports/generate`),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ["human-tasks", taskId, "reports"] });
      toast.success("Report generated");
    },
  });
}

export interface ChatChannel {
  id: string;
  platform: string;
  label: string;
  source: "support" | "integration";
}

export function useChatChannels() {
  return useProtectedQuery<{ channels: ChatChannel[] }>({
    queryKey: ["chat-channels"],
    queryFn: () => authenticatedGet<{ channels: ChatChannel[] }>("/api/human-tasks/channels"),
  });
}

export function useAiFillTask() {
  return useProtectedMutation<{ fields: Partial<CreateHumanTaskData> }, Error, { prompt: string }>({
    mutationFn: ({ prompt }) =>
      authenticatedPost<{ fields: Partial<CreateHumanTaskData> }>("/api/human-tasks/ai-fill", { prompt }),
  });
}
