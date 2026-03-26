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
  useDeliveryActions,
  useAiFillGoal,
  type DeliveryConfig,
  type DeliveryAction,
} from "@/hooks/useAgentGoals";
import {
  useCustomSubagents,
  useCreateCustomSubagent,
  useUpdateCustomSubagent,
  useDeleteCustomSubagent,
  useAvailableSubagents,
  type CustomSubagent,
  type BuiltinSubagent,
} from "@/hooks/useCustomSubagents";
import { useSkills, type Skill } from "@/hooks/useSkills";
import { useChatChannels } from "@/hooks/useHumanTasks";
import {
  EntityContainer,
  EntityHeader,
  EntitySearch,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Target,
  Trash2,
  Eye,
  MoreVertical,
  Loader2,
  Radio,
  Pause,
  Play,
  Brain,
  Sparkles,
  ChevronDown,
  Bot,
  Pencil,
  Copy,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GOAL_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PLANNING: {
    label: "Planning",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  EXECUTING: {
    label: "Executing",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  AWAITING_APPROVAL: {
    label: "Awaiting Approval",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  REVIEWING: {
    label: "Reviewing",
    color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  },
  COMPLETE: {
    label: "Complete",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  FAILED: {
    label: "Failed",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
};

const tabs = [
  { id: "goals", label: "Goals" },
  { id: "watches", label: "Watches" },
  { id: "memories", label: "Memories" },
  { id: "agents", label: "Agents" },
] as const;

export function GoalsContentClient() {
  const [activeTab, setActiveTab] =
    useState<"goals" | "watches" | "memories" | "agents">("goals");
  const [search, setSearch] = useState("");
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [showCreateWatch, setShowCreateWatch] = useState(false);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [editingAgent, setEditingAgent] = useState<CustomSubagent | null>(null);
  const [cloneFrom, setCloneFrom] = useState<BuiltinSubagent | null>(null);

  const { data: goalsData, isLoading: goalsLoading } = useAgentGoals();
  const { data: watchesData, isLoading: watchesLoading } = useAgentWatches();
  const { data: subagentsData, isLoading: agentsLoading } = useCustomSubagents();
  const { data: availableData } = useAvailableSubagents();
  const createGoal = useCreateGoal();
  const deleteGoal = useDeleteGoal();
  const createWatch = useCreateWatch();
  const createAgent = useCreateCustomSubagent();
  const updateAgent = useUpdateCustomSubagent();
  const deleteAgent = useDeleteCustomSubagent();
  const router = useRouter();

  const goals = goalsData?.goals || [];
  const watches = watchesData?.watches || [];
  const agents = subagentsData?.subagents || [];
  const builtinAgents = availableData?.builtinSubagents || [];

  const filteredGoals = goals.filter(
    (g) =>
      !search.trim() ||
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.objective?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAgents = agents.filter(
    (a) =>
      !search.trim() ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description?.toLowerCase().includes(search.toLowerCase())
  );

  const newButtonLabel =
    activeTab === "watches"
      ? "New Watch"
      : activeTab === "goals"
        ? "New Goal"
        : activeTab === "agents"
          ? "New Agent"
          : undefined;
  const handleNew =
    activeTab === "goals"
      ? () => setShowCreateGoal(true)
      : activeTab === "watches"
        ? () => setShowCreateWatch(true)
        : activeTab === "agents"
          ? () => setShowCreateAgent(true)
          : undefined;

  return (
    <EntityContainer
      header={
        <EntityHeader
          title="AI Goals"
          description="Set high-level goals for AI agents to decompose, execute, and report on."
          newButtonLabel={newButtonLabel ?? "New"}
          onNew={handleNew ?? (() => {})}
          isCreating={createGoal.isPending || createWatch.isPending || createAgent.isPending}
          disabled={activeTab === "memories"}
        />
      }
      search={
        activeTab === "goals" && !goalsLoading && goals.length > 0 ? (
          <EntitySearch value={search} onChange={setSearch} placeholder="Search goals" />
        ) : activeTab === "agents" && !agentsLoading && agents.length > 0 ? (
          <EntitySearch value={search} onChange={setSearch} placeholder="Search agents" />
        ) : undefined
      }
    >
      {/* Tabs */}
      <div className="flex gap-1 border-b -mt-4">
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
          </button>
        ))}
      </div>

      {/* Goals Tab */}
      {activeTab === "goals" && (
        <>
          {goalsLoading ? (
            <LoadingView message="Loading goals..." />
          ) : goals.length === 0 ? (
            <EmptyView
              message="No goals yet. Create your first goal to get started."
              onNew={() => setShowCreateGoal(true)}
              isCreating={createGoal.isPending}
            />
          ) : filteredGoals.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center py-12 text-muted-foreground">
              <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No goals match your search.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-y-3">
              {filteredGoals.map((goal) => {
                const taskStatuses = goal.tasks || [];
                const completed = taskStatuses.filter((t: any) => t.status === "COMPLETE").length;
                const total = taskStatuses.length;
                const statusConfig = GOAL_STATUS_CONFIG[goal.status] || {
                  label: goal.status,
                  color: "bg-gray-100 text-gray-700",
                };

                return (
                  <Card key={goal.id} className="shadow-none hover:shadow transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-sm truncate">{goal.name}</span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs font-medium whitespace-nowrap",
                                statusConfig.color
                              )}
                            >
                              {statusConfig.label}
                            </Badge>
                          </div>
                          {goal.objective && (
                            <p className="text-xs text-muted-foreground truncate">
                              {goal.objective}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {total > 0 ? `${completed}/${total} tasks` : "Pending decomposition"}
                            </span>
                            <span>{new Date(goal.createdAt).toLocaleDateString()}</span>
                          </div>
                          {total > 0 && (
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${(completed / total) * 100}%` }}
                              />
                            </div>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/goals/${goal.id}`)}>
                              <Eye className="h-4 w-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteGoal.mutate({ goalId: goal.id })}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Watches Tab */}
      {activeTab === "watches" && (
        <>
          {watchesLoading ? (
            <LoadingView message="Loading watches..." />
          ) : watches.length === 0 ? (
            <EmptyView
              message="No watches configured yet. Create a watch to trigger agents on a schedule."
              onNew={() => setShowCreateWatch(true)}
              isCreating={createWatch.isPending}
            />
          ) : (
            <div className="flex flex-col gap-y-3">
              {watches.map((watch) => (
                <WatchCard key={watch.id} watch={watch} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Memories Tab */}
      {activeTab === "memories" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center py-12 text-muted-foreground">
          <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            Global agent memories appear here. Open a specific goal to see its memories.
          </p>
        </div>
      )}

      {/* Agents Tab */}
      {activeTab === "agents" && (
        <>
          {agentsLoading ? (
            <LoadingView message="Loading agents..." />
          ) : (
            <div className="flex flex-col gap-y-6">
              {/* Built-in Agents */}
              {builtinAgents.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Built-in Agents
                  </h3>
                  <div className="flex flex-col gap-y-3">
                    {builtinAgents.map((agent) => (
                      <BuiltinAgentCard
                        key={agent.slug}
                        agent={agent}
                        onClone={() => {
                          setShowCreateAgent(true);
                          setCloneFrom(agent);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Agents */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Custom Agents
                </h3>
                {agents.length === 0 ? (
                  <EmptyView
                    message="No custom agents yet. Build your first agent to join your AI goal teams."
                    onNew={() => setShowCreateAgent(true)}
                    isCreating={createAgent.isPending}
                  />
                ) : filteredAgents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-8 text-muted-foreground">
                    <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No agents match your search.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-y-3">
                    {filteredAgents.map((agent) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        onEdit={() => setEditingAgent(agent)}
                        onToggle={(isActive) =>
                          updateAgent.mutate({ id: agent.id, data: { isActive } })
                        }
                        onDelete={() => deleteAgent.mutate({ id: agent.id })}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Goal Dialog */}
      <CreateGoalDialog
        open={showCreateGoal}
        onClose={() => setShowCreateGoal(false)}
        onCreate={(data) => {
          createGoal.mutate(data, {
            onSuccess: (res) => {
              setShowCreateGoal(false);
              router.push(`/goals/${res.goal.id}`);
            },
          });
        }}
        isPending={createGoal.isPending}
      />

      {/* Create Watch Dialog */}
      <CreateWatchDialog
        open={showCreateWatch}
        onClose={() => setShowCreateWatch(false)}
        onCreate={(data) => {
          createWatch.mutate(data, { onSuccess: () => setShowCreateWatch(false) });
        }}
        isPending={createWatch.isPending}
      />

      {/* Create Agent Dialog */}
      <AgentFormDialog
        open={showCreateAgent}
        onClose={() => {
          setShowCreateAgent(false);
          setCloneFrom(null);
        }}
        onSubmit={(data) => {
          createAgent.mutate(data, {
            onSuccess: () => {
              setShowCreateAgent(false);
              setCloneFrom(null);
            },
          });
        }}
        isPending={createAgent.isPending}
        cloneFrom={cloneFrom}
      />

      {/* Edit Agent Dialog */}
      <AgentFormDialog
        open={!!editingAgent}
        onClose={() => setEditingAgent(null)}
        onSubmit={(data) => {
          if (!editingAgent) return;
          updateAgent.mutate(
            { id: editingAgent.id, data },
            { onSuccess: () => setEditingAgent(null) }
          );
        }}
        isPending={updateAgent.isPending}
        initialData={editingAgent}
      />
    </EntityContainer>
  );
}

function WatchCard({ watch }: { watch: any }) {
  const pauseWatch = usePauseWatch();
  const resumeWatch = useResumeWatch();

  return (
    <Card className="shadow-none">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{watch.name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {watch.triggerType}
            </Badge>
            {watch.cronExpression && (
              <span className="text-xs text-muted-foreground">Cron: {watch.cronExpression}</span>
            )}
            {watch.lastFiredAt && (
              <span className="text-xs text-muted-foreground">
                Last fired: {new Date(watch.lastFiredAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              watch.status === "ACTIVE"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            )}
          >
            {watch.status}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              watch.status === "ACTIVE"
                ? pauseWatch.mutate({ watchId: watch.id })
                : resumeWatch.mutate({ watchId: watch.id })
            }
            title={watch.status === "ACTIVE" ? "Pause" : "Resume"}
          >
            {watch.status === "ACTIVE" ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateGoalDialog({
  open,
  onClose,
  onCreate,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: any) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({ name: "", objective: "", reportingChannelId: "" });
  const [selectedDeliveryActions, setSelectedDeliveryActions] = useState<DeliveryAction[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiFill, setShowAiFill] = useState(false);
  const { data: deliveryActionsData } = useDeliveryActions();
  const { data: channelsData } = useChatChannels();
  const aiFillGoal = useAiFillGoal();

  const reset = () => {
    setForm({ name: "", objective: "", reportingChannelId: "" });
    setSelectedDeliveryActions([]);
    setAiPrompt("");
    setShowAiFill(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          reset();
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
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", showAiFill && "rotate-180")}
              />
            </button>
            {showAiFill && (
              <div className="px-4 py-3 space-y-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Describe what you want to achieve and the AI will generate the goal name and
                  objective.
                </p>
                <textarea
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm min-h-[140px] resize-y"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder='e.g. "Increase social media engagement by 50% over the next quarter by posting daily on LinkedIn and Twitter"'
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (!aiPrompt.trim()) return;
                    aiFillGoal.mutate(
                      { prompt: aiPrompt },
                      {
                        onSuccess: (data) => {
                          setForm((prev) => ({
                            ...prev,
                            name: data.fields.name || prev.name,
                            objective: data.fields.objective || prev.objective,
                          }));
                          setAiPrompt("");
                          setShowAiFill(false);
                        },
                      }
                    );
                  }}
                  disabled={!aiPrompt.trim() || aiFillGoal.isPending}
                >
                  {aiFillGoal.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      Generate Goal
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <input
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Goal name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Objective *</label>
              <textarea
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm min-h-[100px]"
                value={form.objective}
                onChange={(e) => setForm({ ...form, objective: e.target.value })}
                placeholder="Describe what this goal should achieve..."
              />
            </div>
          </div>

          <hr />

          {/* Reporting */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Reporting
            </h3>
            <div>
              <label className="text-sm font-medium">Chat Channel</label>
              <p className="text-xs text-muted-foreground mb-1">
                Send reports via a connected chat integration
              </p>
              <select
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={form.reportingChannelId}
                onChange={(e) => setForm({ ...form, reportingChannelId: e.target.value })}
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
            <Button
              variant="outline"
              onClick={() => {
                onClose();
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const hasComposio = selectedDeliveryActions.length > 0;
                const hasChannel = !!form.reportingChannelId;
                const deliveryConfig: DeliveryConfig | undefined =
                  hasComposio || hasChannel
                    ? {
                        messagingChannel: hasChannel,
                        composioActions: hasComposio ? selectedDeliveryActions : undefined,
                      }
                    : undefined;
                onCreate({ ...form, deliveryConfig });
              }}
              disabled={!form.name || !form.objective || isPending}
            >
              {isPending ? "Creating..." : "Create Goal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateWatchDialog({
  open,
  onClose,
  onCreate,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: any) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    triggerType: "CRON",
    cronExpression: "",
    actionWorkflowId: "",
  });

  const reset = () =>
    setForm({ name: "", triggerType: "CRON", cronExpression: "", actionWorkflowId: "" });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          reset();
        }
      }}
    >
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Watch</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div>
            <label className="text-sm font-medium">Name *</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Watch name"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Trigger Type</label>
            <select
              className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
              value={form.triggerType}
              onChange={(e) => setForm({ ...form, triggerType: e.target.value })}
            >
              <option value="CRON">Cron Schedule</option>
              <option value="THRESHOLD">Threshold</option>
              <option value="WEBHOOK_EVENT">Webhook Event</option>
            </select>
          </div>
          {form.triggerType === "CRON" && (
            <div>
              <label className="text-sm font-medium">Cron Expression</label>
              <input
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={form.cronExpression}
                onChange={(e) => setForm({ ...form, cronExpression: e.target.value })}
                placeholder="*/5 * * * *"
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                onClose();
                reset();
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => onCreate(form)} disabled={!form.name || isPending}>
              {isPending ? "Creating..." : "Create Watch"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BuiltinAgentCard({
  agent,
  onClone,
}: {
  agent: BuiltinSubagent;
  onClone: () => void;
}) {
  return (
    <Card className="shadow-none border-dashed">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Cpu className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-sm truncate">{agent.name}</span>
              <Badge
                variant="secondary"
                className="text-xs font-medium whitespace-nowrap bg-primary/10 text-primary"
              >
                Built-in
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{agent.description}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClone}
            className="shrink-0 text-xs gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" /> Clone
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentCard({
  agent,
  onEdit,
  onToggle,
  onDelete,
}: {
  agent: CustomSubagent;
  onEdit: () => void;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <Card className="shadow-none hover:shadow transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-sm truncate">{agent.name}</span>
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  agent.isActive
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400"
                )}
              >
                {agent.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            {agent.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{agent.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {agent.skillIds.length > 0 && (
                <span>
                  {agent.skillIds.length} skill{agent.skillIds.length !== 1 ? "s" : ""}
                </span>
              )}
              <span>Max {agent.maxTurns} turns</span>
              <span>{new Date(agent.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Switch
              checked={agent.isActive}
              onCheckedChange={onToggle}
              className="scale-90"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentFormDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  initialData,
  cloneFrom,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
  initialData?: CustomSubagent | null;
  cloneFrom?: BuiltinSubagent | null;
}) {
  const isEdit = !!initialData;
  const { data: skillsData } = useSkills(1, 100);
  const skills = skillsData?.skills || [];

  const [form, setForm] = useState({
    name: "",
    description: "",
    prompt: "",
    skillIds: [] as string[],
    maxTurns: 8,
  });

  const resetToDefaults = () =>
    setForm({ name: "", description: "", prompt: "", skillIds: [], maxTurns: 8 });

  const loadFromAgent = (agent: CustomSubagent) =>
    setForm({
      name: agent.name,
      description: agent.description,
      prompt: agent.prompt,
      skillIds: agent.skillIds || [],
      maxTurns: agent.maxTurns,
    });

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      onClose();
      resetToDefaults();
    } else if (initialData) {
      loadFromAgent(initialData);
    } else if (cloneFrom) {
      setForm({
        name: `${cloneFrom.name} (Custom)`,
        description: cloneFrom.description,
        prompt: "",
        skillIds: [],
        maxTurns: 8,
      });
    }
  };

  // Sync form when initialData changes (for edit mode)
  const [prevId, setPrevId] = useState<string | null>(null);
  if (initialData && initialData.id !== prevId) {
    setPrevId(initialData.id);
    loadFromAgent(initialData);
  }
  if (!initialData && prevId) {
    setPrevId(null);
  }

  // Sync form when cloneFrom changes
  const [prevClone, setPrevClone] = useState<string | null>(null);
  if (cloneFrom && cloneFrom.slug !== prevClone) {
    setPrevClone(cloneFrom.slug);
    setForm({
      name: `${cloneFrom.name} (Custom)`,
      description: cloneFrom.description,
      prompt: "",
      skillIds: [],
      maxTurns: 8,
    });
  }
  if (!cloneFrom && prevClone) {
    setPrevClone(null);
  }

  const toggleSkill = (skillId: string) => {
    setForm((prev) => ({
      ...prev,
      skillIds: prev.skillIds.includes(skillId)
        ? prev.skillIds.filter((id) => id !== skillId)
        : [...prev.skillIds, skillId],
    }));
  };

  const isValid = form.name.trim() && form.description.trim() && form.prompt.trim();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Agent" : "Create Agent"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2 overflow-y-auto flex-1 pr-1 -mr-1">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <input
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sales Researcher"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description *</label>
              <input
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What this agent specialises in"
              />
            </div>
            <div>
              <label className="text-sm font-medium">System Prompt *</label>
              <p className="text-xs text-muted-foreground mb-1">
                Instructions that define how this agent behaves and responds.
              </p>
              <textarea
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm min-h-[120px] resize-y"
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder="You are a specialised agent that..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Max Turns</label>
              <p className="text-xs text-muted-foreground mb-1">
                Maximum conversation turns before the agent stops.
              </p>
              <input
                type="number"
                min={1}
                max={50}
                className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                value={form.maxTurns}
                onChange={(e) =>
                  setForm({ ...form, maxTurns: Math.max(1, parseInt(e.target.value) || 8) })
                }
              />
            </div>
          </div>

          {skills.length > 0 && (
            <>
              <hr />
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Skills
                </h3>
                <p className="text-xs text-muted-foreground">
                  Attach skills to give this agent specialised knowledge.
                </p>
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {skills.map((skill: Skill) => {
                    const isSelected = form.skillIds.includes(skill.id);
                    return (
                      <label
                        key={skill.id}
                        className="flex items-start gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSkill(skill.id)}
                          className="rounded border-input mt-0.5"
                        />
                        <div className="min-w-0">
                          <span className="font-medium">{skill.name}</span>
                          {skill.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {skill.description}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                onClose();
                resetToDefaults();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => onSubmit(form)}
              disabled={!isValid || isPending}
            >
              {isPending
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save Changes"
                  : "Create Agent"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
