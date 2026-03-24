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
  sampleEvidenceUrl?: string | null;
  scoringEnabled: boolean;
  passingScore: number;
  graceMinutes: number;
  resubmissionAllowed: boolean;
  reportTime: string;
  reportChannelId?: string | null;
  taskChannelId?: string | null;
  taskChannel?: { id: string; platform: string; label?: string | null } | null;
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
  /** Required: worker reminders, onboarding, HELP, and report delivery use this channel */
  reportChannelId: string;
  description?: string;
  supportAgentId?: string;
  evidenceType?: string;
  recurrenceType?: string;
  recurrenceInterval?: number;
  scheduledTimes?: string[];
  timezone?: string;
  acceptanceRules?: string[];
  sampleEvidenceUrl?: string;
  scoringEnabled?: boolean;
  passingScore?: number;
  graceMinutes?: number;
  resubmissionAllowed?: boolean;
  reportTime?: string;
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
    onError: (e) => toast.error(e.message || "Could not create task"),
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
    onError: (e) => toast.error(e.message || "Could not update task"),
  });
}

export function useDeleteHumanTask() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { taskId: string }>({
    mutationFn: ({ taskId }) => authenticatedDelete(`/api/human-tasks/${taskId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["human-tasks"] });
      toast.success("Task deleted");
    },
  });
}

export async function uploadSampleEvidence(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
  const res = await fetch(`${apiBase}/api/human-tasks/upload-sample-evidence`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url;
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
    queryFn: () =>
      authenticatedGet<{ workers: HumanWorker[] }>(`/api/human-tasks/${taskId}/workers`),
    enabled: !!taskId,
    // READY / HELP etc. are processed on the server; the UI does not get a mutation to invalidate.
    // Poll while anyone is still onboarding so status flips to ACTIVE without a full page refresh.
    refetchInterval: (query) => {
      const workers = query.state.data?.workers;
      if (!workers?.length) return false;
      const hasOnboarding = workers.some((w) => w.status === "ONBOARDING");
      return hasOnboarding ? 5000 : false;
    },
    refetchOnWindowFocus: true,
  });
}

export function useAddWorker() {
  const queryClient = useQueryClient();
  return useProtectedMutation<
    { worker: HumanWorker },
    Error,
    {
      taskId: string;
      data: { name: string; platform: string; externalId: string; phone?: string; role?: string };
    }
  >({
    mutationFn: ({ taskId, data }) =>
      authenticatedPost<{ worker: HumanWorker }>(`/api/human-tasks/${taskId}/workers`, data),
    onSuccess: (result, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ["human-tasks", taskId, "workers"] });
      queryClient.invalidateQueries({ queryKey: ["human-tasks"] });
      toast.success(`${result.worker.name} has been added to this task`);
    },
    onError: (e) => toast.error(e.message || "Could not add member"),
  });
}

export function useRemoveWorker() {
  const queryClient = useQueryClient();
  return useProtectedMutation<void, Error, { taskId: string; workerId: string; name: string }>({
    mutationFn: ({ taskId, workerId }) =>
      authenticatedDelete(`/api/human-tasks/${taskId}/workers/${workerId}`),
    onSuccess: (_, { taskId, name }) => {
      queryClient.invalidateQueries({ queryKey: ["human-tasks", taskId, "workers"] });
      queryClient.invalidateQueries({ queryKey: ["human-tasks"] });
      toast.success(`${name} has been removed from this task`);
    },
  });
}

export function useUpdateWorkerStatus() {
  const queryClient = useQueryClient();
  return useProtectedMutation<
    { success: boolean; workerName?: string },
    Error,
    { taskId: string; workerId: string; status: "ACTIVE" | "INACTIVE"; workerName: string }
  >({
    mutationFn: ({ taskId, workerId, status }) =>
      authenticatedPut<{ success: boolean; workerName?: string }>(
        `/api/human-tasks/${taskId}/workers/${workerId}`,
        { status }
      ),
    onSuccess: (result, { taskId, status, workerName }) => {
      queryClient.invalidateQueries({ queryKey: ["human-tasks", taskId, "workers"] });
      queryClient.invalidateQueries({ queryKey: ["human-tasks"] });
      const name = result.workerName || workerName;
      toast.success(
        status === "INACTIVE"
          ? `${name} has been disabled on this task`
          : `${name} has been enabled on this task`
      );
    },
  });
}

export function useTaskSubmissions(
  taskId: string,
  filters?: { workerId?: string; status?: string; date?: string }
) {
  const params = new URLSearchParams();
  if (filters?.workerId) params.set("workerId", filters.workerId);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.date) params.set("date", filters.date);
  const qs = params.toString();

  return useProtectedQuery<{ submissions: TaskSubmission[] }>({
    queryKey: ["human-tasks", taskId, "submissions", filters],
    queryFn: () =>
      authenticatedGet<{ submissions: TaskSubmission[] }>(
        `/api/human-tasks/${taskId}/submissions${qs ? `?${qs}` : ""}`
      ),
    enabled: !!taskId,
    refetchInterval: 30000,
  });
}

export function useTaskReports(taskId: string) {
  return useProtectedQuery<{ reports: TaskComplianceReport[] }>({
    queryKey: ["human-tasks", taskId, "reports"],
    queryFn: () =>
      authenticatedGet<{ reports: TaskComplianceReport[] }>(`/api/human-tasks/${taskId}/reports`),
    enabled: !!taskId,
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useProtectedMutation<{ report: TaskComplianceReport }, Error, { taskId: string }>({
    mutationFn: ({ taskId }) =>
      authenticatedPost<{ report: TaskComplianceReport }>(
        `/api/human-tasks/${taskId}/reports/generate`
      ),
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
  source: "task_channel";
}

export function useChatChannels() {
  return useProtectedQuery<{ channels: ChatChannel[] }>({
    queryKey: ["chat-channels"],
    queryFn: () => authenticatedGet<{ channels: ChatChannel[] }>("/api/task-channels/active"),
  });
}

export function useAiFillTask() {
  return useProtectedMutation<{ fields: Partial<CreateHumanTaskData> }, Error, { prompt: string }>({
    mutationFn: ({ prompt }) =>
      authenticatedPost<{ fields: Partial<CreateHumanTaskData> }>("/api/human-tasks/ai-fill", {
        prompt,
      }),
  });
}
