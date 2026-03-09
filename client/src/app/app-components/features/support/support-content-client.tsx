"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SupportContainer,
  SupportLoadingView,
  SupportErrorView,
  SupportEmptyView,
} from "@/app/app-components/features/support/support";
import { EntityPagination } from "@/app/app-components/features/editor/entity-component";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart3,
  Code2,
  Download,
  Link as LinkIcon,
  Loader2,
  Mail,
  PlugIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { authenticatedDelete, authenticatedGet, authenticatedPost } from "@/lib/api-client";
import {
  SupportAgent,
  useCreateSupportAgent,
  useDeleteSupportAgent,
  useSupportAgents,
  useUpdateSupportAgent,
} from "@/hooks/useSupportAgents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type KnowledgeBaseSummary = {
  id: string;
  name: string;
};

type SupportAgentInsights = {
  totalConversations: number;
  totalMessages: number;
  frequentQuestions: Array<{ text: string; count: number }>;
  fallbackRate: number;
  fallbackCount: number;
  assistantMessageCount: number;
  sampleFallbackQuestions: string[];
  averageRating: number | null;
  ratingCount: number;
  ratingDistribution: Record<number, number>;
  customerFeedback: string[];
};

type SupportAgentKBSuggestions = {
  suggestedTopics: string[];
  sampleQuestions: string[];
};

type SupportChannel = {
  id: string;
  platform: "WHATSAPP" | "TELEGRAM" | "SLACK" | "DISCORD";
  status: string;
};

const supportAgentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  fallbackEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  greeting: z.string().optional(),
  brandColor: z.string().optional(),
  position: z.string().optional(),
  knowledgeBaseIds: z.array(z.string()).optional(),
});

type SupportAgentFormValues = z.infer<typeof supportAgentSchema>;

