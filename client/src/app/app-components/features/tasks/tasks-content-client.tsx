"use client";

import { useState } from "react";
import {
  useHumanTasks,
  useCreateHumanTask,
  useDeleteHumanTask,
  usePauseHumanTask,
  useResumeHumanTask,
  useTaskWorkers,
  useAddWorker,
  useRemoveWorker,
  useTaskSubmissions,
  useTaskReports,
  useGenerateReport,
  useAiFillTask,
  useChatChannels,
  type HumanTask,
  type TaskSubmission,
  type TaskComplianceReport,
} from "@/hooks/useHumanTasks";
import { useDeliveryActions, type DeliveryAction, type DeliveryConfig } from "@/hooks/useAgentGoals";
import {
  ClipboardCheck,
  Plus,
  Trash2,
  Pause,
  Play,
  Users,
  MoreHorizontal,
  Loader2,
  FileText,
  LayoutGrid,
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  AlertCircle,
  X,
  Download,
  UserPlus,
  UserMinus,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  PAUSED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  ARCHIVED: "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400",
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

export function TasksContentClient() {
  const [activeTab, setActiveTab] = useState<"tasks" | "liveboard" | "reports">("tasks");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showWorkerDialog, setShowWorkerDialog] = useState(false);
  const [showSubmissionDetail, setShowSubmissionDetail] = useState<TaskSubmission | null>(null);
  const [showReportDetail, setShowReportDetail] = useState<TaskComplianceReport | null>(null);

  const { data: tasksData, isLoading } = useHumanTasks();
  const createTask = useCreateHumanTask();
  const deleteTask = useDeleteHumanTask();
  const pauseTask = usePauseHumanTask();
  const resumeTask = useResumeHumanTask();

  const tasks = tasksData?.tasks || [];
  const activeTasks = tasks.filter((t) => t.status !== "ARCHIVED");

  const tabs = [
    { id: "tasks", label: "Tasks", icon: <ClipboardCheck className="h-4 w-4" /> },
    { id: "liveboard", label: "Live Board", icon: <LayoutGrid className="h-4 w-4" /> },
    { id: "reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
  ] as const;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6" /> Task Manager
        </h1>
        <p className="text-muted-foreground mt-1">
          Assign, track, and vet human tasks with AI-powered compliance scoring.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Create Task
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No tasks yet. Create your first task to start managing human work.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {activeTasks.map((task) => (
                <div key={task.id} className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{task.name}</h3>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[task.status] || "bg-gray-100 text-gray-700")}>
                          {task.status}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs bg-muted">
                          {RECURRENCE_LABELS[task.recurrenceType] || task.recurrenceType}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs bg-muted">
                          {task.evidenceType}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground truncate">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {task._count?.workers ?? 0} workers
                        </span>
                        <span>{task._count?.submissions ?? 0} submissions</span>
                        {task.scheduledTimes?.length > 0 && (
                          <span>Schedule: {(task.scheduledTimes as string[]).join(", ")}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => { setSelectedTaskId(task.id); setShowWorkerDialog(true); }}
                        className="p-2 rounded-md hover:bg-muted"
                        title="Manage workers"
                      >
                        <Users className="h-4 w-4" />
                      </button>
                      {task.status === "ACTIVE" ? (
                        <button onClick={() => pauseTask.mutate({ taskId: task.id })} className="p-2 rounded-md hover:bg-muted" title="Pause">
                          <Pause className="h-4 w-4" />
                        </button>
                      ) : task.status === "PAUSED" ? (
                        <button onClick={() => resumeTask.mutate({ taskId: task.id })} className="p-2 rounded-md hover:bg-muted" title="Resume">
                          <Play className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => deleteTask.mutate({ taskId: task.id })}
                        className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
                        title="Archive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live Board Tab */}
      {activeTab === "liveboard" && (
        <LiveBoardTab
          tasks={activeTasks}
          onSubmissionClick={setShowSubmissionDetail}
        />
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <ReportsTab
          tasks={activeTasks}
          onReportClick={setShowReportDetail}
        />
      )}

      {/* Create Task Dialog */}
      {showCreateDialog && (
        <CreateTaskDialog
          onClose={() => setShowCreateDialog(false)}
          onCreate={(data) => {
            createTask.mutate(data, { onSuccess: () => setShowCreateDialog(false) });
          }}
          isPending={createTask.isPending}
        />
      )}

      {/* Worker Management Dialog */}
      {showWorkerDialog && selectedTaskId && (
        <WorkerDialog
          taskId={selectedTaskId}
          onClose={() => { setShowWorkerDialog(false); setSelectedTaskId(null); }}
        />
      )}

      {/* Submission Detail Dialog */}
      {showSubmissionDetail && (
        <SubmissionDetailDialog
          submission={showSubmissionDetail}
          onClose={() => setShowSubmissionDetail(null)}
        />
      )}

      {/* Report Detail Dialog */}
      {showReportDetail && (
        <ReportDetailDialog
          report={showReportDetail}
          onClose={() => setShowReportDetail(null)}
        />
      )}
    </div>
  );
}

function CreateTaskDialog({ onClose, onCreate, isPending }: {
  onClose: () => void;
  onCreate: (data: any) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    evidenceType: "PHOTO",
    recurrenceType: "DAILY",
    recurrenceInterval: 60,
    scheduledTimes: ["09:00"],
    timezone: "UTC",
    acceptanceRules: [""],
    scoringEnabled: true,
    passingScore: 70,
    graceMinutes: 15,
    resubmissionAllowed: true,
    reportTime: "18:00",
  });
  const [selectedDeliveryActions, setSelectedDeliveryActions] = useState<DeliveryAction[]>([]);
  const [reportChannelId, setReportChannelId] = useState("");
  const { data: deliveryActionsData } = useDeliveryActions();
  const { data: channelsData } = useChatChannels();
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiFill, setShowAiFill] = useState(false);
  const aiFill = useAiFillTask();

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
        },
      }
    );
  };

  const addRule = () => setForm({ ...form, acceptanceRules: [...form.acceptanceRules, ""] });
  const removeRule = (idx: number) => setForm({ ...form, acceptanceRules: form.acceptanceRules.filter((_, i) => i !== idx) });
  const updateRule = (idx: number, val: string) => {
    const rules = [...form.acceptanceRules];
    rules[idx] = val;
    setForm({ ...form, acceptanceRules: rules });
  };

  const addTime = () => setForm({ ...form, scheduledTimes: [...form.scheduledTimes, "12:00"] });
  const removeTime = (idx: number) => setForm({ ...form, scheduledTimes: form.scheduledTimes.filter((_, i) => i !== idx) });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] sm:w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2 overflow-y-auto flex-1 pr-1 -mr-1">

        {/* AI Auto-Fill Toggle */}
        <div className="rounded-lg border overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAiFill(!showAiFill)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              Create with AI
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAiFill && "rotate-180")} />
          </button>
          {showAiFill && (
            <div className="px-4 py-3 space-y-3 border-t">
              <p className="text-xs text-muted-foreground">
                Describe the task you want to create and Verxio agent will fill all the fields for you.
              </p>
              <textarea
                className="w-full px-3 py-2 rounded-md border bg-background text-sm min-h-[120px] resize-y"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder='e.g. "Clean the office bathrooms every 2 hours from 8am to 6pm. Workers submit a photo of the cleaned bathroom. Check that floors are dry, mirrors are clean, and trash is empty."'
              />
              <button
                onClick={handleAiFill}
                disabled={!aiPrompt.trim() || aiFill.isPending}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {aiFill.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate Task
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Basic Info */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Basic Info</h3>
          <div>
            <label className="text-sm font-medium">Name *</label>
            <input className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Toilet Cleaning" />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div>
            <label className="text-sm font-medium">Evidence Type</label>
            <select className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" value={form.evidenceType} onChange={(e) => setForm({ ...form, evidenceType: e.target.value })}>
              <option value="PHOTO">Photo</option>
              <option value="TEXT">Text</option>
              <option value="PHOTO_AND_TEXT">Photo & Text</option>
              <option value="DOCUMENT">Document / PDF</option>
            </select>
          </div>
        </div>

        <hr />

        {/* Schedule */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Schedule</h3>
          <div>
            <label className="text-sm font-medium">Recurrence</label>
            <select className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" value={form.recurrenceType} onChange={(e) => setForm({ ...form, recurrenceType: e.target.value })}>
              <option value="ONCE">Once</option>
              <option value="INTERVAL">Every X Minutes</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </div>
          {form.recurrenceType === "INTERVAL" && (
            <div>
              <label className="text-sm font-medium">Interval (minutes)</label>
              <input type="number" className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" value={form.recurrenceInterval} onChange={(e) => setForm({ ...form, recurrenceInterval: parseInt(e.target.value) || 60 })} />
            </div>
          )}
          {(form.recurrenceType === "DAILY" || form.recurrenceType === "WEEKLY") && (
            <div>
              <label className="text-sm font-medium">Scheduled Times</label>
              {form.scheduledTimes.map((t, i) => (
                <div key={i} className="flex items-center gap-2 mt-1">
                  <input type="time" className="px-3 py-2 rounded-md border bg-background text-sm" value={t} onChange={(e) => { const times = [...form.scheduledTimes]; times[i] = e.target.value; setForm({ ...form, scheduledTimes: times }); }} />
                  {form.scheduledTimes.length > 1 && <button onClick={() => removeTime(i)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>}
                </div>
              ))}
              <button onClick={addTime} className="text-xs text-primary mt-1">+ Add Time</button>
            </div>
          )}
        </div>

        <hr />

        {/* Acceptance Rules */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Acceptance Rules</h3>
          <p className="text-xs text-muted-foreground">Describe what the AI should check in submitted evidence.</p>
          {form.acceptanceRules.map((rule, i) => (
            <div key={i} className="flex items-start gap-2">
              <textarea className="flex-1 px-3 py-2 rounded-md border bg-background text-sm" value={rule} onChange={(e) => updateRule(i, e.target.value)} rows={2} placeholder={`Rule ${i + 1}: e.g. "Floor must be dry and clean"`} />
              {form.acceptanceRules.length > 1 && <button onClick={() => removeRule(i)} className="mt-2 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>}
            </div>
          ))}
          <button onClick={addRule} className="text-xs text-primary">+ Add Rule</button>
        </div>

        <hr />

        {/* Scoring */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Scoring</h3>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.scoringEnabled} onChange={(e) => setForm({ ...form, scoringEnabled: e.target.checked })} className="rounded" />
            Enable scoring
          </label>
          {form.scoringEnabled && (
            <div>
              <label className="text-sm font-medium">Passing Score (0-100)</label>
              <input type="number" className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" value={form.passingScore} min={0} max={100} onChange={(e) => setForm({ ...form, passingScore: parseInt(e.target.value) || 70 })} />
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Grace Period (minutes)</label>
            <input type="number" className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" value={form.graceMinutes} onChange={(e) => setForm({ ...form, graceMinutes: parseInt(e.target.value) || 15 })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.resubmissionAllowed} onChange={(e) => setForm({ ...form, resubmissionAllowed: e.target.checked })} className="rounded" />
            Allow resubmission on failure
          </label>
        </div>

        <hr />

        {/* Reporting */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Reporting</h3>
          <div>
            <label className="text-sm font-medium">Report Time</label>
            <input type="time" className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" value={form.reportTime} onChange={(e) => setForm({ ...form, reportTime: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Chat Channel</label>
            <p className="text-xs text-muted-foreground mb-1">Send reports via a connected chat integration</p>
            <select
              className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
              value={reportChannelId}
              onChange={(e) => setReportChannelId(e.target.value)}
            >
              <option value="">None</option>
              {(channelsData?.channels || []).map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Additional Destinations</label>
            <p className="text-xs text-muted-foreground mb-2">Deliver reports to external apps via Composio</p>
            <div className="space-y-2">
              {(deliveryActionsData?.actions || []).map((action) => {
                const isSelected = selectedDeliveryActions.some((a) => a.action === action.action);
                return (
                  <label key={action.action} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedDeliveryActions((prev) =>
                          isSelected
                            ? prev.filter((a) => a.action !== action.action)
                            : [...prev, { action: action.action, label: action.label }]
                        );
                      }}
                      className="rounded border-input"
                    />
                    {action.label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border hover:bg-muted">Cancel</button>
          <button
            onClick={() => {
              const hasComposio = selectedDeliveryActions.length > 0;
              const hasChannel = !!reportChannelId;
              const deliveryConfig: DeliveryConfig | undefined =
                hasComposio || hasChannel
                  ? {
                      messagingChannel: hasChannel,
                      composioActions: hasComposio ? selectedDeliveryActions : undefined,
                    }
                  : undefined;
              onCreate({
                ...form,
                acceptanceRules: form.acceptanceRules.filter(Boolean),
                reportChannelId: reportChannelId || undefined,
                deliveryConfig,
              });
            }}
            disabled={!form.name || isPending}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Creating..." : "Create Task"}
          </button>
        </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkerDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { data: workersData, isLoading } = useTaskWorkers(taskId);
  const addWorker = useAddWorker();
  const removeWorker = useRemoveWorker();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", platform: "WHATSAPP", externalId: "", phone: "", role: "" });

  const workers = workersData?.workers || [];
  const platformLabels: Record<string, string> = { WHATSAPP: "WhatsApp", TELEGRAM: "Telegram", SLACK: "Slack", DISCORD: "Discord" };
  const externalIdLabel: Record<string, string> = {
    WHATSAPP: "Phone number (e.g. +1234567890)",
    TELEGRAM: "Telegram user/chat ID",
    SLACK: "Slack User ID (e.g. U012AB3CD)",
    DISCORD: "Discord User ID",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-md space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Workers</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : workers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workers assigned yet.</p>
        ) : (
          <div className="space-y-2">
            {workers.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">{w.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-1.5 py-0.5 rounded bg-muted">{platformLabels[w.platform] || w.platform}</span>
                    {w.role && <span>{w.role}</span>}
                    <span className={cn("px-1.5 py-0.5 rounded-full", w.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>{w.status}</span>
                  </div>
                </div>
                <button onClick={() => removeWorker.mutate({ taskId, workerId: w.id })} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
                  <UserMinus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 text-sm text-primary">
            <UserPlus className="h-4 w-4" /> Add Worker
          </button>
        ) : (
          <div className="space-y-3 border-t pt-3">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <input className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Platform</label>
              <select className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="TELEGRAM">Telegram</option>
                <option value="SLACK">Slack</option>
                <option value="DISCORD">Discord</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">{externalIdLabel[form.platform] || "External ID"}</label>
              <input className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Role (optional)</label>
              <input className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Cleaner" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm rounded-md border hover:bg-muted">Cancel</button>
              <button
                onClick={() => {
                  addWorker.mutate({ taskId, data: { name: form.name, platform: form.platform, externalId: form.externalId, phone: form.phone || undefined, role: form.role || undefined } }, {
                    onSuccess: () => { setShowAdd(false); setForm({ name: "", platform: "WHATSAPP", externalId: "", phone: "", role: "" }); },
                  });
                }}
                disabled={!form.name || !form.externalId || addWorker.isPending}
                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {addWorker.isPending ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LiveBoardTab({ tasks, onSubmissionClick }: { tasks: HumanTask[]; onSubmissionClick: (s: TaskSubmission) => void }) {
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id || "");
  const today = new Date().toISOString().split("T")[0];
  const { data: submissionsData, isLoading } = useTaskSubmissions(selectedTaskId, { date: today });
  const { data: workersData } = useTaskWorkers(selectedTaskId);

  const submissions = submissionsData?.submissions || [];
  const workers = workersData?.workers || [];
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);
  const scheduledTimes = (selectedTask?.scheduledTimes as string[]) || [];

  if (tasks.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No active tasks to display.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <select
          className="px-3 py-2 rounded-md border bg-background text-sm"
          value={selectedTaskId}
          onChange={(e) => setSelectedTaskId(e.target.value)}
        >
          {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : workers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workers assigned to this task.</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium sticky left-0 bg-muted/50">Worker</th>
                {scheduledTimes.map((time) => (
                  <th key={time} className="text-center p-3 font-medium min-w-[80px]">{time}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.filter(w => w.status !== "INACTIVE").map((worker) => (
                <tr key={worker.id} className="border-b last:border-0">
                  <td className="p-3 font-medium sticky left-0 bg-background">{worker.name}</td>
                  {scheduledTimes.map((time) => {
                    const sub = submissions.find(
                      (s) => s.worker?.id === worker.id && new Date(s.dueAt).toTimeString().slice(0, 5) === time
                    );
                    const statusInfo = sub ? SUBMISSION_STATUS[sub.status] || SUBMISSION_STATUS.PENDING : null;
                    return (
                      <td key={time} className="p-3 text-center">
                        {sub ? (
                          <button
                            onClick={() => onSubmissionClick(sub)}
                            className={cn("inline-flex items-center justify-center", statusInfo?.color)}
                            title={sub.status}
                          >
                            {statusInfo?.icon}
                          </button>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReportsTab({ tasks, onReportClick }: { tasks: HumanTask[]; onReportClick: (r: TaskComplianceReport) => void }) {
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id || "");
  const { data: reportsData, isLoading } = useTaskReports(selectedTaskId);
  const generateReport = useGenerateReport();

  const reports = reportsData?.reports || [];

  if (tasks.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No tasks available.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select className="px-3 py-2 rounded-md border bg-background text-sm" value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)}>
          {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button
          onClick={() => generateReport.mutate({ taskId: selectedTaskId })}
          disabled={generateReport.isPending}
          className="flex items-center gap-2 px-3 py-2 rounded-md border text-sm hover:bg-muted disabled:opacity-50"
        >
          {generateReport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Generate Now
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No reports generated yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <button key={report.id} onClick={() => onReportClick(report)} className="w-full text-left p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{new Date(report.periodStart).toLocaleDateString()}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                    <span>{report.totalSubmissions} submissions</span>
                    <span>{report.missedCount} missed</span>
                    <span>Avg: {report.avgScore ?? "N/A"}</span>
                    <span>Pass: {report.passRate != null ? `${report.passRate}%` : "N/A"}</span>
                  </div>
                </div>
                {report.deliveredAt && <span className="text-xs text-green-600">Delivered</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionDetailDialog({ submission, onClose }: { submission: TaskSubmission; onClose: () => void }) {
  const dueTime = new Date(submission.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const submittedTime = submission.submittedAt ? new Date(submission.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  const latenessLabel = submission.latenessSeconds != null
    ? submission.latenessSeconds > 0 ? `${Math.round(submission.latenessSeconds / 60)} min late` : `${Math.abs(Math.round(submission.latenessSeconds / 60))} min early`
    : null;

  let findings: string[] = [];
  try { findings = JSON.parse(submission.aiFindings || "[]"); } catch { findings = submission.aiFindings ? [submission.aiFindings] : []; }

  const scoreColor = (submission.aiScore ?? 0) >= 70 ? "text-green-600" : "text-red-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-lg space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Submission Detail</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {submission.imageUrl && (
          <div className="rounded-lg overflow-hidden border">
            <img src={`${process.env.NEXT_PUBLIC_API_URL || ""}${submission.imageUrl}`} alt="Submission" className="w-full max-h-64 object-contain bg-muted" />
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
              <span>{submittedTime} {latenessLabel && <span className="text-xs text-muted-foreground">({latenessLabel})</span>}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Score:</span>
            <span className={cn("text-2xl font-bold", scoreColor)}>{submission.aiScore ?? "-"}<span className="text-sm font-normal">/100</span></span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", submission.status === "PASSED" ? "bg-green-100 text-green-700" : submission.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700")}>{submission.status}</span>
          </div>
          {submission.worker && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Worker:</span>
              <span>{submission.worker.name} <span className="text-xs text-muted-foreground">({submission.worker.platform})</span></span>
            </div>
          )}
        </div>

        {findings.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">AI Findings</h3>
            <ul className="space-y-1 text-sm">
              {findings.map((f, i) => <li key={i} className="flex items-start gap-2"><span className="text-muted-foreground">-</span> {f}</li>)}
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
    </div>
  );
}

function ReportDetailDialog({ report, onClose }: { report: TaskComplianceReport; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-2xl space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Daily Report - {new Date(report.periodStart).toLocaleDateString()}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-4 gap-3">
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
            <p className="text-2xl font-bold">{report.passRate != null ? `${report.passRate}%` : "-"}</p>
            <p className="text-xs text-muted-foreground">Pass Rate</p>
          </div>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none">
          <div dangerouslySetInnerHTML={{ __html: report.summaryMarkdown.replace(/\n/g, "<br/>") }} />
        </div>

        {report.flaggedWorkerIds.length > 0 && (
          <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
            <p className="text-sm font-medium text-red-700">Flagged Workers: {report.flaggedWorkerIds.length}</p>
          </div>
        )}
      </div>
    </div>
  );
}
