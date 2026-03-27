"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  useHumanTasks,
  useCreateHumanTask,
  useUpdateHumanTask,
  useDeleteHumanTask,
  usePauseHumanTask,
  useResumeHumanTask,
  useTaskWorkers,
  useAddWorker,
  useRemoveWorker,
  useUpdateWorkerStatus,
  useTaskSubmissions,
  useTaskReports,
  useGenerateReport,
  useDeleteReport,
  useAiFillTask,
  useChatChannels,
  uploadSampleEvidence,
  type HumanTask,
  type TaskSubmission,
  type TaskComplianceReport,
} from "@/hooks/useHumanTasks";
import {
  useTaskChannels,
  useCreateTaskChannel,
  useConnectTelegramTaskChannel,
  useConnectSlackTaskChannel,
  useConnectDiscordTaskChannel,
  useDisconnectTaskChannel,
  useDeleteTaskChannel,
  useUpdateTaskChannel,
  type TaskChannel,
} from "@/hooks/useTaskChannels";
import { type DeliveryConfig, type ReportDestination } from "@/hooks/useAgentGoals";
import { useComposioConnectedAccounts } from "@/hooks/useComposioConnections";
// Pagination: `EntityPagination` from entity-component — same component & styling as Support agents list & Connections.
import {
  EntityContainer,
  EntityHeader,
  EntitySearch,
  EntityPagination,
  LoadingView,
  EmptyView,
} from "@/app/app-components/features/editor/entity-component";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardCheck,
  Trash2,
  Pause,
  Play,
  Users,
  MoreVertical,
  Loader2,
  FileText,
  LayoutGrid,
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  AlertCircle,
  X,
  UserPlus,
  UserMinus,
  Ban,
  PlayCircle,
  Sparkles,
  ChevronDown,
  Pencil,
  Upload,
  FileCheck,
  Cable,
  Plus,
  Copy,
  RefreshCw,
  Unplug,
  Image as ImageIcon,
  ExternalLink,
  Send,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { authenticatedGet, authenticatedPost } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

/** Client-side page size for task lists (matches EntityPagination styling used across the app). */
const TASK_MANAGER_PAGE_SIZE = 10;

function paginateSlice<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    totalPages,
    safePage,
  };
}

const STATUS_VARIANT: Record<string, string> = {
  ACTIVE:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  PAUSED:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  ARCHIVED:
    "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700",
};

const SUBMISSION_STATUS: Record<string, { icon: React.ReactNode; color: string }> = {
  PASSED: { icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-600" },
  FAILED: { icon: <XCircle className="h-4 w-4" />, color: "text-red-600" },
  PENDING: { icon: <Clock className="h-4 w-4" />, color: "text-yellow-600" },
  MISSED: { icon: <MinusCircle className="h-4 w-4" />, color: "text-gray-400" },
  SUBMITTED: { icon: <AlertCircle className="h-4 w-4" />, color: "text-blue-600" },
  VETTING: { icon: <Loader2 className="h-4 w-4 animate-spin" />, color: "text-blue-600" },
  RESUBMITTED: { icon: <AlertCircle className="h-4 w-4" />, color: "text-indigo-600" },
};

const RECURRENCE_LABELS: Record<string, string> = {
  ONCE: "One-time",
  INTERVAL: "Interval",
  DAILY: "Daily",
  WEEKLY: "Weekly",
};

const EVIDENCE_LABELS: Record<string, string> = {
  PHOTO: "Photo",
  TEXT: "Text",
  PHOTO_AND_TEXT: "Photo & Text",
  DOCUMENT: "Document",
};
const CHANNEL_PLATFORM_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  TELEGRAM: "Telegram",
  SLACK: "Slack",
  DISCORD: "Discord",
};

const COMMON_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Africa/Lagos",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function formatTaskTimeForTimezone(timeStr: string, timezone: string): string {
  const [h, m] = String(timeStr)
    .split(":")
    .map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;

  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minute = String(m).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "UTC",
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const tzName = tzParts.find((p) => p.type === "timeZoneName")?.value || "GMT+0";
  return `${hour12}:${minute} ${ampm} ${tzName}`;
}

/** Aligns with backend `validateHumanTaskPayload` (create). */
function isHumanTaskFormValid(
  form: {
    name: string;
    recurrenceType: string;
    recurrenceInterval: number;
    scheduledTimes: string[];
    acceptanceRules: string[];
  },
  reportChannelId: string
): boolean {
  if (!form.name.trim()) return false;
  if (!reportChannelId.trim()) return false;
  if (!form.acceptanceRules.some((r) => String(r).trim())) return false;
  if (form.recurrenceType === "DAILY" || form.recurrenceType === "WEEKLY") {
    if (!form.scheduledTimes.some((t) => String(t).trim())) return false;
  }
  if (form.recurrenceType === "INTERVAL") {
    if (!form.recurrenceInterval || form.recurrenceInterval < 1) return false;
  }
  return true;
}

export function TasksContentClient() {
  const [activeTab, setActiveTab] = useState("tasks");
  const [search, setSearch] = useState("");
  const [tasksPage, setTasksPage] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  /** Bumps after each successful create so TaskFormDialog remounts with empty fields. */
  const [createTaskFormKey, setCreateTaskFormKey] = useState(0);
  const [editingTask, setEditingTask] = useState<HumanTask | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showWorkerDialog, setShowWorkerDialog] = useState(false);
  const [showSubmissionDetail, setShowSubmissionDetail] = useState<TaskSubmission | null>(null);
  const [showReportDetail, setShowReportDetail] = useState<TaskComplianceReport | null>(null);

  const { data: tasksData, isLoading } = useHumanTasks();
  const createTask = useCreateHumanTask();
  const updateTask = useUpdateHumanTask();
  const deleteTask = useDeleteHumanTask();
  const pauseTask = usePauseHumanTask();
  const resumeTask = useResumeHumanTask();

  const tasks = tasksData?.tasks || [];
  const activeTasks = tasks.filter((t) => t.status !== "ARCHIVED");
  const filteredTasks = activeTasks.filter(
    (t) =>
      !search.trim() ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase())
  );

  const {
    pageItems: pagedTasks,
    totalPages: tasksTotalPages,
    safePage: tasksSafePage,
  } = paginateSlice(filteredTasks, tasksPage, TASK_MANAGER_PAGE_SIZE);

  useEffect(() => {
    setTasksPage(1);
  }, [search]);

  useEffect(() => {
    setTasksPage((p) => Math.min(p, tasksTotalPages));
  }, [tasksTotalPages]);

  return (
    <EntityContainer
      header={
        <EntityHeader
          title="Task Manager"
          description="Assign, track, and vet human tasks with AI-powered compliance scoring."
          newButtonLabel="Create Task"
          onNew={() => setShowCreateDialog(true)}
          isCreating={createTask.isPending}
        />
      }
      search={
        !isLoading && activeTasks.length > 0 ? (
          <EntitySearch value={search} onChange={setSearch} placeholder="Search tasks" />
        ) : undefined
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="-mt-4">
        <TabsList>
          <TabsTrigger value="tasks" className="gap-1.5">
            <ClipboardCheck className="h-3.5 w-3.5" /> Tasks
          </TabsTrigger>
          <TabsTrigger value="liveboard" className="gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" /> Live Board
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Reports
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5">
            <Cable className="h-3.5 w-3.5" /> Channels
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "tasks" && (
        <>
          {isLoading ? (
            <LoadingView message="Loading tasks..." />
          ) : activeTasks.length === 0 ? (
            <EmptyView
              message="No tasks yet. Create your first task to start managing human work."
              onNew={() => setShowCreateDialog(true)}
              isCreating={createTask.isPending}
            />
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center py-12 text-muted-foreground">
              <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No tasks match your search.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-y-3">
                {pagedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={() => setEditingTask(task)}
                    onManageWorkers={() => {
                      setSelectedTaskId(task.id);
                      setShowWorkerDialog(true);
                    }}
                    onPause={() => pauseTask.mutate({ taskId: task.id })}
                    onResume={() => resumeTask.mutate({ taskId: task.id })}
                    onDelete={() => deleteTask.mutate({ taskId: task.id })}
                  />
                ))}
              </div>
              <EntityPagination
                currentPage={tasksSafePage}
                totalPages={tasksTotalPages}
                onPageChange={setTasksPage}
              />
            </>
          )}
        </>
      )}

      {activeTab === "liveboard" && (
        <LiveBoardTab tasks={activeTasks} onSubmissionClick={setShowSubmissionDetail} />
      )}

      {activeTab === "reports" && (
        <ReportsTab tasks={activeTasks} onReportClick={setShowReportDetail} />
      )}

      {activeTab === "channels" && <ChannelsTab />}

      <TaskFormDialog
        key={createTaskFormKey}
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={(data) =>
          createTask.mutate(data, {
            onSuccess: () => {
              setCreateTaskFormKey((k) => k + 1);
              setShowCreateDialog(false);
            },
          })
        }
        isPending={createTask.isPending}
        title="Create Task"
      />

      <TaskFormDialog
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSubmit={(data) => {
          if (!editingTask) return;
          updateTask.mutate(
            { taskId: editingTask.id, data },
            { onSuccess: () => setEditingTask(null) }
          );
        }}
        isPending={updateTask.isPending}
        title="Edit Task"
        initialData={editingTask ?? undefined}
      />

      {showWorkerDialog && selectedTaskId && (
        <WorkerDialog
          taskId={selectedTaskId}
          allowedPlatform={tasks.find((t) => t.id === selectedTaskId)?.taskChannel?.platform}
          onClose={() => {
            setShowWorkerDialog(false);
            setSelectedTaskId(null);
          }}
        />
      )}

      <SubmissionDetailDialog
        submission={showSubmissionDetail}
        onClose={() => setShowSubmissionDetail(null)}
      />
      <ReportDetailDialog report={showReportDetail} onClose={() => setShowReportDetail(null)} />
    </EntityContainer>
  );
}

/* ─── Task Card ─── */

