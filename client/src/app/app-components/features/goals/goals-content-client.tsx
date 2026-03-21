"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAgentGoals,
  useCreateGoal,
  useDeleteGoal,
  useAgentWatches,
  useCreateWatch,
  usePauseWatch,
  useResumeWatch,
  useAgentGoal,
  useDeliveryActions,
  useAiFillGoal,
  type DeliveryConfig,
  type DeliveryAction,
} from "@/hooks/useAgentGoals";
import { useSupportAgents } from "@/hooks/useSupportAgents";
import { useChatChannels } from "@/hooks/useHumanTasks";
import {
  Target,
  Plus,
  Trash2,
  Eye,
  MoreHorizontal,
  Loader2,
  Radio,
  Pause,
  Play,
  Brain,
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

const GOAL_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PLANNING: { label: "Planning", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  EXECUTING: { label: "Executing", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  AWAITING_APPROVAL: { label: "Awaiting Approval", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  REVIEWING: { label: "Reviewing", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  COMPLETE: { label: "Complete", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

export function GoalsContentClient() {
  const [activeTab, setActiveTab] = useState<"goals" | "watches" | "memories">("goals");
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [showCreateWatch, setShowCreateWatch] = useState(false);
  const [goalForm, setGoalForm] = useState({ name: "", objective: "", reportingChannelId: "" });
  const [selectedDeliveryActions, setSelectedDeliveryActions] = useState<DeliveryAction[]>([]);
  const [watchForm, setWatchForm] = useState({ name: "", triggerType: "CRON", cronExpression: "", actionWorkflowId: "" });
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiFill, setShowAiFill] = useState(false);
  const aiFillGoal = useAiFillGoal();

  const { data: goalsData, isLoading: goalsLoading } = useAgentGoals();
  const { data: watchesData, isLoading: watchesLoading } = useAgentWatches();
  const { data: agentsData } = useSupportAgents();
  const { data: deliveryActionsData } = useDeliveryActions();
  const { data: channelsData } = useChatChannels();
  const createGoal = useCreateGoal();
  const deleteGoal = useDeleteGoal();
  const createWatch = useCreateWatch();
  const pauseWatch = usePauseWatch();
  const resumeWatch = useResumeWatch();
  const router = useRouter();

  const goals = goalsData?.goals || [];
  const watches = watchesData?.watches || [];

  const tabs = [
    { id: "goals", label: "Goals", count: goals.length },
    { id: "watches", label: "Watches", count: watches.length },
    { id: "memories", label: "Memories" },
  ] as const;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="h-6 w-6" /> AI Goals
        </h1>
        <p className="text-muted-foreground mt-1">
          Set high-level goals for AI agents to decompose, execute, and report on.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {"count" in tab && tab.count !== undefined && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-muted">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Goals Tab */}
      {activeTab === "goals" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateGoal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New Goal
            </button>
          </div>

          {goalsLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : goals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No goals yet. Create your first goal to get started.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {goals.map((goal) => {
                const taskStatuses = goal.tasks || [];
                const completed = taskStatuses.filter((t: any) => t.status === "COMPLETE").length;
                const total = taskStatuses.length;
                const statusConfig = GOAL_STATUS_CONFIG[goal.status] || { label: goal.status, color: "bg-gray-100 text-gray-700" };

                return (
                  <div key={goal.id} className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{goal.name}</h3>
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", statusConfig.color)}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{goal.objective}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <span>{total > 0 ? `${completed}/${total} tasks` : "Pending decomposition"}</span>
                          <span>{new Date(goal.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => router.push(`/goals/${goal.id}`)}
                          className="p-2 rounded-md hover:bg-muted"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteGoal.mutate({ goalId: goal.id })}
                          className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {total > 0 && (
                      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Create Goal Dialog */}
          <Dialog
            open={showCreateGoal}
            onOpenChange={(open) => {
              if (!open) {
                setShowCreateGoal(false);
                setShowAiFill(false);
              }
            }}
          >
            <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Create Goal</DialogTitle>
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
                        Describe what you want to achieve and the Verxio agent will generate the goal name and objective.
                      </p>
                      <textarea
                        className="w-full px-3 py-2 rounded-md border bg-background text-sm min-h-[140px] resize-y"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder='e.g. "I want to increase our social media engagement by 50% over the next quarter by posting daily on LinkedIn and Twitter"'
                      />
                      <button
                        onClick={() => {
                          if (!aiPrompt.trim()) return;
                          aiFillGoal.mutate(
                            { prompt: aiPrompt },
                            {
                              onSuccess: (data) => {
                                setGoalForm((prev) => ({
                                  ...prev,
                                  name: data.fields.name || prev.name,
                                  objective: data.fields.objective || prev.objective,
                                }));
                              },
                            }
                          );
                        }}
                        disabled={!aiPrompt.trim() || aiFillGoal.isPending}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {aiFillGoal.isPending ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            Generate Goals
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <input
                      className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                      value={goalForm.name}
                      onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
                      placeholder="Goal name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Objective</label>
                    <textarea
                      className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm min-h-[100px]"
                      value={goalForm.objective}
                      onChange={(e) => setGoalForm({ ...goalForm, objective: e.target.value })}
                      placeholder="Describe what this goal should achieve..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Chat Channel</label>
                    <p className="text-xs text-muted-foreground mb-1">
                      Send reports via a connected chat integration
                    </p>
                    <select
                      className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                      value={goalForm.reportingChannelId}
                      onChange={(e) => setGoalForm({ ...goalForm, reportingChannelId: e.target.value })}
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
                    <p className="text-xs text-muted-foreground mb-2">
                      Deliver reports to external apps via Composio
                    </p>
                    <div className="space-y-2">
                      {(deliveryActionsData?.actions || []).map((action) => {
                        const isSelected = selectedDeliveryActions.some(
                          (a) => a.action === action.action
                        );
                        return (
                          <label
                            key={action.action}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                          >
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
                  <button
                    onClick={() => {
                      setShowCreateGoal(false);
                      setShowAiFill(false);
                    }}
                    className="px-4 py-2 text-sm rounded-md border hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const hasComposio = selectedDeliveryActions.length > 0;
                      const hasChannel = !!goalForm.reportingChannelId;
                      const deliveryConfig: DeliveryConfig | undefined =
                        hasComposio || hasChannel
                          ? {
                              messagingChannel: hasChannel,
                              composioActions: hasComposio ? selectedDeliveryActions : undefined,
                            }
                          : undefined;
                      createGoal.mutate(
                        {
                          ...goalForm,
                          deliveryConfig,
                        },
                        {
                          onSuccess: (data) => {
                            setShowCreateGoal(false);
                            setGoalForm({ name: "", objective: "", reportingChannelId: "" });
                            setSelectedDeliveryActions([]);
                            setAiPrompt("");
                            setShowAiFill(false);
                            router.push(`/goals/${data.goal.id}`);
                          },
                        }
                      );
                    }}
                    disabled={!goalForm.name || !goalForm.objective || createGoal.isPending}
                    className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {createGoal.isPending ? "Creating..." : "Create Goal"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Watches Tab */}
      {activeTab === "watches" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateWatch(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New Watch
            </button>
          </div>

          {watchesLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : watches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Radio className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No watches configured yet.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {watches.map((watch) => (
                <div key={watch.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{watch.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="px-1.5 py-0.5 rounded bg-muted">{watch.triggerType}</span>
                        {watch.cronExpression && <span>Cron: {watch.cronExpression}</span>}
                        {watch.lastFiredAt && <span>Last fired: {new Date(watch.lastFiredAt).toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {watch.status === "ACTIVE" ? (
                        <button onClick={() => pauseWatch.mutate({ watchId: watch.id })} className="p-2 rounded-md hover:bg-muted" title="Pause">
                          <Pause className="h-4 w-4" />
                        </button>
                      ) : (
                        <button onClick={() => resumeWatch.mutate({ watchId: watch.id })} className="p-2 rounded-md hover:bg-muted" title="Resume">
                          <Play className="h-4 w-4" />
                        </button>
                      )}
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        watch.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      )}>
                        {watch.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showCreateWatch && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-md mx-4 space-y-4">
                <h2 className="text-lg font-semibold">Create Watch</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <input
                      className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                      value={watchForm.name}
                      onChange={(e) => setWatchForm({ ...watchForm, name: e.target.value })}
                      placeholder="Watch name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Trigger Type</label>
                    <select
                      className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                      value={watchForm.triggerType}
                      onChange={(e) => setWatchForm({ ...watchForm, triggerType: e.target.value })}
                    >
                      <option value="CRON">Cron Schedule</option>
                      <option value="THRESHOLD">Threshold</option>
                      <option value="WEBHOOK_EVENT">Webhook Event</option>
                    </select>
                  </div>
                  {watchForm.triggerType === "CRON" && (
                    <div>
                      <label className="text-sm font-medium">Cron Expression</label>
                      <input
                        className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                        value={watchForm.cronExpression}
                        onChange={(e) => setWatchForm({ ...watchForm, cronExpression: e.target.value })}
                        placeholder="*/5 * * * *"
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowCreateWatch(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-muted">Cancel</button>
                  <button
                    onClick={() => {
                      createWatch.mutate(watchForm, { onSuccess: () => { setShowCreateWatch(false); setWatchForm({ name: "", triggerType: "CRON", cronExpression: "", actionWorkflowId: "" }); } });
                    }}
                    disabled={!watchForm.name || createWatch.isPending}
                    className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {createWatch.isPending ? "Creating..." : "Create Watch"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Memories Tab */}
      {activeTab === "memories" && (
        <div className="text-center py-12 text-muted-foreground">
          <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Global agent memories appear here. Open a specific goal to see its memories.</p>
        </div>
      )}
    </div>
  );
}
