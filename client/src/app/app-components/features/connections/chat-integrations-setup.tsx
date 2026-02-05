"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useChatIntegrations,
  useChatIntegrationSecret,
  useUpdateChatIntegration,
  useSaveTelegramBotToken,
  useRegenerateChatIntegrationSecret,
  useTestChatIntegrationConnection,
  useExternalIdentities,
  useUnlinkExternalIdentity,
  useCreateChatIntegration,
} from "@/hooks/useChatIntegrations";
import { useWorkflows } from "@/hooks/useWorkflows";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
  TestTube2,
  Loader2,
  XCircle,
  Trash2,
  Link,
  Unlink,
  CheckCircle2,
  ShieldCheck,
  ShieldX,
  Bot,
  KeyRound,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// ============================================
// Main ChatIntegration Setup Component
// ============================================

export function ChatIntegrationsSetup({
  initialIntegrationId,
  hideCreate = false,
  hideIntegrationSelector = false,
  createOnly = false,
}: {
  initialIntegrationId?: string;
  hideCreate?: boolean;
  hideIntegrationSelector?: boolean;
  createOnly?: boolean;
}) {
  const router = useRouter();
  const { data: integrationsData, isLoading, error } = useChatIntegrations();
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>("");
  const { data: secretData, isLoading: secretLoading } = useChatIntegrationSecret(
    selectedIntegrationId || undefined
  );
  const {
    data: identitiesData,
    isLoading: identitiesLoading,
    refetch: refetchIdentities,
  } = useExternalIdentities(selectedIntegrationId || undefined);
  const { data: workflowsData } = useWorkflows(1, 100);

  const updateIntegration = useUpdateChatIntegration(selectedIntegrationId || "");
  const saveTelegramToken = useSaveTelegramBotToken(selectedIntegrationId || "");
  const regenerateSecret = useRegenerateChatIntegrationSecret(selectedIntegrationId || "");
  const testConnection = useTestChatIntegrationConnection(selectedIntegrationId || "");
  const unlinkIdentity = useUnlinkExternalIdentity(selectedIntegrationId || undefined);
  const createIntegration = useCreateChatIntegration();

  const [showSecret, setShowSecret] = useState(false);
  const [secretJustRegenerated, setSecretJustRegenerated] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [labelDraft, setLabelDraft] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newPlatform, setNewPlatform] = useState<"TELEGRAM" | "WHATSAPP" | "DISCORD" | "SLACK">(
    "TELEGRAM"
  );
  const [newScope, setNewScope] = useState<"SINGLE_WORKFLOW" | "ALL_WORKFLOWS" | "ALLOW_LIST">(
    "ALL_WORKFLOWS"
  );
  const [newScopeWorkflowId, setNewScopeWorkflowId] = useState("none");
  const [newAllowedWorkflowIds, setNewAllowedWorkflowIds] = useState<string[]>([]);

  useEffect(() => {
    if (initialIntegrationId) {
      setSelectedIntegrationId(initialIntegrationId);
      return;
    }
    if (integrationsData?.integrations?.length && !selectedIntegrationId) {
      setSelectedIntegrationId(integrationsData.integrations[0].id);
    }
  }, [integrationsData?.integrations, selectedIntegrationId, initialIntegrationId]);

  useEffect(() => {
    const integration = integrationsData?.integrations?.find(
      (item) => item.id === selectedIntegrationId
    );
    if (integration?.telegramBotTokenSet) {
      setBotToken("");
    }
    if (integration?.label) {
      setLabelDraft(integration.label);
    }
  }, [integrationsData?.integrations, selectedIntegrationId]);

  if (isLoading) {
    return <ChatIntegrationsSetupSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Failed to load Chat Integration integration</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const integrations = integrationsData?.integrations || [];
  const integration = integrationsData?.integrations?.find(
    (item) => item.id === selectedIntegrationId
  );
  const identities = identitiesData?.identities || [];
  const workflows = workflowsData?.workflows || [];
  const telegramLinked = identities.some((identity) => identity.platform === "telegram");
  const tokenSaved = !!integration?.telegramBotTokenSet;

  const handleCreateIntegration = () => {
    if (!newLabel.trim()) {
      toast.error("Please enter a label for this integration.");
      return;
    }
    const scopeWorkflowId =
      newScope === "SINGLE_WORKFLOW"
        ? newScopeWorkflowId === "none"
          ? null
          : newScopeWorkflowId
        : null;
    const allowedWorkflowIds = newScope === "ALLOW_LIST" ? newAllowedWorkflowIds : [];
    createIntegration.mutate(
      {
        label: newLabel.trim(),
        platform: newPlatform,
        scope: newScope,
        scopeWorkflowId,
        allowedWorkflowIds,
      },
      {
        onSuccess: (result) => {
          setNewLabel("");
          setNewScopeWorkflowId("none");
          setNewAllowedWorkflowIds([]);
          setSelectedIntegrationId(result.integration.id);
          // If in createOnly mode, navigate back to integrations page
          if (createOnly) {
            router.push("/integrations");
          }
        },
      }
    );
  };

  // If createOnly is true, only show the create form
  if (createOnly && !hideCreate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create New Integration</CardTitle>
          <CardDescription>Set up a new chat integration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label>Integration Label</Label>
              <Input
                placeholder="e.g. Support Bot"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={newPlatform} onValueChange={(value) => setNewPlatform(value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TELEGRAM">Telegram</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp (coming soon)</SelectItem>
                  <SelectItem value="DISCORD">Discord (coming soon)</SelectItem>
                  <SelectItem value="SLACK">Slack (coming soon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Workflow Scope</Label>
            <Select value={newScope} onValueChange={(value) => setNewScope(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_WORKFLOWS">All workflows</SelectItem>
                <SelectItem value="SINGLE_WORKFLOW">Single workflow</SelectItem>
                <SelectItem value="ALLOW_LIST">Allow list</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {newScope === "SINGLE_WORKFLOW" && (
            <div className="space-y-2">
              <Label>Scoped Workflow</Label>
              <Select value={newScopeWorkflowId} onValueChange={setNewScopeWorkflowId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select workflow" />
                </SelectTrigger>
                <SelectContent side="bottom" className="max-h-[300px] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]">
                  <SelectItem value="none">None</SelectItem>
                  {workflows.map((workflow) => (
                    <SelectItem key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {newScope === "ALLOW_LIST" && (
            <div className="space-y-2">
              <Label>Allowed Workflows</Label>
              <div className="max-h-[300px] overflow-y-auto rounded-md border p-2">
                <div className="grid gap-2 md:grid-cols-2">
                  {workflows.map((workflow) => {
                    const checked = newAllowedWorkflowIds.includes(workflow.id);
                    return (
                      <label
                        key={workflow.id}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setNewAllowedWorkflowIds((current) =>
                              e.target.checked
                                ? Array.from(new Set([...current, workflow.id]))
                                : current.filter((id) => id !== workflow.id)
                            );
                          }}
                        />
                        <span>{workflow.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button onClick={handleCreateIntegration} disabled={createIntegration.isPending}>
              {createIntegration.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Integration
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (integrations.length === 0 && !hideCreate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create a new integration interface</CardTitle>
          <CardDescription>Set up your first chat integration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Label</Label>
            <Input
              placeholder="e.g. Marketing Bot"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={newPlatform} onValueChange={(value) => setNewPlatform(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TELEGRAM">Telegram</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp (coming soon)</SelectItem>
                <SelectItem value="DISCORD">Discord (coming soon)</SelectItem>
                <SelectItem value="SLACK">Slack (coming soon)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Scope</Label>
            <Select value={newScope} onValueChange={(value) => setNewScope(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_WORKFLOWS">All workflows</SelectItem>
                <SelectItem value="SINGLE_WORKFLOW">Single workflow</SelectItem>
                <SelectItem value="ALLOW_LIST">Allow list</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {newScope === "SINGLE_WORKFLOW" && (
            <div className="space-y-2">
              <Label>Scoped Workflow</Label>
              <Select value={newScopeWorkflowId} onValueChange={setNewScopeWorkflowId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select workflow" />
                </SelectTrigger>
                <SelectContent side="bottom" className="max-h-[300px] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]">
                  <SelectItem value="none">None</SelectItem>
                  {workflows.map((workflow) => (
                    <SelectItem key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {newScope === "ALLOW_LIST" && (
            <div className="space-y-2">
              <Label>Allowed Workflows</Label>
              <div className="max-h-[300px] overflow-y-auto rounded-md border p-2">
                <div className="grid gap-2 md:grid-cols-2">
                  {workflows.map((workflow) => {
                    const checked = newAllowedWorkflowIds.includes(workflow.id);
                    return (
                      <label
                        key={workflow.id}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setNewAllowedWorkflowIds((current) =>
                              e.target.checked
                                ? Array.from(new Set([...current, workflow.id]))
                                : current.filter((id) => id !== workflow.id)
                            );
                          }}
                        />
                        <span>{workflow.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button onClick={handleCreateIntegration} disabled={createIntegration.isPending}>
              {createIntegration.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Integration
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (integrations.length === 0 && hideCreate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No integrations available</CardTitle>
          <CardDescription>Create an integration to continue.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleCopyWebhook = () => {
    if (integration?.webhookUrl) {
      navigator.clipboard.writeText(integration.webhookUrl);
      toast.success("Webhook URL copied to clipboard");
    }
  };

  const handleCopySecret = () => {
    if (secretData?.sharedSecret) {
      navigator.clipboard.writeText(secretData.sharedSecret);
      toast.success("Shared secret copied to clipboard");
    }
  };

  const handleRegenerateSecret = async () => {
    await regenerateSecret.mutateAsync();
    setSecretJustRegenerated(true);
    setShowSecret(true);
  };

  const handleSaveBotToken = async () => {
    const trimmed = botToken.trim();
    if (!trimmed) {
      toast.error("Please paste your Telegram bot token.");
      return;
    }
    if (!integration?.id) {
      toast.error("Select an integration first.");
      return;
    }
    if (integration.platform !== "TELEGRAM") {
      toast.error("Telegram token can only be set for Telegram integrations.");
      return;
    }
    await saveTelegramToken.mutateAsync({ telegramBotToken: trimmed });
    setBotToken("");
  };

  const handleToggleActive = (checked: boolean) => {
    updateIntegration.mutate({ isActive: checked });
  };

  const handleTogglePlanMode = (checked: boolean) => {
    updateIntegration.mutate({ allowPlanMode: checked });
  };

  const handleToggleWorkflowExecution = (checked: boolean) => {
    updateIntegration.mutate({ allowWorkflowExecution: checked });
  };

  const handleDefaultWorkflowChange = (workflowId: string) => {
    if (!integration?.id) {
      toast.error("Select an integration first.");
      return;
    }
    updateIntegration.mutate({
      defaultWorkflowId: workflowId === "none" ? null : workflowId,
    });
  };

  const handleLabelSave = () => {
    if (!labelDraft.trim()) {
      toast.error("Label cannot be empty.");
      return;
    }
    if (!integration?.id) {
      toast.error("Select an integration first.");
      return;
    }
    updateIntegration.mutate({ label: labelDraft.trim() });
  };

  const handlePlatformChange = (platform: string) => {
    if (!integration?.id) {
      toast.error("Select an integration first.");
      return;
    }
    updateIntegration.mutate({ platform: platform as any });
  };

  const handleScopeChange = (scope: string) => {
    if (!integration?.id) {
      toast.error("Select an integration first.");
      return;
    }
    updateIntegration.mutate({
      scope: scope as any,
      scopeWorkflowId: scope === "SINGLE_WORKFLOW" ? integration?.scopeWorkflowId || null : null,
      allowedWorkflowIds: scope === "ALLOW_LIST" ? integration?.allowedWorkflowIds || [] : [],
    });
  };

  const handleScopeWorkflowChange = (workflowId: string) => {
    if (!integration?.id) {
      toast.error("Select an integration first.");
      return;
    }
    updateIntegration.mutate({
      scopeWorkflowId: workflowId === "none" ? null : workflowId,
    });
  };

  const handleAllowListToggle = (workflowId: string, checked: boolean) => {
    if (!integration?.id) {
      toast.error("Select an integration first.");
      return;
    }
    const current = integration?.allowedWorkflowIds || [];
    const next = checked
      ? Array.from(new Set([...current, workflowId]))
      : current.filter((id) => id !== workflowId);
    updateIntegration.mutate({ allowedWorkflowIds: next });
  };

  const handleUnlinkIdentity = (platform: string, externalId: string) => {
    unlinkIdentity.mutate({ platform, externalId });
  };

  return (
    <div className="space-y-6">
      {!hideCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Integration
            </CardTitle>
            <CardDescription>Select or create a chat integration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hideIntegrationSelector && (
              <div className="space-y-2">
                <Label>Active Integration</Label>
                <Select value={selectedIntegrationId} onValueChange={setSelectedIntegrationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select integration" />
                  </SelectTrigger>
                  <SelectContent>
                    {integrations.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label} • {item.platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label>New Integration Label</Label>
                <Input
                  placeholder="e.g. Support Bot"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={newPlatform} onValueChange={(value) => setNewPlatform(value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TELEGRAM">Telegram</SelectItem>
                    <SelectItem value="WHATSAPP">WhatsApp (coming soon)</SelectItem>
                    <SelectItem value="DISCORD">Discord (coming soon)</SelectItem>
                    <SelectItem value="SLACK">Slack (coming soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Workflow Scope</Label>
              <Select value={newScope} onValueChange={(value) => setNewScope(value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_WORKFLOWS">All workflows</SelectItem>
                  <SelectItem value="SINGLE_WORKFLOW">Single workflow</SelectItem>
                  <SelectItem value="ALLOW_LIST">Allow list</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newScope === "SINGLE_WORKFLOW" && (
              <div className="space-y-2">
                <Label>Scoped Workflow</Label>
                <Select value={newScopeWorkflowId} onValueChange={setNewScopeWorkflowId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select workflow" />
                  </SelectTrigger>
                  <SelectContent side="bottom" className="max-h-[300px] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]">
                    <SelectItem value="none">None</SelectItem>
                    {workflows.map((workflow) => (
                      <SelectItem key={workflow.id} value={workflow.id}>
                        {workflow.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {newScope === "ALLOW_LIST" && (
              <div className="space-y-2">
                <Label>Allowed Workflows</Label>
                <div className="max-h-[300px] overflow-y-auto rounded-md border p-2">
                  <div className="grid gap-2 md:grid-cols-2">
                    {workflows.map((workflow) => {
                      const checked = newAllowedWorkflowIds.includes(workflow.id);
                      return (
                        <label
                          key={workflow.id}
                          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setNewAllowedWorkflowIds((current) =>
                                e.target.checked
                                  ? Array.from(new Set([...current, workflow.id]))
                                  : current.filter((id) => id !== workflow.id)
                              );
                            }}
                          />
                          <span>{workflow.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button onClick={handleCreateIntegration} disabled={createIntegration.isPending}>
                {createIntegration.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Integration
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Header */}
      {/* <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <img
                  src="https://chatIntegration.ai/favicon.ico"
                  alt="ChatIntegration"
                  className="h-6 w-6"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                ChatIntegration Setup
              </CardTitle>
              <CardDescription>
                Verxio hosts the ChatIntegration gateway so users never install anything.
              </CardDescription>
            </div>
            <Badge variant={integration?.isActive ? "default" : "secondary"}>
              {integration?.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
      </Card> */}

      {/* Step 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Step 1 — Create a Telegram Bot
          </CardTitle>
          <CardDescription>Create a bot with BotFather and copy the token.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Open Telegram and message <span className="font-mono">@BotFather</span>.
            </li>
            <li>
              Run <span className="font-mono">/newbot</span> and follow the prompts.
            </li>
            <li>
              Copy the bot token (looks like <span className="font-mono">123:ABC...</span>).
            </li>
          </ol>
          <Button variant="outline" asChild>
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open BotFather
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Step 2 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Step 2 — Save Bot Token
          </CardTitle>
          <CardDescription>Paste your Telegram bot token and save it here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {integration?.platform !== "TELEGRAM" && (
            <Badge variant="outline">
              Token setup is only available for Telegram integrations right now.
            </Badge>
          )}
          <div className="flex flex-col gap-2">
            <Label>Telegram Bot Token</Label>
            <Input
              type="password"
              placeholder="123:ABC..."
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              disabled={integration?.platform !== "TELEGRAM"}
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSaveBotToken}
                disabled={saveTelegramToken.isPending || integration?.platform !== "TELEGRAM"}
              >
                {saveTelegramToken.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Token
              </Button>
              {tokenSaved && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Token saved
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 3 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Step 3 — Link Your Telegram Account
          </CardTitle>
          <CardDescription>Send a message to your bot to link your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal pl-5 space-y-2">
            <li>Open Telegram and DM your bot.</li>
            <li>Say “hi” or any message.</li>
            <li>Verxio will automatically link your account.</li>
          </ol>
          <div className="flex items-center gap-2">
            {telegramLinked ? (
              <Badge className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Linked
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                <ShieldX className="h-3 w-3" />
                Not linked
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchIdentities()}
              disabled={identitiesLoading}
            >
              {identitiesLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              Refresh status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 4 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TestTube2 className="h-4 w-4" />
            Step 4 — Test Connection
          </CardTitle>
          <CardDescription>Verify Verxio can receive updates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {integration?.platform !== "TELEGRAM" && (
            <Badge variant="outline">
              Connection test is available for Telegram integrations only.
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={() => testConnection.mutate()}
            disabled={
              testConnection.isPending || !integration?.id || integration?.platform !== "TELEGRAM"
            }
          >
            {testConnection.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TestTube2 className="h-4 w-4 mr-2" />
            )}
            Run Test
          </Button>
          {testConnection.data && (
            <p className="text-sm text-muted-foreground">{testConnection.data.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
          <CardDescription>Control how ChatIntegration can interact with your workflows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Label</Label>
            <div className="flex flex-col gap-2 md:flex-row">
              <Input value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)} />
              <Button
                variant="outline"
                onClick={handleLabelSave}
                disabled={updateIntegration.isPending}
              >
                Save Label
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={integration?.platform} onValueChange={handlePlatformChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TELEGRAM">Telegram</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp (coming soon)</SelectItem>
                <SelectItem value="DISCORD">Discord (coming soon)</SelectItem>
                <SelectItem value="SLACK">Slack (coming soon)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Workflow Scope</Label>
            <Select value={integration?.scope} onValueChange={handleScopeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_WORKFLOWS">All workflows</SelectItem>
                <SelectItem value="SINGLE_WORKFLOW">Single workflow</SelectItem>
                <SelectItem value="ALLOW_LIST">Allow list</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {integration?.scope === "SINGLE_WORKFLOW" && (
            <div className="space-y-2">
              <Label>Scoped Workflow</Label>
              <Select
                value={integration?.scopeWorkflowId || "none"}
                onValueChange={handleScopeWorkflowChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select workflow" />
                </SelectTrigger>
                <SelectContent side="bottom" className="max-h-[300px] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]">
                  <SelectItem value="none">None</SelectItem>
                  {workflows.map((workflow) => (
                    <SelectItem key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {integration?.scope === "ALLOW_LIST" && (
            <div className="space-y-2">
              <Label>Allowed Workflows</Label>
              <div className="max-h-[300px] overflow-y-auto rounded-md border p-2">
                <div className="grid gap-2 md:grid-cols-2">
                  {workflows.map((workflow) => {
                    const checked = integration?.allowedWorkflowIds?.includes(workflow.id) || false;
                    return (
                      <label
                        key={workflow.id}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => handleAllowListToggle(workflow.id, e.target.checked)}
                        />
                        <span>{workflow.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label>Integration Active</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable the Chat Integration integration.
              </p>
            </div>
            <Switch
              checked={integration?.isActive || false}
              onCheckedChange={handleToggleActive}
              disabled={updateIntegration.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Allow Plan Mode</Label>
              <p className="text-sm text-muted-foreground">
                Let ChatIntegration create and modify workflows using plan mode.
              </p>
            </div>
            <Switch
              checked={integration?.allowPlanMode || false}
              onCheckedChange={handleTogglePlanMode}
              disabled={updateIntegration.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Allow Workflow Execution</Label>
              <p className="text-sm text-muted-foreground">
                Let ChatIntegration trigger workflow runs from chat commands.
              </p>
            </div>
            <Switch
              checked={integration?.allowWorkflowExecution || false}
              onCheckedChange={handleToggleWorkflowExecution}
              disabled={updateIntegration.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>Default Workflow for Planning</Label>
            <Select
              value={integration?.defaultWorkflowId || "none"}
              onValueChange={handleDefaultWorkflowChange}
              disabled={updateIntegration.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a workflow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Create new workflow for each session</SelectItem>
                {workflows.map((workflow) => (
                  <SelectItem key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Advanced */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
          <CardDescription>Webhook URL and shared secret for your chat integration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                value={integration?.webhookUrl || ""}
                readOnly
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Shared Secret</Label>
            <div className="flex gap-2">
              <Input
                type={showSecret ? "text" : "password"}
                value={
                  secretLoading
                    ? "Loading..."
                    : showSecret
                      ? secretData?.sharedSecret || ""
                      : integration?.secretPreview || "••••••••••••"
                }
                readOnly
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              {showSecret && (
                <Button variant="outline" size="icon" onClick={handleCopySecret}>
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Add this secret to the X-ChatIntegration-Secret header in your ChatIntegration config.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Regenerate
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerate Shared Secret?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will invalidate your current secret. You&apos;ll need to update your
                      ChatIntegration configuration with the new secret.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRegenerateSecret}
                      disabled={regenerateSecret.isPending}
                    >
                      {regenerateSecret.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Regenerate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            {secretJustRegenerated && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  <strong>Important:</strong> Copy the new secret above and update your ChatIntegration
                  configuration. The old secret will no longer work.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Linked Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked Accounts</CardTitle>
          <CardDescription>Accounts linked to Verxio through ChatIntegration.</CardDescription>
        </CardHeader>
        <CardContent>
          {identities.length === 0 ? (
            <div className="text-center py-8">
              <Link className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">No linked accounts yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {identities.map((identity) => (
                <div
                  key={identity.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
                      {identity.platform === "telegram" ? (
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                        </svg>
                      ) : (
                        <span className="text-xs font-medium uppercase">
                          {identity.platform.slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{identity.externalName || identity.externalId}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {identity.platform}
                        </Badge>
                        <span>
                          Linked{" "}
                          {formatDistanceToNow(new Date(identity.linkedAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Unlink Account?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will disconnect your {identity.platform} account from Verxio.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            handleUnlinkIdentity(identity.platform, identity.externalId)
                          }
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Unlink
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Loading Skeleton
// ============================================

function ChatIntegrationsSetupSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-80 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48 mt-1" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
