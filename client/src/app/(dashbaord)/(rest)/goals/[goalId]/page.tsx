"use client";

import { useParams, useRouter } from "next/navigation";
import {
  useAgentGoal,
  useGoalTasks,
  useGoalMemories,
  useDeleteMemory,
  useApproveGoal,
  useRejectGoal,
} from "@/hooks/useAgentGoals";
import { ArrowLeft, Brain, CheckCircle2, XCircle, Clock, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-gray-100 text-gray-700" },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
  AWAITING_APPROVAL: { label: "Awaiting Approval", color: "bg-amber-100 text-amber-700" },
  COMPLETE: { label: "Complete", color: "bg-green-100 text-green-700" },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-700" },
  SKIPPED: { label: "Skipped", color: "bg-gray-100 text-gray-500" },
  PLANNING: { label: "Planning", color: "bg-purple-100 text-purple-700" },
  EXECUTING: { label: "Executing", color: "bg-blue-100 text-blue-700" },
  REVIEWING: { label: "Reviewing", color: "bg-indigo-100 text-indigo-700" },
};

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const goalId = params.goalId as string;

  const { data: goalData, isLoading } = useAgentGoal(goalId);
  const { data: tasksData } = useGoalTasks(goalId);
  const { data: memoriesData } = useGoalMemories(goalId);
  const deleteMemory = useDeleteMemory();
  const approveGoal = useApproveGoal();
  const rejectGoal = useRejectGoal();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const goal = goalData?.goal;
  if (!goal) {
    return (
      <div className="p-6 text-center text-muted-foreground">Goal not found</div>
    );
  }

  const tasks = tasksData?.tasks || goal.tasks || [];
  const memories = memoriesData?.memories || goal.memories || [];
  const completedTasks = tasks.filter((t) => t.status === "COMPLETE").length;
  const totalTasks = tasks.length;
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const hasApprovalPending = tasks.some((t) => t.status === "AWAITING_APPROVAL");
  const statusConfig = STATUS_CONFIG[goal.status] || { label: goal.status, color: "bg-gray-100 text-gray-700" };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <button
        onClick={() => router.push("/goals")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Goals
      </button>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{goal.name}</h1>
          <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", statusConfig.color)}>
            {statusConfig.label}
          </span>
        </div>
        <p className="text-muted-foreground">{goal.objective}</p>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>{completedTasks}/{totalTasks} tasks complete</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Approval banner */}
      {hasApprovalPending && (
        <div className="flex items-center justify-between p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="font-medium">Approval required for this goal</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => approveGoal.mutate({ goalId })}
              className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white hover:bg-green-700"
            >
              Approve
            </button>
            <button
              onClick={() => rejectGoal.mutate({ goalId })}
              className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Task tree */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Task Breakdown</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet. Decomposition may still be running.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const taskStatus = STATUS_CONFIG[task.status] || { label: task.status, color: "bg-gray-100 text-gray-700" };
              return (
                <div key={task.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {task.status === "COMPLETE" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        {task.status === "FAILED" && <XCircle className="h-4 w-4 text-red-600" />}
                        {task.status === "IN_PROGRESS" && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
                        {task.status === "PENDING" && <Clock className="h-4 w-4 text-gray-400" />}
                        <span className="font-medium">{task.title}</span>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground ml-6">{task.description}</p>
                      )}
                      {task.assignedAgent && (
                        <p className="text-xs text-muted-foreground ml-6">Agent: {task.assignedAgent}</p>
                      )}
                      {task.blockerReason && (
                        <p className="text-xs text-red-600 ml-6">Blocker: {task.blockerReason}</p>
                      )}
                    </div>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", taskStatus.color)}>
                      {taskStatus.label}
                    </span>
                  </div>
                  {task.output && (
                    <details className="mt-2 ml-6">
                      <summary className="text-xs text-muted-foreground cursor-pointer">View Output</summary>
                      <pre className="mt-1 p-2 rounded bg-muted text-xs overflow-auto max-h-40">
                        {JSON.stringify(task.output, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Memory panel */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5" /> Memory
        </h2>
        {memories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No memories stored for this goal.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Key</th>
                  <th className="text-left p-3 font-medium">Value</th>
                  <th className="text-left p-3 font-medium">Scope</th>
                  <th className="text-right p-3 font-medium w-16" />
                </tr>
              </thead>
              <tbody>
                {memories.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">{m.key}</td>
                    <td className="p-3 max-w-xs truncate">{m.value}</td>
                    <td className="p-3">
                      <span className="px-1.5 py-0.5 rounded text-xs bg-muted">{m.scope}</span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => deleteMemory.mutate({ goalId, memoryId: m.id })}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