export function SupportContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, error } = useSupportAgents();
  const createMutation = useCreateSupportAgent();
  const updateMutation = useUpdateSupportAgent();
  const deleteMutation = useDeleteSupportAgent();

  const form = useForm<SupportAgentFormValues>({
    resolver: zodResolver(supportAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      fallbackEmail: "",
      greeting: "",
      brandColor: "#6366f1",
      position: "bottom-right",
      knowledgeBaseIds: [],
    },
  });

  const [editing, setEditing] = useState<SupportAgent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [insightsAgent, setInsightsAgent] = useState<SupportAgent | null>(null);
  const [insightsData, setInsightsData] = useState<SupportAgentInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [suggestionsData, setSuggestionsData] = useState<SupportAgentKBSuggestions | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseSummary[]>([]);
  const [channelsAgent, setChannelsAgent] = useState<SupportAgent | null>(null);
  const [channels, setChannels] = useState<SupportChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<{
    status: string;
    qr: string | null;
  } | null>(null);
  const [connectingWhatsApp, setConnectingWhatsApp] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<
    null | "TELEGRAM" | "SLACK" | "DISCORD"
  >(null);
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackSigningSecret, setSlackSigningSecret] = useState("");
  const [discordBotToken, setDiscordBotToken] = useState("");
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [discordChannelId, setDiscordChannelId] = useState("");
  const [telegramWebhookUrl, setTelegramWebhookUrl] = useState("");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const selectedKnowledgeBaseIds = form.watch("knowledgeBaseIds") || [];

  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      try {
        const data = await authenticatedGet<{ knowledgeBases: { id: string; name: string }[] }>(
          "/api/knowledge-base"
        );
        setKnowledgeBases(
          (data.knowledgeBases || []).map((kb) => ({
            id: kb.id,
            name: kb.name,
          }))
        );
      } catch {
        // silent; support agents can still be created without KBs
      }
    };
    fetchKnowledgeBases();
  }, []);

  useEffect(() => {
    if (!insightsAgent) {
      setInsightsData(null);
      setSuggestionsData(null);
      return;
    }
    let cancelled = false;
    setInsightsLoading(true);
    setInsightsData(null);
    setSuggestionsData(null);
    authenticatedGet<SupportAgentInsights>(`/api/support-agents/${insightsAgent.id}/insights`)
      .then((data) => {
        if (!cancelled) {
          setInsightsData(data);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load insights");
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [insightsAgent]);

  useEffect(() => {
    if (!channelsAgent) {
      setChannels([]);
      setWhatsappStatus(null);
      setTelegramWebhookUrl("");
      setSlackWebhookUrl("");
      return;
    }

    let cancelled = false;
    setChannelsLoading(true);
    setChannels([]);
    setWhatsappStatus(null);
    setTelegramWebhookUrl("");
    setSlackWebhookUrl("");

    const load = async () => {
      try {
        const [channelsRes, statusRes] = await Promise.all([
          authenticatedGet<{ success: boolean; channels: SupportChannel[] }>(
            `/api/support/agents/${channelsAgent.id}/channels`
          ),
          authenticatedGet<{ success: boolean; status: string; qr: string | null }>(
            `/api/support/agents/${channelsAgent.id}/channels/whatsapp/status`
          ),
        ]);
        if (cancelled) return;
        setChannels(channelsRes.channels || []);
        setWhatsappStatus({ status: statusRes.status, qr: statusRes.qr });
      } catch (err) {
        if (!cancelled) {
          // keep UI usable even if channels fail to load
          console.error("Failed to load support channels", err);
          toast.error("Failed to load support channels");
        }
      } finally {
        if (!cancelled) {
          setChannelsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [channelsAgent]);

  const agents = data?.agents ?? [];

  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    const q = searchQuery.toLowerCase();
    return agents.filter((a) => {
      return (
        a.name.toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        (a.fallbackEmail || "").toLowerCase().includes(q)
      );
    });
  }, [agents, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / limit));
  const pagedAgents = filteredAgents.slice((page - 1) * limit, page * limit);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  const openCreateDialog = () => {
    setEditing(null);
    form.reset({
      name: "",
      description: "",
      fallbackEmail: "",
      greeting: "",
      brandColor: "#6366f1",
      position: "bottom-right",
      knowledgeBaseIds: [],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (agent: SupportAgent) => {
    setEditing(agent);
    form.reset({
      name: agent.name,
      description: agent.description ?? "",
      fallbackEmail: agent.fallbackEmail ?? "",
      greeting: agent.greeting ?? "",
      brandColor: agent.brandColor ?? "#6366f1",
      position: agent.position ?? "bottom-right",
      knowledgeBaseIds: agent.knowledgeBaseIds ?? [],
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: SupportAgentFormValues) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: values });
      } else {
        await createMutation.mutateAsync(values);
      }
      setDialogOpen(false);
    } catch (e) {
      // hooks already toast on error/success
    }
  };

  const handleConnectWhatsApp = async () => {
    if (!channelsAgent) return;
    setConnectingWhatsApp(true);
    try {
      const res = await authenticatedPost<{
        success: boolean;
        channelId: string;
        sessionId: string;
        status: string;
        qr: string | null;
      }>(`/api/support/agents/${channelsAgent.id}/channels/whatsapp/connect`, {});

      if (!res.success) {
        throw new Error("Failed to start WhatsApp connection");
      }

      toast.success("WhatsApp connection started. Scan the QR code to finish setup.");
      setWhatsappStatus({ status: res.status, qr: res.qr ?? null });

      const channelsRes = await authenticatedGet<{ success: boolean; channels: SupportChannel[] }>(
        `/api/support/agents/${channelsAgent.id}/channels`
      );
      setChannels(channelsRes.channels || []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start WhatsApp connection";
      toast.error(message);
    } finally {
      setConnectingWhatsApp(false);
    }
  };

  const refreshChannels = async (agentId: string) => {
    const channelsRes = await authenticatedGet<{ success: boolean; channels: SupportChannel[] }>(
      `/api/support/agents/${agentId}/channels`
    );
    setChannels(channelsRes.channels || []);
  };

  const handleConnectTelegram = async () => {
    if (!channelsAgent) return;
    if (!telegramBotToken.trim()) {
      toast.error("Telegram bot token is required.");
      return;
    }
    setConnectingPlatform("TELEGRAM");
    try {
      const res = await authenticatedPost<{ webhookUrl?: string }>(
        `/api/support/agents/${channelsAgent.id}/channels/telegram/connect`,
        {
          telegramBotToken: telegramBotToken.trim(),
        }
      );
      toast.success("Telegram support channel connected.");
      setTelegramWebhookUrl(res.webhookUrl || "");
      setTelegramBotToken("");
      await refreshChannels(channelsAgent.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect Telegram.");
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleConnectSlack = async () => {
    if (!channelsAgent) return;
    if (!slackBotToken.trim() || !slackSigningSecret.trim()) {
      toast.error("Slack bot token and signing secret are required.");
      return;
    }
    setConnectingPlatform("SLACK");
    try {
      const res = await authenticatedPost<{ webhookUrl?: string }>(
        `/api/support/agents/${channelsAgent.id}/channels/slack/connect`,
        {
          slackBotToken: slackBotToken.trim(),
          slackSigningSecret: slackSigningSecret.trim(),
        }
      );
      toast.success("Slack support channel connected.");
      setSlackWebhookUrl(res.webhookUrl || "");
      setSlackBotToken("");
      setSlackSigningSecret("");
      await refreshChannels(channelsAgent.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect Slack.");
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleConnectDiscord = async () => {
    if (!channelsAgent) return;
    if (!discordBotToken.trim()) {
      toast.error("Discord bot token is required.");
      return;
    }
    setConnectingPlatform("DISCORD");
    try {
      await authenticatedPost(`/api/support/agents/${channelsAgent.id}/channels/discord/connect`, {
        discordBotToken: discordBotToken.trim(),
        discordGuildId: discordGuildId.trim() || undefined,
        discordChannelId: discordChannelId.trim() || undefined,
      });
      toast.success("Discord support channel connected.");
      setDiscordBotToken("");
      await refreshChannels(channelsAgent.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect Discord.");
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleDisconnectChannel = async (platform: SupportChannel["platform"]) => {
    const channel = channels.find((c) => c.platform === platform && c.status !== "disabled");
    if (!channel) return;
    try {
      await authenticatedDelete(`/api/support/channels/${channel.id}`);
      toast.success(`${platform.toLowerCase()} support channel disconnected.`);
      if (channelsAgent) {
        await refreshChannels(channelsAgent.id);
      }
      if (platform === "WHATSAPP") {
        setWhatsappStatus({ status: "disconnected", qr: null });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect channel.");
    }
  };

  if (isLoading) {
    return (
      <SupportContainer
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onNew={openCreateDialog}
      >
        <SupportLoadingView />
      </SupportContainer>
    );
  }

  if (error) {
    return (
      <SupportContainer
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onNew={openCreateDialog}
      >
        <SupportErrorView />
      </SupportContainer>
    );
  }

  const isEmpty = agents.length === 0;
  const telegramChannel = channels.find(
    (c) => c.platform === "TELEGRAM" && c.status !== "disabled"
  );
  const slackChannel = channels.find((c) => c.platform === "SLACK" && c.status !== "disabled");
  const discordChannel = channels.find((c) => c.platform === "DISCORD" && c.status !== "disabled");

  const dialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Support Agent" : "New Support Agent"}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 flex-1 overflow-y-auto pr-1 -mr-1">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={2}
                {...form.register("description")}
                placeholder="Short description of what this support agent helps with and its personality."
              />
              <p className="text-xs text-muted-foreground">
                This is used to describe the agent&apos;s style and focus, giving it a more personal
                voice.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Knowledge bases</Label>
              {knowledgeBases.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  You have no knowledge bases yet. Create one in the Knowledge Base section.
                </p>
              ) : (
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto rounded-md border bg-muted/30 px-3 py-2 pr-1">
                  {knowledgeBases.map((kb) => {
                    const checked = selectedKnowledgeBaseIds.includes(kb.id);
                    return (
                      <label key={kb.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border"
                          checked={checked}
                          onChange={(e) => {
                            const current = form.getValues("knowledgeBaseIds") || [];
                            if (e.target.checked) {
                              form.setValue("knowledgeBaseIds", [...current, kb.id], {
                                shouldDirty: true,
                              });
                            } else {
                              form.setValue(
                                "knowledgeBaseIds",
                                current.filter((id) => id !== kb.id),
                                { shouldDirty: true }
                              );
                            }
                          }}
                        />
                        <span className="truncate">{kb.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                The support agent will answer only from the selected knowledge bases.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fallbackEmail">Fallback email</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="fallbackEmail"
                  type="email"
                  placeholder="support@yourcompany.com"
                  {...form.register("fallbackEmail")}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                When the agent cannot answer from the knowledge base, it will direct users to this
                email address.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="greeting">Greeting</Label>
              <Input
                id="greeting"
                {...form.register("greeting")}
                placeholder="Hi! How can I help you?"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="brandColor">Brand color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="brandColorColor"
                    type="color"
                    className="h-9 w-10 p-1"
                    value={form.watch("brandColor") || "#6366f1"}
                    onChange={(e) => {
                      form.setValue("brandColor", e.target.value, { shouldDirty: true });
                    }}
                  />
                  <Input
                    id="brandColor"
                    type="text"
                    className="flex-1"
                    {...form.register("brandColor")}
                  />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="position">Widget position</Label>
                <Select
                  value={form.watch("position") || "bottom-right"}
                  onValueChange={(value) => {
                    form.setValue("position", value, { shouldDirty: true });
                  }}
                >
                  <SelectTrigger id="position" className="w-full">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="end" className="max-h-64">
                    <SelectItem value="bottom-right">Bottom right (recommended)</SelectItem>
                    <SelectItem value="bottom-left">Bottom left</SelectItem>
                    <SelectItem value="top-right">Top right</SelectItem>
                    <SelectItem value="top-left">Top left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? (
                  "Save changes"
                ) : (
                  <>
                    {/* <Plus className="mr-2 h-4 w-4" /> */}
                    Create
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (isEmpty) {
    return (
      <>
        <SupportEmptyView
          onCreateSupportAgent={openCreateDialog}
          isCreating={createMutation.isPending}
        />
        {dialog}
      </>
    );
  }

  return (
    <SupportContainer
      searchValue={searchQuery}
      onSearchChange={(v) => {
        setSearchQuery(v);
        setPage(1);
      }}
      onNew={openCreateDialog}
      disabled={createMutation.isPending || updateMutation.isPending}
      isCreating={createMutation.isPending}
    >
      <div className="min-w-0 space-y-3">
        <div className="min-w-0 space-y-2 rounded-lg border bg-card p-3 sm:p-4">
          {pagedAgents.map((agent) => {
            const publicLink = baseUrl
              ? `${baseUrl.replace(/\/+$/, "")}/support/${agent.publicId}`
              : `/support/${agent.publicId}`;
            const embedCode = baseUrl
              ? `<script src="${baseUrl.replace(/\/+$/, "")}/support-widget.js" data-support-agent="${agent.publicId}"></script>`
              : `<script src="/support-widget.js" data-support-agent="${agent.publicId}"></script>`;

            return (
              <div
                key={agent.id}
                className="min-w-0 flex flex-col gap-3 rounded-md border bg-background p-3 sm:p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-7 w-7 rounded-md border"
                      style={{ borderColor: agent.brandColor || "#6366f1" }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{agent.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {agent.description || "Support agent using your knowledge bases"}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {agent.knowledgeBaseIds.length
                      ? `${agent.knowledgeBaseIds.length} knowledge base${agent.knowledgeBaseIds.length > 1 ? "s" : ""} linked`
                      : "No knowledge bases linked yet"}
                    {agent.fallbackEmail
                      ? ` • Fallback: ${agent.fallbackEmail}`
                      : " • No fallback email set"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(publicLink)
                          .then(() => toast.success("Public chat link copied"))
                          .catch(() => toast.error("Failed to copy link"));
                      }}
                    >
                      <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                      Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(embedCode)
                          .then(() => toast.success("Embed code copied"))
                          .catch(() => toast.error("Failed to copy embed code"));
                      }}
                    >
                      <Code2 className="mr-1.5 h-3.5 w-3.5" />
                      Embed
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setChannelsAgent(agent)}
                      title="Manage support channels"
                    >
                      <PlugIcon className="mr-1.5 h-3.5 w-3.5" />
                      Channels
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInsightsAgent(agent)}
                      title="View insights"
                    >
                      <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                      Insights
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(agent)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate({ id: agent.id })}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <EntityPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {dialog}

      {/* Channels dialog */}
      <Dialog open={!!channelsAgent} onOpenChange={(open) => !open && setChannelsAgent(null)}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="pr-6">
              {channelsAgent?.name ?? "Support agent"} — Channels
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
            <p className="text-xs text-muted-foreground">
              Connect this support agent to external chat channels. All conversations on these
              channels are answered by this agent using your knowledge bases and fallback rules.
            </p>
            <div className="space-y-3 rounded-md border bg-card/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-xs font-medium">WhatsApp</span>
                  <span className="text-[11px] text-muted-foreground">
                    Start a WhatsApp session for this agent using the Verxio WhatsApp connector
                    (Baileys). Scan the QR code once and the connector will keep this number
                    connected so the support agent can reply to chats.
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">
                    Status:{" "}
                    <span className="font-medium">
                      {channelsLoading ? "Loading..." : whatsappStatus?.status || "disconnected"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={connectingWhatsApp || channelsLoading}
                  onClick={handleConnectWhatsApp}
                  className="w-full justify-center"
                >
                  {connectingWhatsApp && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  {connectingWhatsApp
                    ? "Starting WhatsApp connection..."
                    : "Connect or refresh WhatsApp"}
                </Button>
                {channels.find((c) => c.platform === "WHATSAPP" && c.status !== "disabled") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnectChannel("WHATSAPP")}
                    className="w-full justify-center"
                  >
                    Disconnect WhatsApp
                  </Button>
                )}
                {whatsappStatus?.qr && (
                  <div className="mt-1 flex flex-col items-center gap-2 rounded-md border bg-muted/40 p-3">
                    <p className="text-[11px] text-muted-foreground text-center">
                      Scan this QR code with WhatsApp on your phone to connect this support agent to
                      your number.
                    </p>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                        whatsappStatus.qr
                      )}`}
                      alt="WhatsApp QR code"
                      className="max-h-48 w-auto rounded-sm border bg-background"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 rounded-md border bg-card/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-xs font-medium">Telegram</span>
                  <span className="text-[11px] text-muted-foreground">
                    Paste your Telegram bot token (from BotFather) and connect. We automatically
                    configure the HTTPS webhook for you so any DM or group message to this bot is
                    answered by this support agent.
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {channelsLoading ? "Loading..." : telegramChannel?.status || "disconnected"}
                </span>
              </div>
              {telegramChannel ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Bot token: <span className="font-mono">••••••••</span> (stored securely)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnectChannel("TELEGRAM")}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Telegram bot token"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={connectingPlatform === "TELEGRAM" || channelsLoading}
                      onClick={handleConnectTelegram}
                      className="flex-1"
                    >
                      {connectingPlatform === "TELEGRAM" && (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      )}
                      Connect Telegram
                    </Button>
                  </div>
                </>
              )}
              {telegramWebhookUrl && (
                <p className="text-[11px] text-muted-foreground break-all">
                  Webhook URL: {telegramWebhookUrl}
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-md border bg-card/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-xs font-medium">Slack</span>
                  <span className="text-[11px] text-muted-foreground">
                    Use a Slack bot token and signing secret for your workspace. After connecting,
                    set the Events API request URL in your Slack app to the Events URL shown here so
                    mentions and DMs are routed to this support agent.
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {channelsLoading ? "Loading..." : slackChannel?.status || "disconnected"}
                </span>
              </div>
              {slackChannel ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Bot token: <span className="font-mono">••••••••</span> (stored securely)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Signing secret: <span className="font-mono">••••••••</span> (stored securely)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnectChannel("SLACK")}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Slack bot token (xoxb-...)"
                    value={slackBotToken}
                    onChange={(e) => setSlackBotToken(e.target.value)}
                  />
                  <Input
                    placeholder="Slack signing secret"
                    value={slackSigningSecret}
                    onChange={(e) => setSlackSigningSecret(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={connectingPlatform === "SLACK" || channelsLoading}
                      onClick={handleConnectSlack}
                      className="flex-1"
                    >
                      {connectingPlatform === "SLACK" && (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      )}
                      Connect Slack
                    </Button>
                  </div>
                </>
              )}
              {slackWebhookUrl && (
                <p className="text-[11px] text-muted-foreground break-all">
                  Events URL: {slackWebhookUrl}
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-md border bg-card/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-xs font-medium">Discord</span>
                  <span className="text-[11px] text-muted-foreground">
                    Connect a Discord bot token (using the Verxio Discord connector), then invite
                    the bot to your server. Messages in the configured server/channel are answered
                    by this support agent.
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {channelsLoading ? "Loading..." : discordChannel?.status || "disconnected"}
                </span>
              </div>
              {discordChannel ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Bot token: <span className="font-mono">••••••••</span> (stored securely)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnectChannel("DISCORD")}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Discord bot token"
                    value={discordBotToken}
                    onChange={(e) => setDiscordBotToken(e.target.value)}
                  />
                  <Input
                    placeholder="Discord guild ID (optional)"
                    value={discordGuildId}
                    onChange={(e) => setDiscordGuildId(e.target.value)}
                  />
                  <Input
                    placeholder="Discord channel ID (optional)"
                    value={discordChannelId}
                    onChange={(e) => setDiscordChannelId(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={connectingPlatform === "DISCORD" || channelsLoading}
                      onClick={handleConnectDiscord}
                      className="flex-1"
                    >
                      {connectingPlatform === "DISCORD" && (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      )}
                      Connect Discord
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Insights dialog */}
      <Dialog open={!!insightsAgent} onOpenChange={(open) => !open && setInsightsAgent(null)}>
        <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="pr-8">
              {insightsAgent?.name ?? "Support agent"} — Customer Insights
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1 min-h-0">
            {insightsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading customer insights</p>
              </div>
            ) : insightsData ? (
              <>
                <div className="flex flex-wrap gap-2 sm:gap-3 sm:justify-stretch">
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={!insightsData}
                    onClick={() => {
                      if (!insightsData) return;
                      const agentName = insightsAgent?.name ?? "Support agent";
                      const date = new Date().toISOString().slice(0, 10);
                      const d = insightsData;
                      let report = `SUPPORT INSIGHTS REPORT\n${"=".repeat(50)}\n\n`;
                      report += `Agent: ${agentName}\n`;
                      report += `Generated: ${new Date().toLocaleString()}\n\n`;

                      report += `EXECUTIVE SUMMARY\n${"-".repeat(30)}\n`;
                      const convText =
                        d.totalConversations === 0
                          ? "No conversations yet."
                          : d.totalConversations === 1
                            ? "1 conversation"
                            : `${d.totalConversations} conversations`;
                      const msgText =
                        d.totalMessages === 0 ? "" : ` with ${d.totalMessages} total messages`;
                      report += `This period had ${convText}${msgText}. `;
                      if (d.assistantMessageCount > 0) {
                        if (d.fallbackRate === 0) {
                          report += `All assistant replies were answered from the knowledge base (0% fallback). `;
                        } else if (d.fallbackRate < 20) {
                          report += `A small share of replies (${d.fallbackRate.toFixed(0)}%) used the fallback path; most queries were covered by the knowledge base. `;
                        } else {
                          report += `A notable share of replies (${d.fallbackRate.toFixed(0)}%) relied on the fallback; consider expanding the knowledge base for recurring topics. `;
                        }
                      }
                      if (d.frequentQuestions.length > 0) {
                        const topics = d.frequentQuestions
                          .slice(0, 3)
                          .map((q) => `"${q.text.slice(0, 40)}${q.text.length > 40 ? "…" : ""}"`)
                          .join(", ");
                        report += `The most common customer topics were: ${topics}. `;
                      }
                      if (d.ratingCount > 0 && d.averageRating != null) {
                        const ratingWord =
                          d.averageRating >= 4.5
                            ? "strong"
                            : d.averageRating >= 3.5
                              ? "positive"
                              : "mixed";
                        report += `Customer ratings are ${ratingWord} (${d.averageRating}★ from ${d.ratingCount} response${d.ratingCount !== 1 ? "s" : ""}). `;
                      } else if (d.totalConversations > 0) {
                        report += `Encourage customers to rate their experience to track satisfaction. `;
                      }
                      if (d.customerFeedback?.length) {
                        report += `Customers left ${d.customerFeedback.length} improvement suggestion${d.customerFeedback.length !== 1 ? "s" : ""}; review the feedback section for actionable ideas.`;
                      } else {
                        report += `No written improvement feedback was submitted yet.`;
                      }
                      report += `\n\n`;

                      report += `SUMMARY (METRICS)\n${"-".repeat(30)}\n`;
                      report += `Total conversations: ${d.totalConversations}\n`;
                      report += `Total messages: ${d.totalMessages}\n`;
                      report += `Fallback rate: ${d.assistantMessageCount > 0 ? `${d.fallbackRate.toFixed(1)}%` : "—"} (${d.fallbackCount} of ${d.assistantMessageCount} assistant replies)\n`;
                      if (d.ratingCount > 0) {
                        report += `Average rating: ${d.averageRating ?? "—"} (${d.ratingCount} rating${d.ratingCount !== 1 ? "s" : ""})\n`;
                        report += `Rating distribution: 1★ ${d.ratingDistribution?.[1] ?? 0} | 2★ ${d.ratingDistribution?.[2] ?? 0} | 3★ ${d.ratingDistribution?.[3] ?? 0} | 4★ ${d.ratingDistribution?.[4] ?? 0} | 5★ ${d.ratingDistribution?.[5] ?? 0}\n`;
                      }
                      report += `\nSUGGESTED IMPROVEMENTS\n${"-".repeat(30)}\n`;
                      const improvements: string[] = [];
                      if (d.fallbackRate > 0 && d.sampleFallbackQuestions?.length) {
                        improvements.push(
                          "• Add or expand knowledge base articles for topics that triggered fallback replies (see Suggested KB topics below)."
                        );
                      } else if (d.fallbackRate > 0) {
                        improvements.push(
                          "• Review fallback conversations and add KB content for recurring questions the agent could not answer."
                        );
                      }
                      if (d.frequentQuestions.length > 0) {
                        improvements.push(
                          "• Consider turning the top frequent questions into a short FAQ or pinned answers in your knowledge base."
                        );
                      }
                      if (d.ratingCount === 0 && d.totalConversations > 0) {
                        improvements.push(
                          "• Encourage customers to rate the chat when the conversation ends to improve satisfaction tracking."
                        );
                      }
                      if (d.ratingCount > 0 && d.averageRating != null && d.averageRating < 4) {
                        improvements.push(
                          "• Review lower-rated conversations and customer feedback to identify and fix pain points."
                        );
                      }
                      if (d.customerFeedback?.length) {
                        improvements.push(
                          "• Act on written customer feedback where possible; it reflects direct requests for improvement."
                        );
                      }
                      if (improvements.length === 0) {
                        improvements.push(
                          "• Keep monitoring conversations and ratings; add KB content as new recurring questions appear."
                        );
                      }
                      report += improvements.join("\n") + "\n\n";

                      report += `FREQUENT QUESTIONS (customer → product support)\n${"-".repeat(30)}\n`;
                      if (d.frequentQuestions.length === 0) {
                        report += `No questions yet.\n\n`;
                      } else {
                        d.frequentQuestions.forEach((q, i) => {
                          report += `${i + 1}. [${q.count}x] ${q.text}\n`;
                        });
                        report += "\n";
                      }
                      report += `SUGGESTED KB TOPICS (from fallback conversations)\n${"-".repeat(30)}\n`;
                      if (suggestionsData?.suggestedTopics?.length) {
                        suggestionsData.suggestedTopics.forEach((t, i) => {
                          report += `${i + 1}. ${t}\n`;
                        });
                      } else {
                        report += `Load suggestions in the dialog to include them, or no fallback questions to suggest.\n`;
                      }
                      if (d.customerFeedback?.length) {
                        report += `\nCUSTOMER FEEDBACK (how we could improve)\n${"-".repeat(30)}\n`;
                        d.customerFeedback.forEach((f, i) => {
                          report += `${i + 1}. ${f}\n`;
                        });
                      }
                      const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `support-insights-${agentName.replace(/\s+/g, "-")}-${date}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success("Report downloaded");
                    }}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Download report
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold">{insightsData.totalConversations}</p>
                      <p className="text-xs text-muted-foreground">Conversations</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold">{insightsData.totalMessages}</p>
                      <p className="text-xs text-muted-foreground">Total messages</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold">
                        {insightsData.assistantMessageCount > 0
                          ? `${insightsData.fallbackRate.toFixed(1)}%`
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Fallback rate ({insightsData.fallbackCount} of{" "}
                        {insightsData.assistantMessageCount} replies)
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold">
                        {insightsData.ratingCount > 0
                          ? `${insightsData.averageRating ?? "—"} ★`
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Avg rating ({insightsData.ratingCount} response
                        {insightsData.ratingCount !== 1 ? "s" : ""})
                      </p>
                    </CardContent>
                  </Card>
                </div>
                {insightsData.customerFeedback?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Customer feedback (how to improve)</h4>
                    <ul className="rounded-md border divide-y max-h-36 overflow-y-auto">
                      {insightsData.customerFeedback.map((f, i) => (
                        <li key={i} className="px-3 py-2 text-sm">
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-medium mb-2">Frequent questions</h4>
                  {insightsData.frequentQuestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No questions yet.</p>
                  ) : (
                    <ul className="rounded-md border divide-y max-h-48 overflow-y-auto">
                      {insightsData.frequentQuestions.map((q, i) => (
                        <li key={i} className="px-3 py-2 text-sm flex justify-between gap-2">
                          <span className="truncate">{q.text}</span>
                          <span className="text-muted-foreground shrink-0">{q.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Suggested topics</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Questions that triggered the fallback email — consider adding answers to your
                    knowledge base.
                  </p>
                  {suggestionsData ? (
                    <ul className="rounded-md border divide-y max-h-40 overflow-y-auto">
                      {suggestionsData.suggestedTopics.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-muted-foreground">
                          No fallback questions to suggest.
                        </li>
                      ) : (
                        suggestionsData.suggestedTopics.map((topic, i) => (
                          <li key={i} className="px-3 py-2 text-sm">
                            {topic}
                          </li>
                        ))
                      )}
                    </ul>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={suggestionsLoading || !insightsAgent}
                      onClick={async () => {
                        if (!insightsAgent) return;
                        setSuggestionsLoading(true);
                        try {
                          const data = await authenticatedGet<SupportAgentKBSuggestions>(
                            `/api/support-agents/${insightsAgent.id}/insights/suggestions`
                          );
                          setSuggestionsData(data);
                        } catch {
                          toast.error("Failed to load suggestions");
                        } finally {
                          setSuggestionsLoading(false);
                        }
                      }}
                    >
                      {suggestionsLoading ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Load suggestions
                    </Button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </SupportContainer>
  );
}
