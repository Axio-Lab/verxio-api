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
  useRefreshTelegramWebhook,
  useConnectWhatsApp,
  useWhatsAppStatus,
  useSaveSlackBotToken,
  useSaveDiscordBotToken,
  useGenerateSoulMd,
  useSaveSoulMd,
} from "@/hooks/useChatIntegrations";
import { useWorkflows } from "@/hooks/useWorkflows";
import { useSkills } from "@/hooks/useSkills";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Sparkles,
  Upload,
  FileText,
  Wand2,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import NextLink from "next/link";
import { EntityPagination } from "@/app/app-components/features/editor/entity-component";

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
  const [identitiesPage, setIdentitiesPage] = useState(1);
  const IDENTITIES_PAGE_SIZE = 5;
  const {
    data: identitiesData,
    isLoading: identitiesLoading,
    isFetching: identitiesFetching,
    refetch: refetchIdentities,
  } = useExternalIdentities(
    selectedIntegrationId || undefined,
    identitiesPage,
    IDENTITIES_PAGE_SIZE
  );
  const { data: workflowsData } = useWorkflows(1, 100);
  const { data: skillsData } = useSkills(1, 100);

  const updateIntegration = useUpdateChatIntegration(selectedIntegrationId || "");
  const saveTelegramToken = useSaveTelegramBotToken(selectedIntegrationId || "");
  const regenerateSecret = useRegenerateChatIntegrationSecret(selectedIntegrationId || "");
  const testConnection = useTestChatIntegrationConnection(selectedIntegrationId || "");
  const unlinkIdentity = useUnlinkExternalIdentity(selectedIntegrationId || undefined);
  const createIntegration = useCreateChatIntegration();
  const refreshWebhook = useRefreshTelegramWebhook(selectedIntegrationId || "");
  const connectWhatsApp = useConnectWhatsApp(selectedIntegrationId || "");
  const saveSlackToken = useSaveSlackBotToken(selectedIntegrationId || "");
  const saveDiscordToken = useSaveDiscordBotToken(selectedIntegrationId || "");
  const generateSoulMd = useGenerateSoulMd(selectedIntegrationId || "");
  const saveSoulMd = useSaveSoulMd(selectedIntegrationId || "");
  const selectedPlatform = integrationsData?.integrations?.find(
    (i) => i.id === selectedIntegrationId
  )?.platform;
  const { data: whatsappStatusData, refetch: refetchWhatsAppStatus } = useWhatsAppStatus(
    selectedIntegrationId || undefined,
    {
      enabled: selectedPlatform === "WHATSAPP",
    }
  );

  const [showSecret, setShowSecret] = useState(false);
  const [secretJustRegenerated, setSecretJustRegenerated] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackSigningSecret, setSlackSigningSecret] = useState("");
  const [discordBotToken, setDiscordBotToken] = useState("");
  const [discordClientId, setDiscordClientId] = useState("");
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

  // Soul/personality state
  const [soulUpdateExpanded, setSoulUpdateExpanded] = useState(false);
  const [soulTab, setSoulTab] = useState<string>("paste");
  const [soulPasteContent, setSoulPasteContent] = useState("");
  const [soulGenName, setSoulGenName] = useState("");
  const [soulGenDescription, setSoulGenDescription] = useState("");
  const [soulGenTone, setSoulGenTone] = useState("friendly");
  const [soulGenCoreTruths, setSoulGenCoreTruths] = useState("");
  const [soulGenBoundaries, setSoulGenBoundaries] = useState("");
  const [soulPreview, setSoulPreview] = useState<string | null>(null);
  const [evolvePersonality, setEvolvePersonality] = useState(false);

  // Skill selection draft (saved on "Save" click — scope + selected skills batched)
  const [skillScopeDraft, setSkillScopeDraft] = useState<
    "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS"
  >("ALL_SKILLS");
  const [selectedSkillIdsDraft, setSelectedSkillIdsDraft] = useState<string[]>([]);

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
    // Load soul state
    if (integration?.soulMd) {
      setSoulPasteContent(integration.soulMd);
      setSoulPreview(integration.soulMd);
    } else {
      setSoulPasteContent("");
      setSoulPreview(null);
    }
    setEvolvePersonality(integration?.evolvePersonality ?? false);
    // Pre-fill generation name from label
    setSoulGenName(integration?.label || "");
    // Sync skill scope + selection draft
    setSkillScopeDraft(
      (integration?.skillScope as "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS") || "ALL_SKILLS"
    );
    setSelectedSkillIdsDraft(integration?.allowedSkillIds || []);
    // Pre-fill Discord fields when token is set (for Edit mode)
    if (integration?.platform === "DISCORD" && integration?.discordClientId) {
      setDiscordClientId(integration.discordClientId);
    }
  }, [integrationsData?.integrations, selectedIntegrationId]);

  useEffect(() => {
    setIdentitiesPage(1);
  }, [selectedIntegrationId]);

  if (isLoading) {
    return <ChatIntegrationsSetupSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Failed to load Chat Integration integration
            </p>
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
            router.push("/coworker");
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
          <CardTitle className="text-base">Create New AI Coworker</CardTitle>
          <CardDescription>Set up a new AI coworker chat integration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label>Integration label *</Label>
              <p className="text-xs text-muted-foreground">
                Must be unique among your chat integrations.
              </p>
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
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="DISCORD">Discord</SelectItem>
                  <SelectItem value="SLACK">Slack</SelectItem>
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
                <SelectContent
                  side="bottom"
                  className="max-h-[300px] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]"
                >
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
              Create AI Coworker
            </Button>
            <Button variant="outline" asChild>
              <NextLink href="/coworker">Cancel</NextLink>
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
          <CardTitle className="text-base">Create a new AI Coworker</CardTitle>
          <CardDescription>Set up your first AI coworker chat integration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Label *</Label>
            <p className="text-xs text-muted-foreground">
              Must be unique among your chat integrations.
            </p>
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
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="DISCORD">Discord</SelectItem>
                <SelectItem value="SLACK">Slack</SelectItem>
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
                <SelectContent
                  side="bottom"
                  className="max-h-[300px] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]"
                >
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
              Create AI Coworker
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
          <CardTitle className="text-base">No AI coworkers available</CardTitle>
          <CardDescription>Create an AI coworker to continue.</CardDescription>
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

  const handleRefreshStatus = async () => {
    if (integration?.platform === "TELEGRAM" && integration?.telegramBotTokenSet) {
      await refreshWebhook.mutateAsync();
    }
    await refetchIdentities();
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

  const handleWhatsAppOnlyOwnerChange = (onlyOwner: boolean) => {
    if (!integration?.id) return;
    updateIntegration.mutate({ whatsappOnlyOwnerCanChat: onlyOwner });
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

  const handleSkillScopeDraftChange = (skillScope: string) => {
    const scope = skillScope as "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS";
    setSkillScopeDraft(scope);
    if (scope !== "SELECTED_SKILLS") {
      setSelectedSkillIdsDraft([]);
    } else {
      setSelectedSkillIdsDraft(integration?.allowedSkillIds || []);
    }
  };

  const handleSkillDraftToggle = (skillId: string, checked: boolean) => {
    setSelectedSkillIdsDraft((prev) =>
      checked ? [...prev, skillId] : prev.filter((id) => id !== skillId)
    );
  };

  const handleSaveSkillAccess = () => {
    if (!integration?.id) return;
    updateIntegration.mutate({
      skillScope: skillScopeDraft,
      allowedSkillIds: skillScopeDraft === "SELECTED_SKILLS" ? selectedSkillIdsDraft : [],
    });
  };

  const skillAccessHasChanges =
    skillScopeDraft !== (integration?.skillScope || "ALL_SKILLS") ||
    (skillScopeDraft === "SELECTED_SKILLS" &&
      JSON.stringify([...selectedSkillIdsDraft].sort()) !==
        JSON.stringify([...(integration?.allowedSkillIds || [])].sort()));

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
              AI Coworker
            </CardTitle>
            <CardDescription>Select or create an AI coworker.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hideIntegrationSelector && (
              <div className="space-y-2">
                <Label>Active Coworker</Label>
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
                <Label>New integration label *</Label>
                <p className="text-xs text-muted-foreground">
                  Must be unique among your chat integrations.
                </p>
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
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="DISCORD">Discord</SelectItem>
                    <SelectItem value="SLACK">Slack</SelectItem>
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
                  <SelectContent
                    side="bottom"
                    className="max-h-[300px] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]"
                  >
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
                Create AI Coworker
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

      {/* ——— Telegram-only steps ——— */}
      {integration?.platform === "TELEGRAM" && (
        <>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                {tokenSaved ? "Edit Telegram Token" : "Step 2 — Save Bot Token"}
              </CardTitle>
              <CardDescription>
                {tokenSaved
                  ? "Update your Telegram bot token below."
                  : "Paste your Telegram bot token and save it here."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tokenSaved && integration?.telegramBotUsername && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
                  <p className="font-medium">Verified</p>
                  <p className="text-muted-foreground">
                    Bot:{" "}
                    <code className="text-xs bg-muted px-1 rounded">
                      @{integration.telegramBotUsername}
                    </code>
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label>Telegram Bot Token {tokenSaved && "(enter new token to update)"}</Label>
                <Input
                  type="password"
                  placeholder={tokenSaved ? "••••••••••••••••" : "123:ABC..."}
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={handleSaveBotToken}
                    disabled={saveTelegramToken.isPending || !botToken.trim()}
                  >
                    {saveTelegramToken.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {tokenSaved ? "Update Token" : "Save Token"}
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
        </>
      )}

      {/* ——— WhatsApp: Connect with QR ——— */}
      {integration?.platform === "WHATSAPP" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Connect WhatsApp
            </CardTitle>
            <CardDescription>
              Scan the QR code with WhatsApp on your phone (Linked Devices).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {whatsappStatusData?.status === "open" ? (
              <Badge className="flex items-center gap-1 w-fit">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <>
                <Button
                  onClick={() => connectWhatsApp.mutate()}
                  disabled={connectWhatsApp.isPending}
                >
                  {connectWhatsApp.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {integration?.whatsappSessionId ? "Show QR again" : "Connect with QR"}
                </Button>
                {(connectWhatsApp.data?.qr ?? whatsappStatusData?.qr) ? (
                  <div className="flex flex-col items-start gap-2">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(connectWhatsApp.data?.qr ?? whatsappStatusData?.qr ?? "")}`}
                      alt="WhatsApp QR"
                      className="rounded border"
                    />
                    <p className="text-sm text-muted-foreground">
                      Open WhatsApp → Settings → Linked devices → Link a device
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchWhatsAppStatus()}
                      disabled={whatsappStatusData?.status === "open"}
                    >
                      Refresh status
                    </Button>
                  </div>
                ) : (
                  whatsappStatusData?.status === "connecting" && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Waiting for scan…
                    </p>
                  )
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ——— Step 3: Telegram = Link account; WhatsApp = Chat with agent ——— */}
      {integration?.platform === "TELEGRAM" && (
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
              <li>Say hi or any message.</li>
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
                onClick={handleRefreshStatus}
                disabled={identitiesLoading || identitiesFetching || refreshWebhook.isPending}
              >
                {identitiesLoading || identitiesFetching || refreshWebhook.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : null}
                Refresh status
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {integration?.platform === "WHATSAPP" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Chat with your agent
            </CardTitle>
            <CardDescription>
              Choose who can trigger the agent. Link a workflow below (e.g. Enquiries with skills
              and documents) for customer support.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="whatsapp-only-owner">Only I can chat with the agent</Label>
                <p className="text-sm text-muted-foreground">
                  When on: only messages from the connected number (self-chat) are processed.
                </p>
              </div>
              <Switch
                id="whatsapp-only-owner"
                checked={integration?.whatsappOnlyOwnerCanChat !== false}
                onCheckedChange={handleWhatsAppOnlyOwnerChange}
                disabled={!integration?.id || updateIntegration.isPending}
              />
            </div>
            {integration?.whatsappOnlyOwnerCanChat === false && (
              <p className="text-sm text-muted-foreground">
                Customer support mode: anyone who messages this number can chat with the agent. Set
                scope to &quot;Single workflow&quot; below and select your Enquiries (or support)
                workflow with skills and documents.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ——— Step 4: Test Connection (Telegram & WhatsApp) ——— */}
      {(integration?.platform === "TELEGRAM" || integration?.platform === "WHATSAPP") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TestTube2 className="h-4 w-4" />
              Test Connection
            </CardTitle>
            <CardDescription>Verify Verxio can receive updates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isPending || !integration?.id}
            >
              {testConnection.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send test message
            </Button>
            {testConnection.data && (
              <p className="text-sm text-muted-foreground">{testConnection.data.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ——— Slack: Setup Panel ——— */}
      {integration?.platform === "SLACK" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4" />
                {integration?.slackBotTokenSet ? "Edit Slack Credentials" : "Slack Bot Setup"}
              </CardTitle>
              <CardDescription>
                {integration?.slackBotTokenSet
                  ? "Update your Slack bot token and signing secret below."
                  : "Connect your Slack app to Verxio. Create a Slack App at "}
                {!integration?.slackBotTokenSet && (
                  <>
                    <a
                      href="https://api.slack.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      api.slack.com/apps
                    </a>
                    , then provide the credentials below.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {integration?.slackBotTokenSet && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
                  <p className="font-medium">Verified</p>
                  {integration?.slackTeamId && (
                    <p className="text-muted-foreground">
                      Team ID:{" "}
                      <code className="text-xs bg-muted px-1 rounded">
                        {integration.slackTeamId}
                      </code>
                    </p>
                  )}
                </div>
              )}
              {!integration?.slackBotTokenSet && (
                <div className="text-sm space-y-2 rounded-md bg-muted/50 p-3">
                  <p className="font-medium">Quick setup steps:</p>
                  <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                    <li>Create a new Slack App (from scratch) at api.slack.com/apps</li>
                    <li>
                      Under <strong>OAuth &amp; Permissions</strong>, add scopes:{" "}
                      <code className="text-xs bg-muted px-1 rounded">app_mentions:read</code>,{" "}
                      <code className="text-xs bg-muted px-1 rounded">chat:write</code>,{" "}
                      <code className="text-xs bg-muted px-1 rounded">channels:history</code>,{" "}
                      <code className="text-xs bg-muted px-1 rounded">im:history</code>
                    </li>
                    <li>Install the app to your workspace and copy the Bot User OAuth Token</li>
                    <li>
                      Under <strong>Basic Information</strong>, copy the Signing Secret
                    </li>
                    <li>
                      Save both tokens below, then paste the webhook URL into Event Subscriptions
                    </li>
                  </ol>
                </div>
              )}
              <div className="space-y-2">
                <Label>
                  Bot User OAuth Token {integration?.slackBotTokenSet && "(enter new to update)"}
                </Label>
                <Input
                  type="password"
                  placeholder={integration?.slackBotTokenSet ? "••••••••••••••••" : "xoxb-..."}
                  value={slackBotToken}
                  onChange={(e) => setSlackBotToken(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Signing Secret {integration?.slackBotTokenSet && "(enter new to update)"}
                </Label>
                <Input
                  type="password"
                  placeholder={
                    integration?.slackBotTokenSet
                      ? "••••••••••••••••"
                      : "Signing secret from Basic Information"
                  }
                  value={slackSigningSecret}
                  onChange={(e) => setSlackSigningSecret(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() =>
                    saveSlackToken.mutate({
                      slackBotToken: slackBotToken.trim(),
                      slackSigningSecret: slackSigningSecret.trim(),
                    })
                  }
                  disabled={
                    saveSlackToken.isPending || !slackBotToken.trim() || !slackSigningSecret.trim()
                  }
                >
                  {saveSlackToken.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {integration?.slackBotTokenSet
                    ? "Update Slack Credentials"
                    : "Save Slack Credentials"}
                </Button>
                {integration?.slackBotTokenSet && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {integration?.slackBotTokenSet && integration?.webhookUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Event Subscriptions Webhook URL
                </CardTitle>
                <CardDescription>
                  Paste this URL into your Slack App &rarr; Event Subscriptions &rarr; Request URL.
                  Subscribe to <code className="text-xs bg-muted px-1 rounded">app_mention</code>{" "}
                  and <code className="text-xs bg-muted px-1 rounded">message.im</code> events.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1">
                    {integration.webhookUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(integration.webhookUrl || "");
                      toast.success("Webhook URL copied");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ——— Discord: Setup Panel ——— */}
      {integration?.platform === "DISCORD" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4" />
                {integration?.discordBotTokenSet ? "Edit Discord Token" : "Discord Bot Setup"}
              </CardTitle>
              <CardDescription>
                {integration?.discordBotTokenSet
                  ? "Update your Discord bot token or Application ID below."
                  : "Connect your Discord bot to Verxio. Create a bot at the "}
                {!integration?.discordBotTokenSet && (
                  <>
                    <a
                      href="https://discord.com/developers/applications"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Discord Developer Portal
                    </a>
                    , then provide the credentials below.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!integration?.discordBotTokenSet && (
                <div className="text-sm space-y-2 rounded-md bg-muted/50 p-3">
                  <p className="font-medium">Quick setup steps:</p>
                  <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                    <li>Create a new Application at discord.com/developers/applications</li>
                    <li>
                      Go to the <strong>Bot</strong> section and create a bot
                    </li>
                    <li>
                      Enable <strong>MESSAGE CONTENT INTENT</strong> under Privileged Gateway
                      Intents
                    </li>
                    <li>Copy the bot token and paste it below</li>
                    <li>Copy the Application ID (Client ID) for the invite link</li>
                    <li>Use the invite URL to add the bot to your server</li>
                  </ol>
                </div>
              )}
              {integration?.discordBotTokenSet && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
                  <p className="font-medium">Verified credentials</p>
                  {/* {integration?.discordBotUserId && (
                    <p className="text-muted-foreground">
                      Bot ID: <code className="text-xs bg-muted px-1 rounded">{integration.discordBotUserId}</code>
                    </p>
                  )} */}
                  {integration?.discordClientId && (
                    <p className="text-muted-foreground">
                      Application ID:{" "}
                      <code className="text-xs bg-muted px-1 rounded">
                        {integration.discordClientId}
                      </code>
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>
                  Bot Token {integration?.discordBotTokenSet && "(leave blank to keep current)"}
                </Label>
                <Input
                  type="password"
                  placeholder={
                    integration?.discordBotTokenSet ? "••••••••••••••••" : "Discord bot token"
                  }
                  value={discordBotToken}
                  onChange={(e) => setDiscordBotToken(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Application ID (Client ID)</Label>
                <Input
                  placeholder="For generating the invite URL"
                  value={discordClientId}
                  onChange={(e) => setDiscordClientId(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() =>
                    saveDiscordToken.mutate({
                      discordBotToken: discordBotToken.trim() || undefined,
                      discordClientId: discordClientId.trim() || undefined,
                    })
                  }
                  disabled={
                    saveDiscordToken.isPending ||
                    (!discordBotToken.trim() && !integration?.discordBotTokenSet)
                  }
                >
                  {saveDiscordToken.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {integration?.discordBotTokenSet ? "Update Discord Token" : "Save Discord Token"}
                </Button>
                {integration?.discordBotTokenSet && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Token Verified
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {(saveDiscordToken.data?.integration?.inviteUrl ||
            (integration?.discordClientId &&
              `https://discord.com/api/oauth2/authorize?client_id=${integration.discordClientId}&permissions=204800&scope=bot`)) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Add Bot to Server
                </CardTitle>
                <CardDescription>
                  Click the link below to add your bot to a Discord server.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <a
                    href={
                      saveDiscordToken.data?.integration?.inviteUrl ||
                      `https://discord.com/api/oauth2/authorize?client_id=${integration?.discordClientId}&permissions=204800&scope=bot`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline text-primary truncate flex-1 min-w-0"
                  >
                    {saveDiscordToken.data?.integration?.inviteUrl ||
                      `https://discord.com/api/oauth2/authorize?client_id=${integration?.discordClientId}&permissions=204800&scope=bot`}
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8"
                    onClick={() => {
                      const url =
                        saveDiscordToken.data?.integration?.inviteUrl ||
                        (integration?.discordClientId &&
                          `https://discord.com/api/oauth2/authorize?client_id=${integration.discordClientId}&permissions=204800&scope=bot`);
                      if (url) {
                        navigator.clipboard.writeText(url);
                        toast.success("Invite link copied to clipboard");
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ——— Test Connection (all platforms) ——— */}
      {(integration?.platform === "SLACK" || integration?.platform === "DISCORD") &&
        (integration?.slackBotTokenSet || integration?.discordBotTokenSet) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TestTube2 className="h-4 w-4" />
                Test Connection
              </CardTitle>
              <CardDescription>Verify Verxio can communicate with your bot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                onClick={() => testConnection.mutate()}
                disabled={testConnection.isPending || !integration?.id}
              >
                {testConnection.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send test message
              </Button>
              {testConnection.data && (
                <p className="text-sm text-muted-foreground">{testConnection.data.message}</p>
              )}
            </CardContent>
          </Card>
        )}

      {/* Agent Personality (soul.md) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Agent Personality
          </CardTitle>
          <CardDescription>
            Give your agent a unique personality. Display your current personality below, or update
            it by pasting, uploading, or generating.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Display existing personality (like skills) */}
          {(integration?.hasSoulMd || integration?.soulMd || soulPreview) && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Current Personality
              </h4>
              <pre className="text-xs whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                {soulPreview || integration?.soulMd || ""}
              </pre>
            </div>
          )}

          {/* Update personality: button toggles options */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoulUpdateExpanded(!soulUpdateExpanded)}
              className="gap-2"
            >
              {soulUpdateExpanded ? (
                <>
                  <XCircle className="h-3.5 w-3.5" />
                  Hide options
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" />
                  {integration?.hasSoulMd || soulPreview ? "Update personality" : "Set personality"}
                </>
              )}
            </Button>
            {soulUpdateExpanded && (
              <Tabs value={soulTab} onValueChange={setSoulTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="paste" className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Paste
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                  </TabsTrigger>
                  <TabsTrigger value="generate" className="flex items-center gap-1.5">
                    <Wand2 className="h-3.5 w-3.5" />
                    Generate
                  </TabsTrigger>
                </TabsList>

                {/* Paste Tab — pre-filled with existing personality, editable, Save */}
                <TabsContent value="paste" className="space-y-3 mt-3">
                  <Textarea
                    placeholder={`## Core Truths\n- I believe in being helpful and direct\n- ...\n\n## Boundaries\n- I never share private data\n- ...\n\n## The Vibe\nI'm friendly, concise, and a little witty...`}
                    value={soulPasteContent}
                    onChange={(e) => setSoulPasteContent(e.target.value)}
                    rows={10}
                    className="font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    disabled={!soulPasteContent.trim() || saveSoulMd.isPending}
                    onClick={() => {
                      saveSoulMd.mutate(
                        { soulMd: soulPasteContent },
                        {
                          onSuccess: () => {
                            setSoulPreview(soulPasteContent);
                          },
                        }
                      );
                    }}
                  >
                    {saveSoulMd.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Save Personality
                  </Button>
                </TabsContent>

                {/* Upload Tab */}
                <TabsContent value="upload" className="space-y-3 mt-3">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload a <code>.md</code> file with your agent&apos;s personality
                    </p>
                    <Input
                      type="file"
                      accept=".md,.txt,.markdown"
                      className="max-w-xs mx-auto"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        setSoulPasteContent(text);
                        saveSoulMd.mutate(
                          { soulMd: text },
                          {
                            onSuccess: () => {
                              setSoulPreview(text);
                              toast.success("Personality file uploaded and saved");
                            },
                          }
                        );
                      }}
                    />
                  </div>
                </TabsContent>

                {/* Generate Tab */}
                <TabsContent value="generate" className="space-y-3 mt-3">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-medium">Agent Name</Label>
                      <Input
                        placeholder="e.g., Distro"
                        value={soulGenName}
                        onChange={(e) => setSoulGenName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Description</Label>
                      <Textarea
                        placeholder="What does this agent do? e.g., Helps users manage their workflow automations and schedules..."
                        value={soulGenDescription}
                        onChange={(e) => setSoulGenDescription(e.target.value)}
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Tone</Label>
                      <Select value={soulGenTone} onValueChange={setSoulGenTone}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="friendly">Friendly</SelectItem>
                          <SelectItem value="witty">Witty</SelectItem>
                          <SelectItem value="sarcastic">Sarcastic</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                          <SelectItem value="creative">Creative</SelectItem>
                          <SelectItem value="empathetic">Empathetic</SelectItem>
                          <SelectItem value="concise">Concise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Core Truths (optional)</Label>
                      <Textarea
                        placeholder="What does your agent believe in? Its values and principles..."
                        value={soulGenCoreTruths}
                        onChange={(e) => setSoulGenCoreTruths(e.target.value)}
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Boundaries (optional)</Label>
                      <Textarea
                        placeholder="Hard limits — things the agent should never do..."
                        value={soulGenBoundaries}
                        onChange={(e) => setSoulGenBoundaries(e.target.value)}
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={
                        !soulGenName.trim() ||
                        !soulGenDescription.trim() ||
                        generateSoulMd.isPending
                      }
                      onClick={() => {
                        generateSoulMd.mutate(
                          {
                            name: soulGenName,
                            description: soulGenDescription,
                            tone: soulGenTone,
                            coreTruths: soulGenCoreTruths || undefined,
                            boundaries: soulGenBoundaries || undefined,
                          },
                          {
                            onSuccess: (result) => {
                              setSoulPreview(result.soulMd);
                              setSoulPasteContent(result.soulMd);
                              saveSoulMd.mutate({ soulMd: result.soulMd });
                              // Clear generation fields after AI generates
                              setSoulGenName("");
                              setSoulGenDescription("");
                              setSoulGenTone("friendly");
                              setSoulGenCoreTruths("");
                              setSoulGenBoundaries("");
                              setSoulTab("paste");
                            },
                          }
                        );
                      }}
                    >
                      {generateSoulMd.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4 mr-2" />
                      )}
                      Generate Personality (20 credits)
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>

          {/* Evolve toggle */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Allow personality to evolve</Label>
              <p className="text-xs text-muted-foreground">
                The agent can refine its personality over time based on your interactions.
              </p>
            </div>
            <Switch
              checked={evolvePersonality}
              onCheckedChange={(checked) => {
                setEvolvePersonality(checked);
                updateIntegration.mutate({ evolvePersonality: checked });
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Skill Access */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Skill Access
          </CardTitle>
          <CardDescription>
            Choose which custom skills this agent can use. Skills extend the agent&apos;s
            capabilities with your knowledge and instructions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Skill scope</Label>
            <Select value={skillScopeDraft} onValueChange={handleSkillScopeDraftChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select skill scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_SKILLS">All skills</SelectItem>
                <SelectItem value="SELECTED_SKILLS">Select skills</SelectItem>
                <SelectItem value="NO_SKILLS">No skills</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {skillScopeDraft === "ALL_SKILLS" && "Agent has access to all your custom skills."}
              {skillScopeDraft === "SELECTED_SKILLS" &&
                "Agent can only use the skills you select below."}
              {skillScopeDraft === "NO_SKILLS" &&
                "Agent has no custom skills — only built-in capabilities."}
            </p>
          </div>

          {skillScopeDraft === "SELECTED_SKILLS" && (
            <div className="space-y-3">
              <Label>Choose skills for this agent</Label>
              <p className="text-xs text-muted-foreground">
                Select the skills you want this agent to use. Click Save skills when done.
              </p>
              <div className="max-h-[200px] overflow-y-auto rounded-md border p-2">
                {(skillsData?.skills ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No skills yet.{" "}
                    <NextLink href="/skills" className="text-primary underline">
                      Create a skill
                    </NextLink>{" "}
                    to add knowledge for your agent.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {(skillsData?.skills ?? []).map((skill) => {
                      const checked = selectedSkillIdsDraft.includes(skill.id);
                      return (
                        <label
                          key={skill.id}
                          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => handleSkillDraftToggle(skill.id, e.target.checked)}
                            className="rounded"
                          />
                          <span className="font-medium">{skill.name}</span>
                          {skill.description && (
                            <span className="text-muted-foreground text-xs truncate">
                              — {skill.description}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {(skillsData?.skills ?? []).length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Select skills above, then click Save below.
                </p>
              )}
            </div>
          )}

          {skillAccessHasChanges && (
            <Button
              size="sm"
              onClick={handleSaveSkillAccess}
              disabled={updateIntegration.isPending}
            >
              {updateIntegration.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
          <CardDescription>
            Control how your AI Coworker can interact with your workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Label *</Label>
            <p className="text-xs text-muted-foreground">
              Must be unique among your chat integrations.
            </p>
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
            <Select value={integration?.platform} disabled>
              <SelectTrigger className="bg-muted">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TELEGRAM">Telegram</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="DISCORD">Discord</SelectItem>
                <SelectItem value="SLACK">Slack</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Platform cannot be changed after creation — each uses different configuration.
            </p>
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
                <SelectContent
                  side="bottom"
                  className="max-h-[300px] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]"
                >
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
              <Label>Coworker Active</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable this AI Coworker.
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
                Let AI Coworker create and modify workflows using plan mode.
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
                Let AI Coworker trigger workflow runs from chat commands.
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

      {/* Configuration — Telegram & Slack only (Discord/WhatsApp use connectors, no webhook) */}
      {integration?.platform !== "WHATSAPP" && integration?.platform !== "DISCORD" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>
              Webhook URL and shared secret for your chat integration.
            </CardDescription>
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
                  Add this secret to the X-ChatIntegration-Secret header in your Chat Integration
                  config.
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
                        Integration configuration with the new secret.
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
                    <strong>Important:</strong> Copy the new secret above and update your
                    ChatIntegration configuration. The old secret will no longer work.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linked Accounts (Telegram: link by messaging bot; WhatsApp: automatic when they message) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked Accounts</CardTitle>
          <CardDescription>
            {integration?.platform === "WHATSAPP"
              ? "Senders appear here after they message. Who can trigger the agent is set above (Only I can chat / Customer support)."
              : "Accounts linked to Verxio through Chat Integration."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {identities.length === 0 ? (
            <div className="text-center py-8">
              <Link className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                {integration?.platform === "WHATSAPP"
                  ? "No chatters yet. Send a message from WhatsApp to this number to start."
                  : "No linked accounts yet"}
              </p>
            </div>
          ) : (
            <>
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
                        <p className="font-medium">
                          {identity.externalName || identity.externalId}
                        </p>
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
              {(identitiesData?.totalPages ?? 1) > 1 && (
                <div className="mt-4 flex justify-center">
                  <EntityPagination
                    currentPage={identitiesPage}
                    totalPages={identitiesData?.totalPages ?? 1}
                    onPageChange={setIdentitiesPage}
                    showInfo={false}
                  />
                </div>
              )}
            </>
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
