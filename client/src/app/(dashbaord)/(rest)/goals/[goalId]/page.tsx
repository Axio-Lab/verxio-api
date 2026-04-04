"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useAgentGoal,
  useGoalTasks,
  useGoalMemories,
  useDeleteMemory,
  useApproveGoal,
  useRejectGoal,
  usePauseGoal,
  useResumeGoal,
} from "@/hooks/useAgentGoals";
import {
  EntityPagination,
  LoadingView,
} from "@/app/app-components/features/editor/entity-component";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Trash2,
  Loader2,
  ListTodo,
  SkipForward,
  Pause,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatObjective(text: string): string {
  return text.replace(/\.\s+/g, ".\n\n");
}

/** Turn dense one-line agent summaries into markdown with breathing room. */
function formatDenseTaskOutputForMarkdown(text: string): string {
  let s = text.trim();
  if (!s) return s;

  const lineCount = s.split("\n").filter((l) => l.trim()).length;
  if (lineCount > 6 && s.includes("\n")) return s;

  // Numbered sections like "(1) foo (2) bar" → markdown list items (readable spacing)
  s = s.replace(/\s*\((\d+)\)\s*/g, "\n\n$1. ");

  // Sentence breaks (period + space + capital letter)
  s = s.replace(/\.\s+([A-Z][a-z])/g, ".\n\n$1");

  // Clause breaks before major list-like semicolons
  s = s.replace(/;\s+(?=[A-Z(])/g, ";\n\n");

  // Collapse excessive newlines
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

const TASKS_PER_PAGE = 5;
const MEMORIES_PER_PAGE = 10;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: {
    label: "Pending",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  AWAITING_APPROVAL: {
    label: "Awaiting Approval",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  COMPLETE: {
    label: "Complete",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  FAILED: {
    label: "Failed",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  SKIPPED: {
    label: "Skipped",
    color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
  PLANNING: {
    label: "Planning",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  EXECUTING: {
    label: "Executing",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  REVIEWING: {
    label: "Reviewing",
    color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  },
  STOPPED: {
    label: "Stopped",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  },
  PAUSED: {
    label: "Paused",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
  },
};

const detailTabs = [
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "memory", label: "Memory", icon: Brain },
] as const;

function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "COMPLETE":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />;
    case "FAILED":
      return <XCircle className="h-4 w-4 shrink-0 text-red-600" />;
    case "IN_PROGRESS":
      return <Loader2 className="h-4 w-4 shrink-0 text-blue-600 animate-spin" />;
    case "SKIPPED":
      return <SkipForward className="h-4 w-4 shrink-0 text-gray-400" />;
    default:
      return <Clock className="h-4 w-4 shrink-0 text-gray-400" />;
  }
}

function extractReadableOutput(output: Record<string, unknown>) {
  const result = (output.result as string) || (output.rawResult as string) || null;
  const factsLearned = Array.isArray(output.facts_learned) ? output.facts_learned : null;

  let markdownText: string | null = null;
  if (result) {
    const jsonMatch = result.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        markdownText = (parsed.result as string) || result;
      } catch {
        markdownText = result;
      }
    } else {
      markdownText = result;
    }
  }

  if (markdownText) {
    markdownText = formatDenseTaskOutputForMarkdown(markdownText);
  }

  return { markdownText, factsLearned };
}

function TaskOutput({ output }: { output: Record<string, unknown> }) {
  const { markdownText, factsLearned } = extractReadableOutput(output);

  if (!markdownText && !factsLearned) {
    return (
      <pre className="mt-2 rounded-md border bg-muted/50 p-3 text-xs overflow-auto max-h-60">
        {JSON.stringify(output, null, 2)}
      </pre>
    );
  }

  return (
    <div className="mt-4 space-y-5">
      {markdownText && (
        <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border bg-muted/30 p-5 overflow-auto max-h-[500px] leading-relaxed [&_p]:my-3 [&_ul]:my-3 [&_ol]:my-3 [&_li]:my-1 [&_li]:leading-relaxed [&_h1]:text-base [&_h1]:mt-5 [&_h1]:mb-3 [&_h2]:text-sm [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:mt-3 [&_h3]:mb-2 [&_a]:text-primary [&_a]:break-all [&_blockquote]:my-3 [&_pre]:my-3">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownText}</ReactMarkdown>
        </div>
      )}

      {factsLearned && factsLearned.length > 0 && (
        <div className="rounded-lg border bg-muted/20 p-5">
          <p className="text-xs font-medium text-muted-foreground mb-4">
            Facts learned ({factsLearned.length})
          </p>
          <div className="grid grid-cols-1 gap-4">
            {factsLearned.map((fact: { key: string; value: string }, i: number) => (
              <div
                key={i}
                className="flex flex-col gap-1.5 sm:flex-row sm:gap-4 text-sm leading-relaxed"
              >
                <span className="shrink-0 font-mono text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-md w-fit">
                  {fact.key}
                </span>
                <span className="text-foreground min-w-0">{fact.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const goalId = params.goalId as string;
  const [activeTab, setActiveTab] = useState<"tasks" | "memory">("tasks");

  const { data: goalData, isLoading } = useAgentGoal(goalId);
  const { data: tasksData } = useGoalTasks(goalId);
  const { data: memoriesData } = useGoalMemories(goalId);
  const deleteMemory = useDeleteMemory();
  const approveGoal = useApproveGoal();
  const rejectGoal = useRejectGoal();
  const pauseGoal = usePauseGoal();
  const resumeGoal = useResumeGoal();
  const [taskPage, setTaskPage] = useState(1);
  const [memoryPage, setMemoryPage] = useState(1);
  const goal = goalData?.goal;
  const tasks = tasksData?.tasks || goal?.tasks || [];
  const memories = memoriesData?.memories || goal?.memories || [];
  const totalTaskPages = Math.max(1, Math.ceil(tasks.length / TASKS_PER_PAGE));
  const totalMemoryPages = Math.max(1, Math.ceil(memories.length / MEMORIES_PER_PAGE));

  useEffect(() => {
    setTaskPage((prev) => Math.min(prev, totalTaskPages));
  }, [totalTaskPages]);

  useEffect(() => {
    setMemoryPage((prev) => Math.min(prev, totalMemoryPages));
  }, [totalMemoryPages]);

  if (isLoading) {
    return (
      <div className="p-4 md:px-6 md:py-6 h-full">
        <div className="w-full max-w-none flex flex-col gap-y-6 h-full">
          <LoadingView entity="goal" message="Loading goal..." />
        </div>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="p-4 md:px-6 md:py-6 h-full">
        <div className="w-full max-w-none flex flex-col gap-y-6 h-full">
          <div className="flex items-center justify-center min-h-[60vh]">
            <p className="text-muted-foreground">Goal not found</p>
          </div>
        </div>
      </div>
    );
  }

  const pagedTasks = tasks.slice((taskPage - 1) * TASKS_PER_PAGE, taskPage * TASKS_PER_PAGE);
  const pagedMemories = memories.slice(
    (memoryPage - 1) * MEMORIES_PER_PAGE,
    memoryPage * MEMORIES_PER_PAGE
  );
  const completedTasks = tasks.filter((t) => t.status === "COMPLETE").length;
  const totalTasks = tasks.length;
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const hasApprovalPending = tasks.some((t) => t.status === "AWAITING_APPROVAL");
  const statusConfig = STATUS_CONFIG[goal.status] || {
    label: goal.status,
    color: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="p-4 md:px-6 md:py-6 h-full">
      <div className="w-full max-w-none flex flex-col gap-y-6 h-full">
        <button
          onClick={() => router.push("/goals")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Goals
        </button>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold">{goal.name}</h1>
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0",
                statusConfig.color
              )}
            >
              {statusConfig.label}
            </span>
            {goal.status === "EXECUTING" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => pauseGoal.mutate({ goalId })}
                disabled={pauseGoal.isPending}
                className="h-7 gap-1.5 text-xs"
              >
                {pauseGoal.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Pause className="h-3 w-3" />
                )}
                Pause
              </Button>
            )}
            {(goal.status === "PAUSED" || goal.status === "STOPPED") && (
              <Button
                size="sm"
                onClick={() => resumeGoal.mutate({ goalId })}
                disabled={resumeGoal.isPending}
                className="h-7 gap-1.5 text-xs"
              >
                {resumeGoal.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Resume
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line w-full mt-1">
            {formatObjective(goal.objective)}
          </p>
        </div>

        {totalTasks > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {completedTasks}/{totalTasks} tasks complete
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {hasApprovalPending && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <span className="text-sm font-medium">Approval required for this goal</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => approveGoal.mutate({ goalId })}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => rejectGoal.mutate({ goalId })}
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                Reject
              </Button>
            </div>
          </div>
        )}

        {/* Tab strip */}
        <div className="flex gap-1 border-b">
          {detailTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.id === "memory" && memories.length > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">({memories.length})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tasks tab */}
        {activeTab === "tasks" && (
          <div className="flex flex-col gap-y-3 flex-1">
            {tasks.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center py-12 text-muted-foreground">
                <ListTodo className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No tasks yet. Decomposition may still be running.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-y-2">
                  {pagedTasks.map((task) => {
                    const taskStatus = STATUS_CONFIG[task.status] || {
                      label: task.status,
                      color: "bg-gray-100 text-gray-700",
                    };
                    return (
                      <div key={task.id} className="rounded-lg border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <TaskStatusIcon status={task.status} />
                              <span className="font-medium text-sm">{task.title}</span>
                            </div>
                            {task.description && (
                              <p className="text-xs text-muted-foreground ml-6 leading-relaxed mt-1">
                                {task.description}
                              </p>
                            )}
                            {task.assignedAgent && (
                              <p className="text-xs text-muted-foreground ml-6">
                                Agent: <span className="font-medium">{task.assignedAgent}</span>
                              </p>
                            )}
                            {task.blockerReason && (
                              <p className="text-xs text-red-600 dark:text-red-400 ml-6">
                                Blocker: {task.blockerReason}
                              </p>
                            )}
                          </div>
                          <span
                            className={cn(
                              "shrink-0 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
                              taskStatus.color
                            )}
                          >
                            {taskStatus.label}
                          </span>
                        </div>
                        {task.output && (
                          <details className="mt-5 border-t border-border/70 pt-4 sm:ml-6">
                            <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors py-1 [&::marker]:text-muted-foreground">
                              View output
                            </summary>
                            <div className="pt-2">
                              <TaskOutput output={task.output as Record<string, unknown>} />
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
                <EntityPagination
                  currentPage={taskPage}
                  totalPages={totalTaskPages}
                  onPageChange={setTaskPage}
                  showInfo={false}
                  className="mt-2"
                />
              </>
            )}
          </div>
        )}

        {/* Memory tab */}
        {activeTab === "memory" && (
          <div className="flex flex-col gap-y-3 flex-1">
            {memories.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center py-12 text-muted-foreground">
                <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No memories stored for this goal.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-y-2">
                  {pagedMemories.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-start justify-between gap-3 rounded-lg border bg-card p-4"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-mono text-xs font-medium text-muted-foreground">
                          {m.key}
                        </p>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                          {m.value}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteMemory.mutate({ goalId, memoryId: m.id })}
                        className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete memory"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <EntityPagination
                  currentPage={memoryPage}
                  totalPages={totalMemoryPages}
                  onPageChange={setMemoryPage}
                  showInfo={false}
                  className="mt-2"
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