function TaskCard({
  task,
  onEdit,
  onManageWorkers,
  onPause,
  onResume,
  onDelete,
}: {
  task: HumanTask;
  onEdit: () => void;
  onManageWorkers: () => void;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="shadow-none hover:shadow transition-shadow">
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4 gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm truncate">{task.name}</span>
              <Badge
                variant="outline"
                className={cn("text-[11px] border", STATUS_VARIANT[task.status])}
              >
                {task.status}
              </Badge>
            </div>
            {task.description && (
              <p className="text-xs text-muted-foreground truncate mt-1">{task.description}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" /> Edit Task
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onManageWorkers}>
                <Users className="h-4 w-4 mr-2" /> Manage Workers
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {task.status === "ACTIVE" && (
                <DropdownMenuItem onClick={onPause}>
                  <Pause className="h-4 w-4 mr-2" /> Pause
                </DropdownMenuItem>
              )}
              {task.status === "PAUSED" && (
                <DropdownMenuItem onClick={onResume}>
                  <Play className="h-4 w-4 mr-2" /> Resume
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {task._count?.workers ?? 0} workers
          </span>
          <span>{task._count?.submissions ?? 0} submissions</span>
          <Badge variant="outline" className="text-[11px] h-5">
            {RECURRENCE_LABELS[task.recurrenceType] || task.recurrenceType}
          </Badge>
          <Badge variant="outline" className="text-[11px] h-5">
            {task.evidenceType === "DOCUMENT" ? (
              <FileText className="h-3 w-3 mr-1" />
            ) : (
              <ImageIcon className="h-3 w-3 mr-1" />
            )}
            {EVIDENCE_LABELS[task.evidenceType] || task.evidenceType}
          </Badge>
          {task.taskChannel?.platform && (
            <Badge variant="outline" className="text-[11px] h-5">
              <PlatformLogo platform={task.taskChannel.platform} className="h-3 w-3 mr-1" />
              {CHANNEL_PLATFORM_LABELS[task.taskChannel.platform] || task.taskChannel.platform}
            </Badge>
          )}
          {task.sampleEvidenceUrl && (
            <Badge
              variant="outline"
              className="text-[11px] h-5 gap-1 text-emerald-600 border-emerald-300"
            >
              <FileCheck className="h-3 w-3" /> Reference
            </Badge>
          )}
          {task.scheduledTimes?.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {(task.scheduledTimes as string[])
                .map((t) => formatTaskTimeForTimezone(t, task.timezone || "UTC"))
                .join(", ")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Task Form Dialog (Create + Edit) ─── */

function TaskFormDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  title,
  initialData,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
  title: string;
  initialData?: HumanTask;
}) {
  const isEdit = !!initialData;

  const [form, setForm] = useState(() => buildForm(initialData));
  const [reportChannelId, setReportChannelId] = useState(
    initialData?.taskChannelId ?? initialData?.reportChannelId ?? ""
  );
  const [reportDocType, setReportDocType] = useState<"googledocs" | "notion">(
    () => (initialData?.deliveryConfig as any)?.reportDocType ?? "googledocs"
  );
  const [reportFolderId, setReportFolderId] = useState(
    () => (initialData?.deliveryConfig as any)?.reportFolderId ?? initialData?.reportFolderId ?? ""
  );
  const [destinations, setDestinations] = useState<ReportDestination[]>(
    () => (initialData?.deliveryConfig as any)?.destinations ?? []
  );
  const { data: channelsData } = useChatChannels();
  const { data: composioData } = useComposioConnectedAccounts();

  const DEST_APP_SLUGS: Record<string, string> = {
    telegram: "telegram",
    slack: "slack",
    discord: "discord",
    gmail: "gmail",
  };
  const DOC_APP_SLUGS: Record<string, string> = {
    googledocs: "googledocs",
    notion: "notion",
  };
  const connectedSlugs = new Set(
    (composioData?.accounts || []).map((a) => a.appSlug.toLowerCase())
  );
  const isAppConnected = (slug: string) => connectedSlugs.has(slug);

  const enabledComposioDestsMissing = destinations
    .filter((d) => d.enabled && DEST_APP_SLUGS[d.type])
    .filter((d) => !isAppConnected(DEST_APP_SLUGS[d.type]));

  const docAppSlug = DOC_APP_SLUGS[reportDocType];
  const docAppConnected = !docAppSlug || isAppConnected(docAppSlug);
  const hasConnectionIssues = enabledComposioDestsMissing.length > 0 || !docAppConnected;
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiFill, setShowAiFill] = useState(false);
  const aiFill = useAiFillTask();
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function buildForm(task?: HumanTask) {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    return {
      name: task?.name ?? "",
      description: task?.description ?? "",
      evidenceType: task?.evidenceType ?? "PHOTO",
      recurrenceType: task?.recurrenceType ?? "DAILY",
      recurrenceInterval: task?.recurrenceInterval ?? 60,
      scheduledTimes: task?.scheduledTimes?.length
        ? [...(task.scheduledTimes as string[])]
        : ["09:00"],
      timezone: task?.timezone ?? browserTimezone,
      acceptanceRules: task?.acceptanceRules?.length
        ? [...(task.acceptanceRules as string[])]
        : [""],
      scoringEnabled: task?.scoringEnabled ?? true,
      passingScore: task?.passingScore ?? 70,
      graceMinutes: task?.graceMinutes ?? 15,
      resubmissionAllowed: task?.resubmissionAllowed ?? true,
      reportTime: task?.reportTime ?? "18:00",
      sampleEvidenceUrl: task?.sampleEvidenceUrl ?? "",
    };
  }

  // Reset form when initialData changes (switching between tasks to edit)
  const [prevInit, setPrevInit] = useState(initialData?.id);
  if (initialData?.id !== prevInit) {
    setPrevInit(initialData?.id);
    setForm(buildForm(initialData));
    setReportChannelId(initialData?.taskChannelId ?? initialData?.reportChannelId ?? "");
    setReportDocType((initialData?.deliveryConfig as any)?.reportDocType ?? "googledocs");
    setReportFolderId(
      (initialData?.deliveryConfig as any)?.reportFolderId ?? initialData?.reportFolderId ?? ""
    );
    setDestinations((initialData?.deliveryConfig as any)?.destinations ?? []);
  }

  const handleAiFill = () => {
    if (!aiPrompt.trim()) return;
    aiFill.mutate(
      { prompt: aiPrompt },
      {
        onSuccess: (data) => {
          const f = data.fields;
          setForm((prev) => ({
            ...prev,
            name: f.name || prev.name,
            description: f.description || prev.description,
            evidenceType: f.evidenceType || prev.evidenceType,
            recurrenceType: f.recurrenceType || prev.recurrenceType,
            recurrenceInterval: f.recurrenceInterval ?? prev.recurrenceInterval,
            scheduledTimes: f.scheduledTimes?.length ? f.scheduledTimes : prev.scheduledTimes,
            timezone: f.timezone || prev.timezone,
            acceptanceRules: f.acceptanceRules?.length ? f.acceptanceRules : prev.acceptanceRules,
            scoringEnabled: f.scoringEnabled ?? prev.scoringEnabled,
            passingScore: f.passingScore ?? prev.passingScore,
            graceMinutes: f.graceMinutes ?? prev.graceMinutes,
            resubmissionAllowed: f.resubmissionAllowed ?? prev.resubmissionAllowed,
            reportTime: f.reportTime || prev.reportTime,
          }));
          setShowAiFill(false);
          setAiPrompt("");
        },
      }
    );
  };

  const addRule = () => setForm({ ...form, acceptanceRules: [...form.acceptanceRules, ""] });
  const removeRule = (idx: number) =>
    setForm({ ...form, acceptanceRules: form.acceptanceRules.filter((_, i) => i !== idx) });
  const updateRule = (idx: number, val: string) => {
    const r = [...form.acceptanceRules];
    r[idx] = val;
    setForm({ ...form, acceptanceRules: r });
  };
  const addTime = () => setForm({ ...form, scheduledTimes: [...form.scheduledTimes, "12:00"] });
  const removeTime = (idx: number) =>
    setForm({ ...form, scheduledTimes: form.scheduledTimes.filter((_, i) => i !== idx) });

  const handleSampleUpload = async (file: File) => {
    setSampleFile(file);
    setUploading(true);
    try {
      const url = await uploadSampleEvidence(file);
      setForm((prev) => ({ ...prev, sampleEvidenceUrl: url }));
    } catch {
      setSampleFile(null);
    }
    setUploading(false);
  };

  const formValid = isHumanTaskFormValid(form, reportChannelId) && !hasConnectionIssues;

  const handleSubmit = () => {
    if (!isHumanTaskFormValid(form, reportChannelId)) return;
    const hasChannel = !!reportChannelId.trim();
    const enabledDests = destinations.filter((d) => d.enabled);
    const deliveryConfig: DeliveryConfig = {
      messagingChannel: hasChannel,
      reportDocType: reportDocType,
      reportFolderId: reportFolderId.trim() || undefined,
      destinations: enabledDests.length > 0 ? enabledDests : undefined,
    };
    onSubmit({
      ...form,
      acceptanceRules: form.acceptanceRules.filter(Boolean),
      reportChannelId: reportChannelId.trim(),
      deliveryConfig,
      reportFolderId: reportFolderId.trim() || undefined,
      sampleEvidenceUrl: form.sampleEvidenceUrl || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isPending) onClose();
      }}
    >
      <DialogContent
        className="max-w-lg w-[calc(100%-2rem)] sm:w-full sm:max-w-lg max-h-[90vh] flex flex-col"
        aria-busy={isPending}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div
          className={cn(
            "space-y-4 mt-2 overflow-y-auto flex-1 pr-1 -mr-1 relative",
            isPending && "pointer-events-none opacity-60"
          )}
        >
          {isPending && (
            <div className="sticky top-0 z-10 -mt-2 mb-2 flex items-center gap-2 rounded-md border bg-muted/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              {isEdit ? "Saving task…" : "Creating task…"}
            </div>
          )}
          {/* AI Auto-Fill */}
          {!isEdit && (
            <div className="rounded-lg border overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAiFill(!showAiFill)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4" /> Create with AI
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", showAiFill && "rotate-180")}
                />
              </button>
              {showAiFill && (
                <div className="px-4 py-3 space-y-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Describe the task and the AI will fill all the fields.
                  </p>
                  <textarea
                    className="w-full px-3 py-2 rounded-md border bg-background text-sm min-h-[120px] resize-y"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder='e.g. "Clean the office bathrooms every 2 hours from 8am to 6pm. Workers submit a photo..."'
                  />
                  <Button
                    size="sm"
                    onClick={handleAiFill}
                    disabled={!aiPrompt.trim() || aiFill.isPending}
                  >
                    {aiFill.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        Generate Task
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Basic Info */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Basic Info
            </h3>
            <div>
              <label className="text-sm font-medium">Name *</label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Must be unique among your active tasks.
              </p>
              <input
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Toilet Cleaning"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Evidence Type</label>
              <select
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={form.evidenceType}
                onChange={(e) => setForm({ ...form, evidenceType: e.target.value })}
              >
                <option value="PHOTO">Photo</option>
                <option value="TEXT">Text</option>
                <option value="PHOTO_AND_TEXT">Photo & Text</option>
                <option value="DOCUMENT">Document / PDF</option>
              </select>
            </div>
          </section>

          <hr />

          {/* Sample / Expected Evidence */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Reference Evidence
            </h3>
            <p className="text-xs text-muted-foreground">
              Upload a sample of what the expected result should look like. The AI will compare
              worker submissions against this reference when scoring.
            </p>
            {form.sampleEvidenceUrl ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                {form.sampleEvidenceUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_API_URL || ""}${form.sampleEvidenceUrl}`}
                    alt="Sample"
                    className="h-16 w-16 rounded-md object-cover border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-md border bg-muted flex items-center justify-center">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {sampleFile?.name || "Reference file"}
                  </p>
                  <p className="text-xs text-muted-foreground">Uploaded successfully</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={() => {
                    setForm({ ...form, sampleEvidenceUrl: "" });
                    setSampleFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Upload className="h-6 w-6" />
                )}
                <span className="text-sm font-medium">
                  {uploading ? "Uploading..." : "Upload reference image or document"}
                </span>
                <span className="text-xs">JPG, PNG, PDF, DOC up to 10MB</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleSampleUpload(f);
                e.target.value = "";
              }}
            />
          </section>

          <hr />

          {/* Schedule */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Schedule
            </h3>
            <div>
              <label className="text-sm font-medium">Recurrence</label>
              <select
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={form.recurrenceType}
                onChange={(e) => setForm({ ...form, recurrenceType: e.target.value })}
              >
                <option value="ONCE">Once</option>
                <option value="INTERVAL">Every X Minutes</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
              </select>
            </div>
            {form.recurrenceType === "INTERVAL" && (
              <div>
                <label className="text-sm font-medium">Interval (minutes) *</label>
                <input
                  type="number"
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                  value={form.recurrenceInterval}
                  onChange={(e) =>
                    setForm({ ...form, recurrenceInterval: parseInt(e.target.value) || 60 })
                  }
                />
              </div>
            )}
            {(form.recurrenceType === "DAILY" || form.recurrenceType === "WEEKLY") && (
              <div>
                <label className="text-sm font-medium">Scheduled Times *</label>
                {form.scheduledTimes.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 mt-1">
                    <input
                      type="time"
                      className="flex-1 px-3 py-2 rounded-md border bg-background text-sm"
                      value={t}
                      onChange={(e) => {
                        const times = [...form.scheduledTimes];
                        times[i] = e.target.value;
                        setForm({ ...form, scheduledTimes: times });
                      }}
                    />
                    {form.scheduledTimes.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeTime(i)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addTime}
                  className="text-xs text-primary mt-1 hover:underline"
                >
                  + Add Time
                </button>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Timezone *</label>
              <p className="text-xs text-muted-foreground mb-1">
                Task reminders and due times run in this timezone.
              </p>
              <select
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              >
                {!COMMON_TIMEZONES.includes(form.timezone) && (
                  <option value={form.timezone}>{form.timezone}</option>
                )}
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <hr />

          {/* Acceptance Rules */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Acceptance Rules *
            </h3>
            <p className="text-xs text-muted-foreground">
              At least one rule is required. Describe what the AI should check in submitted
              evidence.
            </p>
            {form.acceptanceRules.map((rule, i) => (
              <div key={i} className="flex items-start gap-2">
                <textarea
                  className="flex-1 px-3 py-2 rounded-md border bg-background text-sm"
                  value={rule}
                  onChange={(e) => updateRule(i, e.target.value)}
                  rows={2}
                  placeholder={`Rule ${i + 1}: e.g. "Floor must be dry and clean"`}
                />
                {form.acceptanceRules.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 mt-1"
                    onClick={() => removeRule(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addRule}
              className="text-xs text-primary hover:underline"
            >
              + Add Rule
            </button>
          </section>

          <hr />

          {/* Scoring */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Scoring
            </h3>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.scoringEnabled}
                onChange={(e) => setForm({ ...form, scoringEnabled: e.target.checked })}
                className="rounded"
              />
              Enable scoring
            </label>
            {form.scoringEnabled && (
              <div>
                <label className="text-sm font-medium">Passing Score (0-100)</label>
                <input
                  type="number"
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                  value={form.passingScore}
                  min={0}
                  max={100}
                  onChange={(e) =>
                    setForm({ ...form, passingScore: parseInt(e.target.value) || 70 })
                  }
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Grace Period (minutes)</label>
              <input
                type="number"
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={form.graceMinutes}
                onChange={(e) => setForm({ ...form, graceMinutes: parseInt(e.target.value) || 15 })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.resubmissionAllowed}
                onChange={(e) => setForm({ ...form, resubmissionAllowed: e.target.checked })}
                className="rounded"
              />
              Allow resubmission on failure
            </label>
          </section>

          <hr />

          {/* Notification Channel */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Notification Channel
            </h3>
            <div>
              <label className="text-sm font-medium">Select channel *</label>
              <p className="text-xs text-muted-foreground mb-1">
                Used for onboarding, reminders, HELP replies, and daily reports.
              </p>
              <select
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={reportChannelId}
                onChange={(e) => setReportChannelId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select a channel
                </option>
                {(channelsData?.channels || []).map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.source === "task_channel" ? `⬡ ${ch.label}` : ch.label}
                  </option>
                ))}
              </select>
              {(channelsData?.channels || []).length === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  No task channels connected yet. Go to the Channels tab to add one.
                </p>
              )}
            </div>
          </section>

          <hr />

          {/* Report Delivery */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Report Delivery
            </h3>
            <p className="text-xs text-muted-foreground">
              Reports are auto-generated at the set time. A document is created and a summary with
              the link is sent to your destinations.
            </p>
            <div>
              <label className="text-sm font-medium">Report Time</label>
              <p className="text-xs text-muted-foreground mb-1">
                Daily report will auto-generate at this time in the task timezone.
              </p>
              <input
                type="time"
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={form.reportTime}
                onChange={(e) => setForm({ ...form, reportTime: e.target.value })}
              />
            </div>

            {/* Document Type */}
            <div>
              <label className="text-sm font-medium">Report Document</label>
              <p className="text-xs text-muted-foreground mb-1">
                Where the full report document is created. Connect the app via Composio first.
              </p>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setReportDocType("googledocs")}
                  className={cn(
                    "flex-1 px-3 py-2.5 rounded-md border text-sm font-medium transition-colors text-left",
                    reportDocType === "googledocs"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-input bg-background text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="block">Google Docs</span>
                  <span className="block text-[11px] font-normal mt-0.5 opacity-70">
                    Default — stored in Drive folder
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportDocType("notion")}
                  className={cn(
                    "flex-1 px-3 py-2.5 rounded-md border text-sm font-medium transition-colors text-left",
                    reportDocType === "notion"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-input bg-background text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="block">Notion</span>
                  <span className="block text-[11px] font-normal mt-0.5 opacity-70">
                    Creates a Notion page
                  </span>
                </button>
              </div>
              {!docAppConnected && (
                <div className="flex items-center justify-between p-2.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 mt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-amber-700 dark:text-amber-400 text-xs">
                      <span className="font-medium capitalize">
                        {reportDocType === "googledocs" ? "Google Docs" : "Notion"}
                      </span>{" "}
                      is not connected in Composio.
                    </span>
                  </div>
                  <a
                    href="/connections"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
                  >
                    Connect <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {docAppConnected && (
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 mt-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {reportDocType === "googledocs" ? "Google Docs" : "Notion"} connected
                </div>
              )}
            </div>

            {reportDocType === "googledocs" && (
              <div>
                <label className="text-sm font-medium">Google Drive Folder ID</label>
                <p className="text-xs text-muted-foreground mb-1">
                  Optional. If blank, a folder is auto-created for this task.
                </p>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                  value={reportFolderId}
                  onChange={(e) => setReportFolderId(e.target.value)}
                  placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                />
              </div>
            )}

            {/* Destination */}
            <div>
              <label className="text-sm font-medium">Destination</label>
              <p className="text-xs text-muted-foreground mb-2">
                Where to send the report summary and document link. Select one channel per task.
              </p>
              <div className="space-y-2">
                {(
                  [
                    { type: "none" as const, label: "None" },
                    { type: "whatsapp" as const, label: "WhatsApp" },
                    { type: "telegram" as const, label: "Telegram" },
                    { type: "slack" as const, label: "Slack" },
                    { type: "discord" as const, label: "Discord" },
                    { type: "gmail" as const, label: "Gmail" },
                  ] as const
                ).map(({ type, label }) => {
                  const selectedType = destinations.find((d) => d.enabled)?.type ?? "none";
                  const isSelected = type === selectedType;
                  const requiredSlug = DEST_APP_SLUGS[type];
                  const needsComposio = !!requiredSlug;
                  const connected = !needsComposio || isAppConnected(requiredSlug);
                  const dest = destinations.find((d) => d.type === type);

                  const select = () => {
                    if (type === "none") {
                      setDestinations((prev) => prev.map((d) => ({ ...d, enabled: false })));
                    } else {
                      setDestinations((prev) => {
                        const withAllOff = prev.map((d) => ({ ...d, enabled: false }));
                        const existing = withAllOff.find((d) => d.type === type);
                        if (existing) {
                          return withAllOff.map((d) =>
                            d.type === type ? { ...d, enabled: true } : d
                          );
                        }
                        return [...withAllOff, { type, enabled: true }];
                      });
                    }
                  };

                  return (
                    <div key={type}>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="reportDestination"
                          checked={isSelected}
                          onChange={select}
                          className="border-input"
                        />
                        <span className="flex items-center gap-1.5">
                          {label}
                          {isSelected && connected && needsComposio && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          )}
                        </span>
                        {type === "whatsapp" && isSelected && (
                          <span className="text-[11px] text-muted-foreground">
                            (enter number below)
                          </span>
                        )}
                        {type === "gmail" && isSelected && (
                          <span className="text-[11px] text-muted-foreground">
                            (enter email below)
                          </span>
                        )}
                      </label>
                      {isSelected && !connected && type !== "none" && (
                        <div className="flex items-center justify-between ml-6 mt-1 p-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                          <div className="flex items-center gap-1.5 text-xs">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <span className="text-amber-700 dark:text-amber-400">
                              {label} is not connected in Composio
                            </span>
                          </div>
                          <a
                            href="/connections"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0 ml-2"
                          >
                            Connect <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                      {type === "whatsapp" && isSelected && (
                        <div className="mt-1.5 ml-6">
                          <input
                            className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                            value={dest?.whatsappNumber ?? ""}
                            onChange={(e) =>
                              setDestinations((prev) =>
                                prev.map((d) =>
                                  d.type === "whatsapp"
                                    ? { ...d, whatsappNumber: e.target.value }
                                    : d
                                )
                              )
                            }
                            placeholder="e.g. +2348012345678"
                          />
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Your WhatsApp number with country code. Uses the connected task channel
                            session.
                          </p>
                        </div>
                      )}
                      {type === "gmail" && isSelected && (
                        <div className="mt-1.5 ml-6">
                          <input
                            type="email"
                            className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                            value={dest?.gmailTo ?? ""}
                            onChange={(e) =>
                              setDestinations((prev) =>
                                prev.map((d) =>
                                  d.type === "gmail" ? { ...d, gmailTo: e.target.value } : d
                                )
                              )
                            }
                            placeholder="e.g. admin@company.com"
                          />
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Email address to receive the report summary and document link.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-3 pb-1">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formValid || isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {isEdit ? "Saving..." : "Creating..."}
                </>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Create Task"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Worker Dialog ─── */

function WorkerDialog({
  taskId,
  allowedPlatform,
  onClose,
}: {
  taskId: string;
  allowedPlatform?: string | null;
  onClose: () => void;
}) {
  const { data: workersData, isLoading } = useTaskWorkers(taskId);
  const addWorker = useAddWorker();
  const removeWorker = useRemoveWorker();
  const updateWorkerStatus = useUpdateWorkerStatus();
  const [showAdd, setShowAdd] = useState(false);
  const [membersPage, setMembersPage] = useState(1);
  const [form, setForm] = useState({
    name: "",
    platform: (allowedPlatform || "WHATSAPP").toUpperCase(),
    externalId: "",
    phone: "",
    role: "",
  });

  const workers = workersData?.workers || [];
  const selectedPlatform = (allowedPlatform || "").toUpperCase();
  const platformOptions = selectedPlatform
    ? [selectedPlatform]
    : ["WHATSAPP", "TELEGRAM", "SLACK", "DISCORD"];

  useEffect(() => {
    if (selectedPlatform) {
      setForm((prev) => ({
        ...prev,
        platform: selectedPlatform,
      }));
    }
  }, [selectedPlatform]);

  const {
    pageItems: pagedWorkers,
    totalPages: membersTotalPages,
    safePage: membersSafePage,
  } = paginateSlice(workers, membersPage, TASK_MANAGER_PAGE_SIZE);

  useEffect(() => {
    setMembersPage(1);
  }, [taskId]);

  useEffect(() => {
    setMembersPage((p) => Math.min(p, membersTotalPages));
  }, [membersTotalPages]);

  const platformLabels: Record<string, string> = {
    WHATSAPP: "WhatsApp",
    TELEGRAM: "Telegram",
    SLACK: "Slack",
    DISCORD: "Discord",
  };
  const externalIdLabels: Record<string, string> = {
    WHATSAPP: "Phone number (e.g. +1234567890)",
    TELEGRAM: "Telegram user/chat ID",
    SLACK: "Slack User ID (e.g. U012AB3CD)",
    DISCORD: "Discord User ID",
  };

  const workerMutationBusy = removeWorker.isPending || updateWorkerStatus.isPending;

  const validateAndBuildWorkerPayload = () => {
    const name = form.name.trim();
    const platform = form.platform;
    const externalId = form.externalId.trim();
    const role = form.role.trim();
    const phone = form.phone.trim();

    if (!name) {
      toast.error("Member name is required.");
      return null;
    }
    if (!externalId) {
      toast.error("ID/phone is required.");
      return null;
    }
    if (/\s/.test(externalId)) {
      toast.error("ID/phone cannot contain spaces.");
      return null;
    }
    if (phone && /\s/.test(phone)) {
      toast.error("Phone number cannot contain spaces.");
      return null;
    }

    if (platform === "WHATSAPP") {
      const waJid = externalId.replace(/:.*@/, "@");
      const isWaJid = /^\d{7,20}@(s\.whatsapp\.net|lid)$/.test(waJid);
      const waDigits = externalId.replace(/\D/g, "");
      if (!isWaJid && (waDigits.length < 7 || waDigits.length > 20)) {
        toast.error("WhatsApp number must be 7-20 digits or a valid JID.");
        return null;
      }
    } else if (platform === "TELEGRAM") {
      if (!/^-?\d{4,20}$/.test(externalId)) {
        toast.error("Telegram chat/user ID must be numeric.");
        return null;
      }
    } else if (platform === "DISCORD") {
      if (!/^\d{6,30}$/.test(externalId)) {
        toast.error("Discord user ID must be numeric.");
        return null;
      }
    }

    return {
      name,
      platform,
      externalId,
      phone: phone || undefined,
      role: role || undefined,
    };
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !addWorker.isPending && !workerMutationBusy) onClose();
      }}
    >
      <DialogContent
        className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md h-auto max-h-[85vh] flex flex-col"
        aria-busy={addWorker.isPending || workerMutationBusy}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Team Members
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto flex-1 min-h-0 relative">
          {/* Worker List */}
          {isLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : workers.length === 0 && !showAdd ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No team members assigned yet.</p>
              <p className="text-xs mt-1">Add workers who will carry out this task.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pagedWorkers.map((w) => {
                const rowUpdating =
                  (updateWorkerStatus.isPending &&
                    updateWorkerStatus.variables?.workerId === w.id) ||
                  (removeWorker.isPending && removeWorker.variables?.workerId === w.id);
                return (
                  <div
                    key={w.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border bg-card gap-2",
                      w.status === "INACTIVE" && "opacity-80"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{w.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[11px] h-5">
                          {platformLabels[w.platform] || w.platform}
                        </Badge>
                        {w.role && (
                          <span className="text-[11px] text-muted-foreground">{w.role}</span>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[11px] h-5 border",
                            w.status === "ACTIVE" && "text-emerald-700 border-emerald-300",
                            w.status === "INACTIVE" &&
                              "text-amber-800 border-amber-300 bg-amber-50/80 dark:bg-amber-950/30",
                            w.status === "ONBOARDING" && "text-zinc-500 border-zinc-300"
                          )}
                        >
                          {w.status === "INACTIVE" ? "Disabled" : w.status}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-8 w-8"
                          disabled={workerMutationBusy}
                          aria-busy={rowUpdating}
                        >
                          {rowUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreVertical className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {w.status !== "INACTIVE" ? (
                          <DropdownMenuItem
                            onClick={() =>
                              updateWorkerStatus.mutate({
                                taskId,
                                workerId: w.id,
                                status: "INACTIVE",
                                workerName: w.name,
                              })
                            }
                            disabled={workerMutationBusy}
                          >
                            {updateWorkerStatus.isPending &&
                            updateWorkerStatus.variables?.workerId === w.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Ban className="h-4 w-4 mr-2" />
                            )}
                            Disable member
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              updateWorkerStatus.mutate({
                                taskId,
                                workerId: w.id,
                                status: "ACTIVE",
                                workerName: w.name,
                              })
                            }
                            disabled={workerMutationBusy}
                          >
                            {updateWorkerStatus.isPending &&
                            updateWorkerStatus.variables?.workerId === w.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <PlayCircle className="h-4 w-4 mr-2" />
                            )}
                            Enable member
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() =>
                            removeWorker.mutate({ taskId, workerId: w.id, name: w.name })
                          }
                          disabled={workerMutationBusy}
                        >
                          {removeWorker.isPending && removeWorker.variables?.workerId === w.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <UserMinus className="h-4 w-4 mr-2" />
                          )}
                          Remove from task
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
              <EntityPagination
                currentPage={membersSafePage}
                totalPages={membersTotalPages}
                onPageChange={setMembersPage}
              />
            </div>
          )}

          {/* Add Worker Form */}
          {showAdd ? (
            <div
              className={cn(
                "space-y-3 border-t pt-4 relative",
                addWorker.isPending && "pointer-events-none opacity-70"
              )}
            >
              <h4 className="text-sm font-medium">Add New Member</h4>
              {addWorker.isPending && (
                <div className="flex items-center gap-2 rounded-md border bg-muted/80 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  Adding member and sending onboarding…
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Name *</label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="John Doe"
                  disabled={addWorker.isPending}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Platform</label>
                <select
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                  disabled={addWorker.isPending || !!selectedPlatform}
                >
                  {platformOptions.map((platform) => (
                    <option key={platform} value={platform}>
                      {platformLabels[platform] || platform}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {externalIdLabels[form.platform] || "External ID"} *
                </label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                  value={form.externalId}
                  onChange={(e) => setForm({ ...form, externalId: e.target.value })}
                  disabled={addWorker.isPending}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Role (optional)</label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="e.g. Cleaner"
                  disabled={addWorker.isPending}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdd(false)}
                  className="flex-1"
                  disabled={addWorker.isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const payload = validateAndBuildWorkerPayload();
                    if (!payload) return;
                    addWorker.mutate(
                      { taskId, data: payload },
                      {
                        onSuccess: () => {
                          setShowAdd(false);
                          setForm({
                            name: "",
                            platform: selectedPlatform || "WHATSAPP",
                            externalId: "",
                            phone: "",
                            role: "",
                          });
                        },
                      }
                    );
                  }}
                  disabled={!form.name.trim() || !form.externalId.trim() || addWorker.isPending}
                >
                  {addWorker.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                      Adding…
                    </>
                  ) : (
                    "Add Member"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowAdd(true)}
              className="w-full gap-2"
              disabled={addWorker.isPending}
            >
              {addWorker.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Add Team Member
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Live Board ─── */

type DatePreset = "today" | "7d" | "30d" | "custom";

function getDateRange(preset: DatePreset, customFrom: string, customTo: string) {
  const today = new Date().toISOString().split("T")[0];
  if (preset === "today") return { dateFrom: today, dateTo: today };
  if (preset === "7d") {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return { dateFrom: d.toISOString().split("T")[0], dateTo: today };
  }
  if (preset === "30d") {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return { dateFrom: d.toISOString().split("T")[0], dateTo: today };
  }
  return { dateFrom: customFrom || today, dateTo: customTo || today };
}

function LiveBoardTab({
  tasks,
  onSubmissionClick,
}: {
  tasks: HumanTask[];
  onSubmissionClick: (s: TaskSubmission) => void;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id || "");
  const [liveBoardPage, setLiveBoardPage] = useState(1);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const today = new Date().toISOString().split("T")[0];
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [filterWorkerId, setFilterWorkerId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const { dateFrom, dateTo } = getDateRange(datePreset, customFrom, customTo);

  const { data: submissionsData, isLoading } = useTaskSubmissions(selectedTaskId, {
    dateFrom,
    dateTo,
    ...(filterWorkerId ? { workerId: filterWorkerId } : {}),
    ...(filterStatus ? { status: filterStatus } : {}),
  });
  const { data: workersData } = useTaskWorkers(selectedTaskId);

  const submissions = submissionsData?.submissions || [];
  const workers = workersData?.workers || [];
  const activeWorkers = workers.filter((w) => w.status !== "INACTIVE");
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  const filteredSubmissions = submissions;

  const stats = {
    total: filteredSubmissions.length,
    passed: filteredSubmissions.filter((s) => s.status === "PASSED").length,
    failed: filteredSubmissions.filter((s) => s.status === "FAILED").length,
    missed: filteredSubmissions.filter((s) => s.status === "MISSED").length,
    pending: filteredSubmissions.filter((s) => s.status === "PENDING").length,
    submitted: filteredSubmissions.filter((s) => s.status === "SUBMITTED" || s.status === "VETTING")
      .length,
    avgScore: (() => {
      const scored = filteredSubmissions.filter((s) => s.aiScore != null);
      if (!scored.length) return null;
      return Math.round(scored.reduce((sum, s) => sum + (s.aiScore ?? 0), 0) / scored.length);
    })(),
    passRate: (() => {
      const vetted = filteredSubmissions.filter(
        (s) => s.status === "PASSED" || s.status === "FAILED"
      );
      if (!vetted.length) return null;
      return Math.round((vetted.filter((s) => s.status === "PASSED").length / vetted.length) * 100);
    })(),
  };

  const {
    pageItems: pagedSubmissions,
    totalPages: liveTotalPages,
    safePage: liveSafePage,
  } = paginateSlice(filteredSubmissions, liveBoardPage, TASK_MANAGER_PAGE_SIZE);

  useEffect(() => {
    setLiveBoardPage(1);
  }, [selectedTaskId, datePreset, customFrom, customTo, filterWorkerId, filterStatus]);

  useEffect(() => {
    setLiveBoardPage((p) => Math.min(p, liveTotalPages));
  }, [liveTotalPages]);

  if (tasks.length === 0)
    return <EmptyView message="No active tasks to display on the live board." />;

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Task</label>
          <select
            className="px-3 py-2 rounded-md border bg-background text-sm min-w-[180px]"
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
          >
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Period</label>
          <select
            className="px-3 py-2 rounded-md border bg-background text-sm"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom range</option>
          </select>
        </div>

        {datePreset === "custom" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <input
                type="date"
                className="px-3 py-2 rounded-md border bg-background text-sm"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <input
                type="date"
                className="px-3 py-2 rounded-md border bg-background text-sm"
                value={customTo}
                min={customFrom}
                max={today}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Worker</label>
          <select
            className="px-3 py-2 rounded-md border bg-background text-sm"
            value={filterWorkerId}
            onChange={(e) => setFilterWorkerId(e.target.value)}
          >
            <option value="">All workers</option>
            {activeWorkers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select
            className="px-3 py-2 rounded-md border bg-background text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
            <option value="MISSED">Missed</option>
            <option value="PENDING">Pending</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="VETTING">Vetting</option>
            <option value="RESUBMITTED">Resubmitted</option>
          </select>
        </div>
      </div>

      {/* Summary stats */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <div className="p-3 rounded-lg border bg-background text-center">
            <p className="text-xl font-bold">{stats.total}</p>
            <p className="text-[11px] text-muted-foreground">Total</p>
          </div>
          <div className="p-3 rounded-lg border bg-background text-center">
            <p className="text-xl font-bold text-green-600">{stats.passed}</p>
            <p className="text-[11px] text-muted-foreground">Passed</p>
          </div>
          <div className="p-3 rounded-lg border bg-background text-center">
            <p className="text-xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-[11px] text-muted-foreground">Failed</p>
          </div>
          <div className="p-3 rounded-lg border bg-background text-center">
            <p className="text-xl font-bold text-gray-400">{stats.missed}</p>
            <p className="text-[11px] text-muted-foreground">Missed</p>
          </div>
          <div className="p-3 rounded-lg border bg-background text-center">
            <p className="text-xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-[11px] text-muted-foreground">Pending</p>
          </div>
          <div className="p-3 rounded-lg border bg-background text-center">
            <p className="text-xl font-bold text-blue-600">{stats.submitted}</p>
            <p className="text-[11px] text-muted-foreground">In Review</p>
          </div>
          <div className="p-3 rounded-lg border bg-background text-center">
            <p className="text-xl font-bold">{stats.avgScore ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground">Avg Score</p>
          </div>
          <div className="p-3 rounded-lg border bg-background text-center">
            <p className="text-xl font-bold">
              {stats.passRate != null ? `${stats.passRate}%` : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">Pass Rate</p>
          </div>
        </div>
      )}

      {/* Task info bar */}
      {selectedTask && !isLoading && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground px-1">
          <span>
            <strong className="text-foreground">{selectedTask.name}</strong>
          </span>
          <span>
            Evidence: {EVIDENCE_LABELS[selectedTask.evidenceType] || selectedTask.evidenceType}
          </span>
          <span>Passing: {selectedTask.passingScore}/100</span>
          <span>Grace: {selectedTask.graceMinutes}m</span>
          <span>Workers: {activeWorkers.length}</span>
          {selectedTask.resubmissionAllowed && (
            <Badge variant="secondary" className="text-[10px] py-0">
              Resubmission allowed
            </Badge>
          )}
        </div>
      )}

      {/* Submissions table */}
      {isLoading ? (
        <LoadingView message="Loading submissions..." />
      ) : filteredSubmissions.length === 0 ? (
        <EmptyView message="No submissions found for the selected filters." />
      ) : (
        <>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Worker</th>
                  <th className="text-left p-3 font-medium">Due</th>
                  <th className="text-left p-3 font-medium">Submitted</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-center p-3 font-medium">Score</th>
                  <th className="text-center p-3 font-medium">Evidence</th>
                  <th className="text-left p-3 font-medium">Lateness</th>
                </tr>
              </thead>
              <tbody>
                {pagedSubmissions.map((sub) => {
                  const statusInfo = SUBMISSION_STATUS[sub.status] || SUBMISSION_STATUS.PENDING;
                  const scoreColor =
                    sub.aiScore != null
                      ? sub.aiScore >= (selectedTask?.passingScore ?? 70)
                        ? "text-green-600"
                        : "text-red-600"
                      : "text-muted-foreground";
                  const latenessLabel =
                    sub.latenessSeconds != null
                      ? sub.latenessSeconds > 0
                        ? `${Math.round(sub.latenessSeconds / 60)}m late`
                        : `${Math.abs(Math.round(sub.latenessSeconds / 60))}m early`
                      : null;
                  const dueDate = new Date(sub.dueAt);
                  const submittedDate = sub.submittedAt ? new Date(sub.submittedAt) : null;

                  return (
                    <tr
                      key={sub.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => onSubmissionClick(sub)}
                    >
                      <td className="p-3">
                        <div className="font-medium">{sub.worker?.name || "Unknown"}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {sub.worker?.platform}
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div>
                          {dueDate.toLocaleDateString([], { month: "short", day: "numeric" })}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {dueDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {submittedDate ? (
                          <>
                            <div>
                              {submittedDate.toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {submittedDate.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[11px] gap-1 py-0.5",
                            sub.status === "PASSED" &&
                              "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
                            sub.status === "FAILED" &&
                              "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
                            sub.status === "MISSED" &&
                              "bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400",
                            sub.status === "PENDING" &&
                              "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
                            (sub.status === "SUBMITTED" || sub.status === "VETTING") &&
                              "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
                            sub.status === "RESUBMITTED" &&
                              "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                          )}
                        >
                          {statusInfo.icon}
                          {sub.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <span className={cn("font-semibold", scoreColor)}>
                          {sub.aiScore != null ? sub.aiScore : "—"}
                        </span>
                        {sub.aiScore != null && (
                          <span className="text-[11px] text-muted-foreground">/100</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {sub.imageUrl ? (
                          <div className="inline-flex items-center justify-center">
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_URL || ""}${sub.imageUrl}`}
                              alt=""
                              className="h-8 w-8 rounded object-cover border"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(
                                  `${process.env.NEXT_PUBLIC_API_URL || ""}${sub.imageUrl}`,
                                  "_blank"
                                );
                              }}
                            />
                          </div>
                        ) : sub.rawMessage ? (
                          <span className="text-muted-foreground text-xs" title={sub.rawMessage}>
                            <FileText className="h-4 w-4 inline" />
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {latenessLabel ? (
                          <span
                            className={cn(
                              "text-xs",
                              sub.latenessSeconds != null && sub.latenessSeconds > 0
                                ? "text-amber-600"
                                : "text-green-600"
                            )}
                          >
                            {latenessLabel}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {pagedSubmissions.length} of {filteredSubmissions.length} submissions
            </p>
            <EntityPagination
              currentPage={liveSafePage}
              totalPages={liveTotalPages}
              onPageChange={setLiveBoardPage}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Reports ─── */

function ReportsTab({
  tasks,
  onReportClick,
}: {
  tasks: HumanTask[];
  onReportClick: (r: TaskComplianceReport) => void;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id || "");
  const [reportsPage, setReportsPage] = useState(1);
  const { data: reportsData, isLoading } = useTaskReports(selectedTaskId);
  const generateReport = useGenerateReport();
  const deleteReport = useDeleteReport();
  const reports = reportsData?.reports || [];
  const {
    pageItems: pagedReports,
    totalPages: reportsTotalPages,
    safePage: reportsSafePage,
  } = paginateSlice(reports, reportsPage, TASK_MANAGER_PAGE_SIZE);

  useEffect(() => {
    setReportsPage(1);
  }, [selectedTaskId]);

  useEffect(() => {
    setReportsPage((p) => Math.min(p, reportsTotalPages));
  }, [reportsTotalPages]);

  if (tasks.length === 0) return <EmptyView message="No tasks available to generate reports." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          className="px-3 py-2 rounded-md border bg-background text-sm"
          value={selectedTaskId}
          onChange={(e) => setSelectedTaskId(e.target.value)}
        >
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateReport.mutate({ taskId: selectedTaskId })}
          disabled={generateReport.isPending}
        >
          {generateReport.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}{" "}
          Generate Now
        </Button>
      </div>

      {isLoading ? (
        <LoadingView message="Loading reports..." />
      ) : reports.length === 0 ? (
        <EmptyView message="No reports generated yet. Click Generate Now to create one." />
      ) : (
        <>
          <div className="flex flex-col gap-y-3">
            {pagedReports.map((report) => (
              <Card key={report.id} className="shadow-none hover:shadow transition-shadow">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1 cursor-pointer" onClick={() => onReportClick(report)}>
                    <p className="font-medium text-sm">
                      {new Date(report.periodStart).toLocaleDateString()}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{report.totalSubmissions} submissions</span>
                      <span>{report.missedCount} missed</span>
                      <span>Avg: {report.avgScore ?? "N/A"}</span>
                      <span>Pass: {report.passRate != null ? `${report.passRate}%` : "N/A"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {report.deliveredAt ? (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300 shrink-0"
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Sent{" "}
                        {new Date(report.deliveredAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400 shrink-0"
                      >
                        Not sent
                      </Badge>
                    )}
                    {report.documentUrl && (
                      <a
                        href={report.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 hover:text-blue-700 shrink-0"
                        title="View Google Doc"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onReportClick(report);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" /> View Details
                        </DropdownMenuItem>
                        {report.documentUrl && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(report.documentUrl!, "_blank");
                            }}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" /> Open Google Doc
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this report?")) {
                              deleteReport.mutate({
                                taskId: selectedTaskId,
                                reportId: report.id,
                              });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <EntityPagination
            currentPage={reportsSafePage}
            totalPages={reportsTotalPages}
            onPageChange={setReportsPage}
          />
        </>
      )}
    </div>
  );
}

/* ─── Submission Detail ─── */

function SubmissionDetailDialog({
  submission,
  onClose,
}: {
  submission: TaskSubmission | null;
  onClose: () => void;
}) {
  if (!submission) return null;
  const dueTime = new Date(submission.dueAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const submittedTime = submission.submittedAt
    ? new Date(submission.submittedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const latenessLabel =
    submission.latenessSeconds != null
      ? submission.latenessSeconds > 0
        ? `${Math.round(submission.latenessSeconds / 60)} min late`
        : `${Math.abs(Math.round(submission.latenessSeconds / 60))} min early`
      : null;
  let findings: string[] = [];
  try {
    findings = JSON.parse(submission.aiFindings || "[]");
  } catch {
    findings = submission.aiFindings ? [submission.aiFindings] : [];
  }
  const scoreColor = (submission.aiScore ?? 0) >= 70 ? "text-green-600" : "text-red-600";

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] sm:w-full sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Submission Detail</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1">
          {submission.imageUrl && (
            <div className="rounded-lg overflow-hidden border">
              <img
                src={`${process.env.NEXT_PUBLIC_API_URL || ""}${submission.imageUrl}`}
                alt="Submission"
                className="w-full max-h-64 object-contain bg-muted"
              />
            </div>
          )}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due:</span>
              <span>{dueTime}</span>
            </div>
            {submittedTime && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submitted:</span>
                <span>
                  {submittedTime}{" "}
                  {latenessLabel && (
                    <span className="text-xs text-muted-foreground">({latenessLabel})</span>
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Score:</span>
              <span className={cn("text-2xl font-bold", scoreColor)}>
                {submission.aiScore ?? "-"}
                <span className="text-sm font-normal">/100</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status:</span>
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs",
                  submission.status === "PASSED"
                    ? "bg-green-100 text-green-700"
                    : submission.status === "FAILED"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                )}
              >
                {submission.status}
              </Badge>
            </div>
            {submission.worker && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Worker:</span>
                <span>
                  {submission.worker.name}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({submission.worker.platform})
                  </span>
                </span>
              </div>
            )}
          </div>
          {findings.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">AI Findings</h3>
              <ul className="space-y-1 text-sm">
                {findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground shrink-0">-</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {submission.rawMessage && (
            <div>
              <h3 className="text-sm font-medium mb-1">Worker Message</h3>
              <p className="text-sm text-muted-foreground">{submission.rawMessage}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Report Detail ─── */

function ReportDetailDialog({
  report,
  onClose,
}: {
  report: TaskComplianceReport | null;
  onClose: () => void;
}) {
  if (!report) return null;

  const deliveredTo = report.deliveredTo as Record<string, any> | null;
  const deliveryChannels: string[] = [];
  if (deliveredTo?.messagingChannel) {
    deliveryChannels.push(deliveredTo.messagingChannel.platform || "Chat Channel");
  }
  if (deliveredTo?.document) {
    const docType = (deliveredTo.document as any)?.type;
    deliveryChannels.push(docType === "notion" ? "Notion" : "Google Docs");
  }
  if (deliveredTo?.whatsapp) deliveryChannels.push("WhatsApp");
  if (deliveredTo?.destinations) {
    const dests = deliveredTo.destinations as any[];
    for (const d of dests) {
      if (d.delivered) deliveryChannels.push(d.label || d.action);
    }
  }
  // Legacy support
  if (deliveredTo?.googleDoc && !deliveredTo?.document) deliveryChannels.push("Google Docs");
  if (deliveredTo?.composioActions) {
    const actions = deliveredTo.composioActions as any[];
    for (const a of actions) {
      if (a.delivered) deliveryChannels.push(a.label || a.action);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Daily Report — {new Date(report.periodStart).toLocaleDateString()}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-2xl font-bold">{report.totalSubmissions}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-2xl font-bold text-red-600">{report.missedCount}</p>
              <p className="text-xs text-muted-foreground">Missed</p>
            </div>
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-2xl font-bold">{report.avgScore ?? "-"}</p>
              <p className="text-xs text-muted-foreground">Avg Score</p>
            </div>
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-2xl font-bold">
                {report.passRate != null ? `${report.passRate}%` : "-"}
              </p>
              <p className="text-xs text-muted-foreground">Pass Rate</p>
            </div>
          </div>

          {/* Delivery Status */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {report.deliveredAt ? (
              <>
                <Badge
                  variant="secondary"
                  className="text-xs bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                >
                  <Send className="h-3 w-3 mr-1" />
                  Delivered at{" "}
                  {new Date(report.deliveredAt).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Badge>
                {deliveryChannels.map((ch) => (
                  <Badge key={ch} variant="outline" className="text-xs">
                    {ch}
                  </Badge>
                ))}
              </>
            ) : (
              <Badge
                variant="secondary"
                className="text-xs bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400"
              >
                Not delivered
              </Badge>
            )}
          </div>

          {/* Google Doc Link */}
          {report.documentUrl && (
            <a
              href={report.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-950/50 transition-colors text-sm"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              <span>View Full Report in Google Docs</span>
            </a>
          )}

          {/* Report Content */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{report.summaryMarkdown}</ReactMarkdown>
          </div>

          {/* Flagged Workers */}
          {report.flaggedWorkerIds.length > 0 && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                Flagged Workers: {report.flaggedWorkerIds.length}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Channels Tab ─── */

const PLATFORM_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  TELEGRAM: {
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
  },
  WHATSAPP: {
    color: "text-green-700 dark:text-green-300",
    bg: "bg-green-50 dark:bg-green-950/40",
    border: "border-green-200 dark:border-green-800",
  },
  SLACK: {
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-200 dark:border-purple-800",
  },
  DISCORD: {
    color: "text-indigo-700 dark:text-indigo-300",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    border: "border-indigo-200 dark:border-indigo-800",
  },
};

const PLATFORM_LOGOS: Record<string, string> = {
  TELEGRAM: "/logo/telegram.svg",
  WHATSAPP: "/logo/whatsapp.svg",
  SLACK: "/logo/slack.svg",
  DISCORD: "/logo/discord.svg",
};

const CHANNEL_STATUS_STYLES: Record<string, string> = {
  connected:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  pending:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  disabled:
    "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700",
};

type ConnectPlatform = "TELEGRAM" | "WHATSAPP" | "SLACK" | "DISCORD";

function PlatformLogo({
  platform,
  className = "h-4 w-4",
}: {
  platform: string;
  className?: string;
}) {
  const src = PLATFORM_LOGOS[platform] || PLATFORM_LOGOS.TELEGRAM;
  const size = className.includes("h-5") || className.includes("w-5") ? 20 : 16;
  return (
    <Image
      src={src}
      alt={`${platform.toLowerCase()} logo`}
      width={size}
      height={size}
      className={cn(className, "rounded-sm")}
    />
  );
}

function ChannelsTab() {
  const { data, isLoading } = useTaskChannels();
  const createChannel = useCreateTaskChannel();
  const deleteChannel = useDeleteTaskChannel();
  const updateChannel = useUpdateTaskChannel();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingChannel, setEditingChannel] = useState<TaskChannel | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [channelsPage, setChannelsPage] = useState(1);

  const channels = data?.channels || [];
  const {
    pageItems: pagedChannels,
    totalPages: channelsTotalPages,
    safePage: channelsSafePage,
  } = paginateSlice(channels, channelsPage, TASK_MANAGER_PAGE_SIZE);

  useEffect(() => {
    setChannelsPage((p) => Math.min(p, channelsTotalPages));
  }, [channelsTotalPages]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage the messaging channels used for task management.
        </p>
        <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Channel
        </Button>
      </div>

      {isLoading ? (
        <LoadingView message="Loading channels..." />
      ) : channels.length === 0 ? (
        <EmptyView message="No channels connected yet. Add one to start managing tasks via messaging." />
      ) : (
        <>
          <div className="flex flex-col gap-y-3">
            {pagedChannels.map((ch) => {
              const ps = PLATFORM_STYLES[ch.platform] || PLATFORM_STYLES.TELEGRAM;
              const statusKey =
                ch.status === "connected"
                  ? "connected"
                  : ch.status === "pending"
                    ? "pending"
                    : "disabled";
              return (
                <Card key={ch.id} className="shadow-none hover:shadow transition-shadow">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn("text-[11px] border", ps.bg, ps.color, ps.border)}
                          >
                            <PlatformLogo platform={ch.platform} className="h-3.5 w-3.5 mr-1.5" />
                            {ch.platform}
                          </Badge>
                          <span className="font-medium text-sm truncate">{ch.label}</span>
                          <Badge
                            variant="outline"
                            className={cn("text-[11px] border", CHANNEL_STATUS_STYLES[statusKey])}
                          >
                            {ch.status}
                          </Badge>
                        </div>
                      </div>
                      {confirmDelete === ch.id ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={() => {
                              deleteChannel.mutate(ch.id);
                              setConfirmDelete(null);
                            }}
                            disabled={deleteChannel.isPending}
                          >
                            {deleteChannel.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Confirm"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setConfirmDelete(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingChannel(ch)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit channel
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setConfirmDelete(ch.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete channel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <div className="border-t border-dashed border-border px-4 pb-3 pt-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {ch.telegramBotUsername && <span>@{ch.telegramBotUsername}</span>}
                        {ch.whatsappSessionId && <span>Session: {ch.whatsappSessionId}</span>}
                        {ch.webhookUrl && (
                          <span className="truncate max-w-[200px]">Webhook configured</span>
                        )}
                        <span>Added {new Date(ch.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <EntityPagination
            currentPage={channelsSafePage}
            totalPages={channelsTotalPages}
            onPageChange={setChannelsPage}
          />
        </>
      )}

      <AddChannelDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onCreate={createChannel}
      />

      <EditChannelDialog
        channel={editingChannel}
        open={!!editingChannel}
        onClose={() => setEditingChannel(null)}
        onUpdate={updateChannel}
      />
    </div>
  );
}

/* ─── Add Channel Dialog ─── */

function AddChannelDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: ReturnType<typeof useCreateTaskChannel>;
}) {
  const [platform, setPlatform] = useState<ConnectPlatform>("TELEGRAM");
  const [label, setLabel] = useState("");
  const [step, setStep] = useState<"pick" | "connect">("pick");
  const [createdChannel, setCreatedChannel] = useState<TaskChannel | null>(null);

  const reset = () => {
    setPlatform("TELEGRAM");
    setLabel("");
    setStep("pick");
    setCreatedChannel(null);
  };

  const handleCreate = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      toast.error("Enter a channel label (must be unique).");
      return;
    }
    try {
      const result = await onCreate.mutateAsync({ platform, label: trimmed });
      setCreatedChannel(result.channel);
      setStep("connect");
    } catch {}
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setTimeout(reset, 200);
        }
      }}
    >
      <DialogContent
        className={cn(
          "w-[calc(100%-2rem)] sm:w-full",
          step === "connect" && platform === "WHATSAPP"
            ? "max-w-lg sm:max-w-lg"
            : "max-w-md sm:max-w-md"
        )}
      >
        <DialogHeader>
          <DialogTitle>{step === "pick" ? "Add Channel" : `Connect ${platform}`}</DialogTitle>
        </DialogHeader>

        {step === "pick" && (
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium">Platform</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(["TELEGRAM", "WHATSAPP", "SLACK", "DISCORD"] as ConnectPlatform[]).map((p) => {
                  const ps = PLATFORM_STYLES[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlatform(p)}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors",
                        platform === p ? cn(ps.bg, ps.color, ps.border) : "hover:bg-muted"
                      )}
                    >
                      <PlatformLogo platform={p} className="h-4 w-4" />
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Label *</label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Must be unique across your task channels.
              </p>
              <input
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Office Cleaning Bot"
                required
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  setTimeout(reset, 200);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={onCreate.isPending || !label.trim()}>
                {onCreate.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "connect" && createdChannel && (
          <ConnectChannelForm
            channel={createdChannel}
            platform={platform}
            onDone={() => {
              onClose();
              setTimeout(reset, 200);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditChannelDialog({
  open,
  channel,
  onClose,
  onUpdate,
}: {
  open: boolean;
  channel: TaskChannel | null;
  onClose: () => void;
  onUpdate: ReturnType<typeof useUpdateTaskChannel>;
}) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    setLabel(channel?.label ?? "");
  }, [channel?.id, channel?.label]);

  if (!channel) return null;

  const platform = channel.platform as ConnectPlatform;
  const hasLabelChanged = label.trim() && label.trim() !== channel.label;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "w-[calc(100%-2rem)] sm:w-full",
          channel.platform === "WHATSAPP" ? "max-w-lg sm:max-w-lg" : "max-w-md sm:max-w-md"
        )}
      >
        <DialogHeader>
          <DialogTitle>Edit {channel.platform} Channel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium">Label *</label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Must be unique across your task channels.
            </p>
            <input
              className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Channel label"
            />
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!hasLabelChanged || onUpdate.isPending}
                onClick={() =>
                  onUpdate.mutate({
                    channelId: channel.id,
                    label: label.trim(),
                  })
                }
              >
                {onUpdate.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save label"
                )}
              </Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-1">Connection Settings</p>
            <p className="text-xs text-muted-foreground mb-3">
              Reconnect or update credentials for this {channel.platform.toLowerCase()} channel.
            </p>
            <ConnectChannelForm channel={channel} platform={platform} onDone={onClose} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Platform Connect Forms ─── */

function ConnectChannelForm({
  channel,
  platform,
  onDone,
}: {
  channel: TaskChannel;
  platform: ConnectPlatform;
  onDone: () => void;
}) {
  if (platform === "TELEGRAM") return <TelegramConnectForm channel={channel} onDone={onDone} />;
  if (platform === "WHATSAPP") return <WhatsAppConnectForm channel={channel} onDone={onDone} />;
  if (platform === "SLACK") return <SlackConnectForm channel={channel} onDone={onDone} />;
  if (platform === "DISCORD") return <DiscordConnectForm channel={channel} onDone={onDone} />;
  return null;
}

function TelegramConnectForm({ channel, onDone }: { channel: TaskChannel; onDone: () => void }) {
  const channelId = channel.id;
  const { data: taskChannelsData } = useTaskChannels();
  const channelFromList = taskChannelsData?.channels?.find((c) => c.id === channelId);
  const live = channelFromList ?? channel;
  const isConnected = live.status === "connected";

  const [botToken, setBotToken] = useState("");
  const connectTelegram = useConnectTelegramTaskChannel();
  const disconnect = useDisconnectTaskChannel();
  const qc = useQueryClient();

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["task-channels"] });
    toast.success("Refreshed");
  };

  if (isConnected) {
    return (
      <div className="space-y-3 mt-2">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50 px-4 py-6">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          <p className="text-sm font-medium">Telegram connected</p>
          {live.telegramBotUsername && (
            <p className="text-xs text-muted-foreground">@{live.telegramBotUsername}</p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={disconnect.isPending}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => disconnect.mutate(channelId)}
            disabled={disconnect.isPending}
          >
            {disconnect.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Unplug className="h-3.5 w-3.5 mr-1.5" />
                Disconnect
              </>
            )}
          </Button>
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-2">
      <p className="text-xs text-muted-foreground">
        Create a bot via{" "}
        <a
          href="https://t.me/BotFather"
          target="_blank"
          rel="noreferrer"
          className="underline text-primary"
        >
          @BotFather
        </a>{" "}
        on Telegram, then paste the token below.
      </p>
      <div>
        <label className="text-sm font-medium">Bot Token *</label>
        <input
          className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
          placeholder="e.g. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!botToken.trim() || connectTelegram.isPending}
          onClick={() => connectTelegram.mutate({ channelId, botToken: botToken.trim() })}
        >
          {connectTelegram.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Connecting...
            </>
          ) : (
            "Connect"
          )}
        </Button>
      </div>
    </div>
  );
}

function WhatsAppConnectForm({ channel, onDone }: { channel: TaskChannel; onDone: () => void }) {
  const channelId = channel.id;
  const { data: taskChannelsData } = useTaskChannels();
  const channelFromList = taskChannelsData?.channels?.find((c) => c.id === channelId);
  /** Prefer live query so status matches DB after connect; fallback to prop when cache cold. */
  const channelStatus = channelFromList?.status ?? channel.status;

  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<{
    status: string;
    qr: string | null;
  } | null>(null);
  /** Bump after disconnect so the init effect re-runs pairing while channelId stays the same. */
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const disconnect = useDisconnectTaskChannel();

  const sessionConnected = whatsappStatus?.status === "connected";
  const dbConnected = channelStatus === "connected";
  /** Never show “connected” success unless both the session and the task channel row are connected. */
  const isFullyConnected = sessionConnected && dbConnected;
  const isSyncingSession = sessionConnected && !dbConnected;

  /** Toast once when pairing completes; only reset ref when switching channels (not when status updates). */
  const pendingAtOpenRef = useRef(channel.status === "pending");
  useEffect(() => {
    pendingAtOpenRef.current = channel.status === "pending";
  }, [channelId]);
  useEffect(() => {
    if (isFullyConnected && pendingAtOpenRef.current) {
      toast.success("WhatsApp connected successfully!");
      pendingAtOpenRef.current = false;
    }
  }, [isFullyConnected]);

  const invalidateChannelQueries = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["task-channels"] });
    qc.invalidateQueries({ queryKey: ["chat-channels"] });
  }, [qc]);

  const runPairingFlow = useCallback(async () => {
    setConnectError(null);
    setConnecting(true);
    try {
      const res = await authenticatedPost<{
        success: boolean;
        channelId: string;
        sessionId: string;
        status: string;
        qr: string | null;
      }>(`/api/task-channels/${channelId}/whatsapp/connect`);

      if (!res.success) throw new Error("Failed to start WhatsApp connection");

      setWhatsappStatus({
        status: res.status,
        qr: res.status === "connected" ? null : (res.qr ?? null),
      });

      if (res.status === "connected") {
        invalidateChannelQueries();
        return;
      }

      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        try {
          const statusRes = await authenticatedGet<{
            success: boolean;
            status: string;
            qr: string | null;
          }>(`/api/task-channels/${channelId}/whatsapp/status`);
          setWhatsappStatus({
            status: statusRes.status,
            qr: statusRes.status === "connected" ? null : statusRes.qr,
          });
          if (statusRes.status === "connected") {
            invalidateChannelQueries();
            break;
          }
        } catch {
          break;
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start WhatsApp connection";
      setConnectError(message);
      toast.error(message);
    } finally {
      setConnecting(false);
    }
  }, [channelId, invalidateChannelQueries]);

  const runPairingRef = useRef(runPairingFlow);
  runPairingRef.current = runPairingFlow;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setWhatsappStatus(null);
      setConnecting(true);
      setConnectError(null);
      try {
        const statusRes = await authenticatedGet<{
          success: boolean;
          status: string;
          qr: string | null;
        }>(`/api/task-channels/${channelId}/whatsapp/status`);

        if (cancelled) return;

        setWhatsappStatus({
          status: statusRes.status,
          qr: statusRes.status === "connected" ? null : (statusRes.qr ?? null),
        });

        invalidateChannelQueries();
        if (statusRes.status === "connected") {
          return;
        }

        await runPairingRef.current();
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Could not load WhatsApp status";
        setConnectError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setConnecting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [channelId, invalidateChannelQueries, reconnectNonce]);

  const handleRefreshStatus = async () => {
    try {
      const statusRes = await authenticatedGet<{
        success: boolean;
        status: string;
        qr: string | null;
      }>(`/api/task-channels/${channelId}/whatsapp/status`);
      setWhatsappStatus({
        status: statusRes.status,
        qr: statusRes.status === "connected" ? null : (statusRes.qr ?? null),
      });
      invalidateChannelQueries();
      toast.success("Status refreshed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not refresh status");
    }
  };

  const handleDisconnect = () => {
    disconnect.mutate(channelId, {
      onSuccess: () => {
        setReconnectNonce((n) => n + 1);
        setWhatsappStatus(null);
      },
    });
  };

  return (
    <div className="space-y-4 mt-1">
      {isFullyConnected ? (
        <>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50 px-6 py-8">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 text-center">
              WhatsApp connected
            </p>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              This channel is ready for task notifications.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleRefreshStatus()}
              disabled={disconnect.isPending}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnect.isPending}
            >
              {disconnect.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Unplug className="h-3.5 w-3.5 mr-1.5" />
                  Disconnect
                </>
              )}
            </Button>
            <Button type="button" onClick={onDone}>
              Done
            </Button>
          </div>
        </>
      ) : (
        <>
          {isSyncingSession && (
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/30 px-6 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium text-center">Finishing connection…</p>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Syncing with your workspace.
              </p>
            </div>
          )}
          {!isSyncingSession && whatsappStatus?.qr ? (
            <div className="rounded-2xl border bg-gradient-to-b from-muted/40 to-muted/10 p-6 flex flex-col items-center gap-4">
              <div className="text-center space-y-1 w-full">
                <div className="flex items-center justify-center gap-2">
                  <p className="text-sm font-semibold">Link WhatsApp</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    disabled={connecting || disconnect.isPending}
                    onClick={() => void runPairingFlow()}
                    title="Request a new QR code"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", connecting && "animate-spin")} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground max-w-[280px] mx-auto">
                  Open WhatsApp on your phone → Settings → Linked devices → Link a device, then scan
                  this code.
                </p>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-950 ring-1 ring-border/60">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(whatsappStatus.qr)}`}
                  alt="WhatsApp QR code"
                  width={240}
                  height={240}
                  className="rounded-md"
                />
              </div>
            </div>
          ) : null}
          {!isSyncingSession && !whatsappStatus?.qr && (
            <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/20 py-14 px-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground text-center">
                {connecting ? "Preparing QR code…" : "Waiting for QR code…"}
              </p>
            </div>
          )}
          {connectError && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="text-xs text-destructive text-center">{connectError}</p>
              <Button size="sm" variant="outline" onClick={() => void runPairingFlow()}>
                Retry
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SlackConnectForm({ channel, onDone }: { channel: TaskChannel; onDone: () => void }) {
  const channelId = channel.id;
  const { data: taskChannelsData } = useTaskChannels();
  const channelFromList = taskChannelsData?.channels?.find((c) => c.id === channelId);
  const live = channelFromList ?? channel;
  const isConnected = live.status === "connected" && !!live.slackBotToken;

  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackSigningSecret, setSlackSigningSecret] = useState("");
  const connectSlack = useConnectSlackTaskChannel();
  const disconnect = useDisconnectTaskChannel();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const webhookUrl = live.webhookUrl ?? null;

  const handleConnect = () => {
    connectSlack.mutate({
      channelId,
      slackBotToken: slackBotToken.trim(),
      slackSigningSecret: slackSigningSecret.trim(),
    });
  };

  const handleCopy = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["task-channels"] });
    toast.success("Refreshed");
  };

  if (isConnected) {
    return (
      <div className="space-y-3 mt-2">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50 px-4 py-6">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          <p className="text-sm font-medium">Slack connected</p>
          {live.slackTeamId && (
            <p className="text-xs text-muted-foreground">Team: {live.slackTeamId}</p>
          )}
        </div>
        {webhookUrl ? (
          <div>
            <label className="text-sm font-medium">Events Webhook URL</label>
            <p className="text-xs text-muted-foreground mb-1">
              Copy this URL into your Slack app&apos;s Event Subscriptions settings.
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 rounded-md border bg-muted text-sm"
                value={webhookUrl}
                readOnly
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                type="button"
                onClick={handleCopy}
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Webhook URL missing — try Refresh or reconnect.
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={disconnect.isPending}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => disconnect.mutate(channelId)}
            disabled={disconnect.isPending}
          >
            {disconnect.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Unplug className="h-3.5 w-3.5 mr-1.5" />
                Disconnect
              </>
            )}
          </Button>
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-2">
      <p className="text-xs text-muted-foreground">
        Enter your Slack Bot Token and Signing Secret from your Slack App settings.
      </p>
      <div>
        <label className="text-sm font-medium">Bot Token *</label>
        <input
          className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
          placeholder="xoxb-..."
          value={slackBotToken}
          onChange={(e) => setSlackBotToken(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Signing Secret *</label>
        <input
          className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
          placeholder="Signing secret from Basic Information"
          type="password"
          value={slackSigningSecret}
          onChange={(e) => setSlackSigningSecret(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!slackBotToken.trim() || !slackSigningSecret.trim() || connectSlack.isPending}
          onClick={handleConnect}
        >
          {connectSlack.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Connecting...
            </>
          ) : (
            "Connect"
          )}
        </Button>
      </div>
    </div>
  );
}

function DiscordConnectForm({ channel, onDone }: { channel: TaskChannel; onDone: () => void }) {
  const channelId = channel.id;
  const { data: taskChannelsData } = useTaskChannels();
  const channelFromList = taskChannelsData?.channels?.find((c) => c.id === channelId);
  const live = channelFromList ?? channel;
  const isConnected = live.status === "connected" && !!live.discordBotToken;

  const [discordBotToken, setDiscordBotToken] = useState("");
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [discordChannelId, setDiscordChannelId] = useState("");
  const connectDiscord = useConnectDiscordTaskChannel();
  const disconnect = useDisconnectTaskChannel();
  const qc = useQueryClient();

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["task-channels"] });
    toast.success("Refreshed");
  };

  if (isConnected) {
    return (
      <div className="space-y-3 mt-2">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50 px-4 py-6">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          <p className="text-sm font-medium">Discord connected</p>
          {(live.discordGuildId || live.discordChannelId) && (
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              {live.discordGuildId && <>Guild: {live.discordGuildId}</>}
              {live.discordGuildId && live.discordChannelId && " · "}
              {live.discordChannelId && <>Channel: {live.discordChannelId}</>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={disconnect.isPending}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => disconnect.mutate(channelId)}
            disabled={disconnect.isPending}
          >
            {disconnect.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Unplug className="h-3.5 w-3.5 mr-1.5" />
                Disconnect
              </>
            )}
          </Button>
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-2">
      <p className="text-xs text-muted-foreground">
        Enter your Discord Bot Token. Guild ID and Channel ID are optional — if omitted, the bot
        will listen on all channels.
      </p>
      <div>
        <label className="text-sm font-medium">Bot Token *</label>
        <input
          className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
          placeholder="Discord bot token"
          type="password"
          value={discordBotToken}
          onChange={(e) => setDiscordBotToken(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Guild ID (optional)</label>
        <input
          className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
          placeholder="e.g. 123456789012345678"
          value={discordGuildId}
          onChange={(e) => setDiscordGuildId(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Channel ID (optional)</label>
        <input
          className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
          placeholder="e.g. 987654321098765432"
          value={discordChannelId}
          onChange={(e) => setDiscordChannelId(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!discordBotToken.trim() || connectDiscord.isPending}
          onClick={() =>
            connectDiscord.mutate({
              channelId,
              discordBotToken: discordBotToken.trim(),
              discordGuildId: discordGuildId.trim() || undefined,
              discordChannelId: discordChannelId.trim() || undefined,
            })
          }
        >
          {connectDiscord.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Connecting...
            </>
          ) : (
            "Connect"
          )}
        </Button>
      </div>
    </div>
  );
}
