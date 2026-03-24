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
  Plus,
  PlugIcon,
  Trash2,
  Users,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod/v3";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  authenticatedDelete,
  authenticatedFetch,
  authenticatedGet,
  authenticatedPost,
} from "@/lib/api-client";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSkills } from "@/hooks/useSkills";
import NextLink from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery } from "@/hooks/useProtectedQuery";
import { useProtectedMutation } from "@/hooks/useProtectedMutation";

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

type SupportContactStats = {
  total: number;
  byPlatform: Record<string, number>;
};

type SupportContact = {
  id: string;
  platform: string;
  externalId: string;
  externalName: string | null;
  phone: string | null;
  firstContactAt: string;
  lastContactAt: string;
};

type SupportContactListResult = {
  contacts: SupportContact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type NewOutboundMessagePlatform = "WHATSAPP";

const SUPPORT_AGENT_STATUS = { ACTIVE: "active", DISABLED: "disabled" } as const;

type FunnelBranch = {
  matchKeywords: string[];
  summary?: string;
  assetUrl?: string;
  assetLabel?: string;
};

type FunnelRule = {
  triggers: string[];
  questionsEnabled?: boolean;
  autoWriteDeliveryMessage?: boolean;
  /** Ordered list of questions. */
  questions?: string[];
  summary: string;
  assetUrl?: string;
  assetLabel?: string;
  maxAgentReplies?: number;
  branches?: FunnelBranch[];
  followUpEnabled?: boolean;
  followUps?: Array<{
    message: string;
    /** true = send verbatim; false = AI generates contextual nudge from message as topic */
    useCustomMessage?: boolean;
    scheduleType?: "delay" | "datetime";
    delayMinutes?: number;
    sendAt?: string;
    ctaUrl?: string;
  }>;
};

const supportAgentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  fallbackEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  greeting: z.string().optional(),
  brandColor: z.string().optional(),
  position: z.string().optional(),
  knowledgeBaseIds: z.array(z.string()).optional(),
  mode: z.enum(["support", "sdr"]).optional(),
  skillIds: z.array(z.string()).optional(),
  soulMd: z.string().optional().nullable(),
  campaignContext: z.string().optional().nullable(),
  funnelRules: z.record(z.unknown()).optional().nullable(),
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
      mode: "support",
      skillIds: [],
      soulMd: null,
      campaignContext: null,
      funnelRules: { rules: [] },
    },
  });

  const [editing, setEditing] = useState<SupportAgent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
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
  const [refreshingWhatsApp, setRefreshingWhatsApp] = useState(false);
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
  const formMode = form.watch("mode") || "support";
  const funnelRulesForm = form.watch("funnelRules") as { rules: FunnelRule[] } | undefined;
  const { data: skillsData } = useSkills(1, 100);
  const [contactsAgent, setContactsAgent] = useState<SupportAgent | null>(null);
  const [contactsPage, setContactsPage] = useState(1);
  const [exportingVcf, setExportingVcf] = useState(false);
  const [contactsPlatform, setContactsPlatform] = useState<"ALL" | "WHATSAPP" | "TELEGRAM">("ALL");
  const [contactsQuery, setContactsQuery] = useState("");
  const [messageContact, setMessageContact] = useState<SupportContact | null>(null);
  const [messageText, setMessageText] = useState("");
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [newMessagePlatform] = useState<NewOutboundMessagePlatform>("WHATSAPP");
  const [newMessageName, setNewMessageName] = useState("");
  const [newMessagePhone, setNewMessagePhone] = useState("");
  const [newMessageSave, setNewMessageSave] = useState(true);
  const [newMessageText, setNewMessageText] = useState("");
  const [questionEditorsOpen, setQuestionEditorsOpen] = useState<Record<number, boolean>>({});
  const [branchEditorsOpen, setBranchEditorsOpen] = useState<Record<number, boolean>>({});
  const queryClient = useQueryClient();

  // Keep question editor UI state in sync with the rules list.
  // Index-keyed state can drift when rules are added/removed, or when re-opening the dialog.
  const rulesLength = (funnelRulesForm?.rules ?? []).length;
  useEffect(() => {
    setQuestionEditorsOpen({});
    setBranchEditorsOpen({});
  }, [rulesLength, dialogOpen]);

  const messageContactMutation = useProtectedMutation<
    { ok: boolean; platform: string },
    Error,
    { agentId: string; contactId: string; text: string }
  >({
    mutationFn: async (vars) => {
      return authenticatedPost(
        `/api/support-agents/${vars.agentId}/contacts/${vars.contactId}/message`,
        { text: vars.text }
      );
    },
    onSuccess: () => {
      toast.success("Message sent");
      setMessageText("");
      setMessageContact(null);
    },
    onError: (err) => {
      const msg =
        (err && typeof (err as any).message === "string" && (err as any).message.trim()) ||
        "Failed to send message";
      toast.error(msg);
    },
  });

  const newOutboundMessageMutation = useProtectedMutation<
    { ok: boolean; platform: string },
    Error,
    {
      agentId: string;
      platform: NewOutboundMessagePlatform;
      text: string;
      saveToContacts: boolean;
      name?: string;
      phone?: string;
    }
  >({
    mutationFn: async (vars) => {
      return authenticatedPost(`/api/support-agents/${vars.agentId}/contacts/message`, {
        platform: vars.platform,
        text: vars.text,
        saveToContacts: vars.saveToContacts,
        name: vars.name || undefined,
        phone: vars.phone || undefined,
      });
    },
    onSuccess: async () => {
      toast.success("Message sent");
      setNewMessageText("");
      setNewMessagePhone("");
      setNewMessageName("");
      setNewMessageSave(true);
      setNewMessageOpen(false);
      if (contactsAgent?.id) {
        await queryClient.invalidateQueries({
          queryKey: ["support-agent-contacts", contactsAgent.id],
        });
        await queryClient.invalidateQueries({
          queryKey: ["support-agent-contacts-stats", contactsAgent.id],
        });
      }
    },
    onError: (err) => {
      const msg =
        (err && typeof (err as any).message === "string" && (err as any).message.trim()) ||
        "Failed to send message";
      toast.error(msg);
    },
  });
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
    if (!dialogOpen) {
      setQuestionEditorsOpen({});
      setBranchEditorsOpen({});
    }
  }, [dialogOpen]);

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

  const contactsStatsQuery = useProtectedQuery<SupportContactStats>({
    queryKey: ["support-agent-contacts-stats", contactsAgent?.id],
    queryFn: () =>
      authenticatedGet<SupportContactStats>(
        `/api/support-agents/${contactsAgent?.id}/contacts/stats`
      ),
    enabled: !!contactsAgent?.id,
    redirectToLogin: true,
  });

  const contactsListQuery = useProtectedQuery<SupportContactListResult>({
    queryKey: ["support-agent-contacts", contactsAgent?.id, contactsPlatform, contactsPage],
    queryFn: () => {
      const agentId = contactsAgent?.id;
      const platformParam = contactsPlatform !== "ALL" ? `&platform=${contactsPlatform}` : "";
      return authenticatedGet<SupportContactListResult>(
        `/api/support-agents/${agentId}/contacts?page=${contactsPage}&limit=10${platformParam}`
      );
    },
    enabled: !!contactsAgent?.id,
    redirectToLogin: true,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (!contactsAgent?.id) return;
    // Prefetch platform lists so switching tabs feels instant.
    const agentId = contactsAgent.id;
    const prefetch = (platform: "WHATSAPP" | "TELEGRAM") => {
      return queryClient.prefetchQuery({
        queryKey: ["support-agent-contacts", agentId, platform, 1],
        queryFn: () =>
          authenticatedGet<SupportContactListResult>(
            `/api/support-agents/${agentId}/contacts?page=1&limit=10&platform=${platform}`
          ),
      });
    };
    void prefetch("WHATSAPP").catch(() => undefined);
    void prefetch("TELEGRAM").catch(() => undefined);
  }, [contactsAgent?.id, queryClient]);

  useEffect(() => {
    // Reset pagination when switching platform.
    setContactsPage(1);
  }, [contactsPlatform]);

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

  const parseFunnelRules = (raw: unknown): { rules: FunnelRule[] } => {
    if (!raw || typeof raw !== "object") return { rules: [] };
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.rules)) {
      return {
        rules: (obj.rules as Array<Record<string, unknown>>).map((r) => {
          // Normalize questions: new format is questions[], legacy is question1/question2.
          const q1Legacy = (r.question1 as string) || "";
          const q2Legacy = (r.question2 as string) || "";
          const questions: string[] = Array.isArray(r.questions)
            ? (r.questions as string[])
            : [q1Legacy, q2Legacy].filter(Boolean);

          return {
            triggers: Array.isArray(r.triggers) ? (r.triggers as string[]) : [],
            questionsEnabled: r.questionsEnabled === true || questions.length > 0,
            autoWriteDeliveryMessage: r.autoWriteDeliveryMessage === true,
            questions,
            summary: (r.summary as string) || "",
            assetUrl: (r.assetUrl as string) || undefined,
            assetLabel: (r.assetLabel as string) || undefined,
            maxAgentReplies:
              typeof r.maxAgentReplies === "number" ? (r.maxAgentReplies as number) : 3,
            branches: Array.isArray(r.branches)
              ? (r.branches as Array<Record<string, unknown>>).map((b) => ({
                  matchKeywords: Array.isArray(b.matchKeywords)
                    ? (b.matchKeywords as string[])
                    : [],
                  summary: (b.summary as string) || "",
                  assetUrl: (b.assetUrl as string) || "",
                  assetLabel: (b.assetLabel as string) || "",
                }))
              : [],
            followUpEnabled: r.followUpEnabled === true,
            followUps: Array.isArray(r.followUps)
              ? (r.followUps as Array<Record<string, unknown>>)
                  .map((f) => ({
                    message: (f.message as string) || "",
                    useCustomMessage: f.useCustomMessage === true,
                    scheduleType: ((f.scheduleType as string) || "delay") as "delay" | "datetime",
                    delayMinutes:
                      typeof f.delayMinutes === "number" ? (f.delayMinutes as number) : 30,
                    sendAt: (f.sendAt as string) || "",
                    ctaUrl: (f.ctaUrl as string) || "",
                  }))
                  .filter((f) => !!f.message)
              : (r.followUpMessage as string)
                ? [
                    {
                      message: (r.followUpMessage as string) || "",
                      delayMinutes:
                        typeof r.followUpDelayMinutes === "number"
                          ? (r.followUpDelayMinutes as number)
                          : 30,
                      sendAt: "",
                      ctaUrl: "",
                    },
                  ]
                : [],
          };
        }),
      };
    }
    return { rules: [] };
  };

  const openCreateDialog = () => {
    setEditing(null);
    setQuestionEditorsOpen({});
    setBranchEditorsOpen({});
    form.reset({
      name: "",
      description: "",
      fallbackEmail: "",
      greeting: "",
      brandColor: "#6366f1",
      position: "bottom-right",
      knowledgeBaseIds: [],
      mode: "support",
      skillIds: [],
      soulMd: null,
      campaignContext: null,
      funnelRules: { rules: [] },
    });
    setDialogOpen(true);
  };

  const openEditDialog = (agent: SupportAgent) => {
    setEditing(agent);
    setQuestionEditorsOpen({});
    setBranchEditorsOpen({});
    form.reset({
      name: agent.name,
      description: agent.description ?? "",
      fallbackEmail: agent.fallbackEmail ?? "",
      greeting: agent.greeting ?? "",
      brandColor: agent.brandColor ?? "#6366f1",
      position: agent.position ?? "bottom-right",
      knowledgeBaseIds: agent.knowledgeBaseIds ?? [],
      mode: (agent.mode as "support" | "sdr") || "support",
      skillIds: agent.skillIds ?? [],
      soulMd: agent.soulMd ?? null,
      campaignContext: agent.campaignContext ?? null,
      funnelRules: parseFunnelRules(agent.funnelRules),
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: SupportAgentFormValues) => {
    setIsFormSubmitting(true);
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: values });
      } else {
        await createMutation.mutateAsync(values);
      }
      setDialogOpen(false);
    } catch {
      // hooks already toast on error
    } finally {
      setIsFormSubmitting(false);
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
      setWhatsappStatus({
        status: res.status,
        qr: res.status === "connected" ? null : (res.qr ?? null),
      });

      const channelsRes = await authenticatedGet<{ success: boolean; channels: SupportChannel[] }>(
        `/api/support/agents/${channelsAgent.id}/channels`
      );
      setChannels(channelsRes.channels || []);

      // Poll until QR appears, then keep polling until connected (user scans QR).
      if (res.status !== "connected") {
        const agentId = channelsAgent.id;
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 2500));
          try {
            const statusRes = await authenticatedGet<{
              success: boolean;
              status: string;
              qr: string | null;
            }>(`/api/support/agents/${agentId}/channels/whatsapp/status`);
            setWhatsappStatus({
              status: statusRes.status,
              qr: statusRes.status === "connected" ? null : statusRes.qr,
            });
            if (statusRes.status === "connected") {
              toast.success("WhatsApp connected successfully!");
              void refreshChannels(agentId).catch(() => undefined);
              break;
            }
          } catch {
            break;
          }
        }
      }
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

  const handleRefreshWhatsApp = async () => {
    if (!channelsAgent) return;
    setRefreshingWhatsApp(true);
    try {
      const statusRes = await authenticatedGet<{
        success: boolean;
        status: string;
        qr: string | null;
      }>(`/api/support/agents/${channelsAgent.id}/channels/whatsapp/status`);
      setWhatsappStatus({
        status: statusRes.status,
        qr: statusRes.status === "connected" ? null : statusRes.qr,
      });
      void refreshChannels(channelsAgent.id).catch(() => undefined);
      toast.success("WhatsApp status updated.");
    } catch {
      toast.error("Failed to refresh WhatsApp status.");
    } finally {
      setRefreshingWhatsApp(false);
    }
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

  const rules = funnelRulesForm?.rules ?? [];
  const addFunnelRule = () => {
    form.setValue(
      "funnelRules",
      {
        rules: [
          ...rules,
          {
            triggers: [],
            questionsEnabled: false,
            autoWriteDeliveryMessage: false,
            questions: [],
            summary: "",
            assetUrl: "",
            assetLabel: "",
            maxAgentReplies: 3,
            branches: [],
            followUpEnabled: false,
            followUps: [],
          },
        ],
      },
      { shouldDirty: true }
    );
    setQuestionEditorsOpen({});
    setBranchEditorsOpen({});
  };
  const removeFunnelRule = (index: number) => {
    form.setValue(
      "funnelRules",
      { rules: rules.filter((_, i) => i !== index) },
      { shouldDirty: true }
    );
    setQuestionEditorsOpen({});
    setBranchEditorsOpen({});
  };
  const updateFunnelRule = (
    index: number,
    field: keyof FunnelRule,
    value:
      | string
      | string[]
      | boolean
      | number
      | FunnelBranch[]
      | Array<{
          message: string;
          scheduleType?: "delay" | "datetime";
          delayMinutes?: number;
          sendAt?: string;
          ctaUrl?: string;
        }>
  ) => {
    const next = rules.map((r, i) =>
      i === index
        ? {
            ...r,
            [field]:
              field === "triggers" && typeof value === "string"
                ? value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : value,
          }
        : r
    );
    form.setValue("funnelRules", { rules: next }, { shouldDirty: true });
  };
  const addFollowUp = (ruleIndex: number) => {
    const current = rules[ruleIndex]?.followUps ?? [];
    updateFunnelRule(ruleIndex, "followUps", [
      ...current,
      {
        message: "",
        useCustomMessage: false,
        scheduleType: "delay",
        delayMinutes: 30,
        sendAt: "",
        ctaUrl: "",
      },
    ]);
  };
  const removeFollowUp = (ruleIndex: number, followUpIndex: number) => {
    const current = rules[ruleIndex]?.followUps ?? [];
    updateFunnelRule(
      ruleIndex,
      "followUps",
      current.filter((_, idx) => idx !== followUpIndex)
    );
  };
  const updateFollowUp = (
    ruleIndex: number,
    followUpIndex: number,
    field: "message" | "ctaUrl",
    value: string
  ) => {
    const current = [...(rules[ruleIndex]?.followUps ?? [])];
    if (!current[followUpIndex]) return;
    current[followUpIndex] = { ...current[followUpIndex], [field]: value };
    updateFunnelRule(ruleIndex, "followUps", current);
  };
  const toggleFollowUpCustomMessage = (ruleIndex: number, followUpIndex: number) => {
    const current = [...(rules[ruleIndex]?.followUps ?? [])];
    if (!current[followUpIndex]) return;
    current[followUpIndex] = {
      ...current[followUpIndex],
      useCustomMessage: !current[followUpIndex].useCustomMessage,
    };
    updateFunnelRule(ruleIndex, "followUps", current);
  };
  const updateFollowUpDelay = (ruleIndex: number, followUpIndex: number, delayMinutes: number) => {
    const current = [...(rules[ruleIndex]?.followUps ?? [])];
    if (!current[followUpIndex]) return;
    current[followUpIndex] = {
      ...current[followUpIndex],
      scheduleType: "delay",
      sendAt: "",
      delayMinutes: Math.min(60, Math.max(1, Math.floor(delayMinutes || 30))),
    };
    updateFunnelRule(ruleIndex, "followUps", current);
  };
  const updateFollowUpSendAt = (ruleIndex: number, followUpIndex: number, sendAt: string) => {
    const current = [...(rules[ruleIndex]?.followUps ?? [])];
    if (!current[followUpIndex]) return;
    current[followUpIndex] = {
      ...current[followUpIndex],
      scheduleType: "datetime",
      delayMinutes: 30,
      sendAt: sendAt || "",
    };
    updateFunnelRule(ruleIndex, "followUps", current);
  };
  const updateFollowUpScheduleType = (
    ruleIndex: number,
    followUpIndex: number,
    scheduleType: "delay" | "datetime"
  ) => {
    const current = [...(rules[ruleIndex]?.followUps ?? [])];
    if (!current[followUpIndex]) return;
    if (scheduleType === "delay") {
      current[followUpIndex] = {
        ...current[followUpIndex],
        scheduleType: "delay",
        sendAt: "",
        delayMinutes: Math.min(
          60,
          Math.max(1, Math.floor(current[followUpIndex].delayMinutes || 30))
        ),
      };
    } else {
      current[followUpIndex] = {
        ...current[followUpIndex],
        scheduleType: "datetime",
        delayMinutes: 30,
        sendAt: current[followUpIndex].sendAt || "",
      };
    }
    updateFunnelRule(ruleIndex, "followUps", current);
  };
  const isQuestionEditorOpen = (rule: FunnelRule, index: number): boolean => {
    const hasSavedQuestions = (rule.questions ?? []).some((q) => q.trim().length > 0);
    return questionEditorsOpen[index] === true || hasSavedQuestions;
  };

  const isBranchEditorOpen = (rule: FunnelRule, index: number): boolean => {
    const hasSavedBranches = (rule.branches ?? []).length > 0;
    return branchEditorsOpen[index] === true || hasSavedBranches;
  };

  const addBranch = (ruleIndex: number) => {
    const current = rules[ruleIndex]?.branches ?? [];
    updateFunnelRule(ruleIndex, "branches", [
      ...current,
      { matchKeywords: [], summary: "", assetUrl: "", assetLabel: "" },
    ]);
  };

  const removeBranch = (ruleIndex: number, branchIndex: number) => {
    const current = rules[ruleIndex]?.branches ?? [];
    const next = current.filter((_, i) => i !== branchIndex);
    updateFunnelRule(ruleIndex, "branches", next);
    if (next.length === 0) {
      setBranchEditorsOpen((prev) => ({ ...prev, [ruleIndex]: false }));
    }
  };

  const updateBranch = (
    ruleIndex: number,
    branchIndex: number,
    field: keyof FunnelBranch,
    value: string
  ) => {
    const current = [...(rules[ruleIndex]?.branches ?? [])];
    if (!current[branchIndex]) return;
    const parsed =
      field === "matchKeywords"
        ? value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : value;
    current[branchIndex] = { ...current[branchIndex], [field]: parsed };
    updateFunnelRule(ruleIndex, "branches", current);
  };

  const addQuestion = (ruleIndex: number) => {
    const current = [...(rules[ruleIndex]?.questions ?? [])];
    updateFunnelRule(ruleIndex, "questions", [...current, ""]);
    updateFunnelRule(ruleIndex, "questionsEnabled", true);
    setQuestionEditorsOpen((prev) => ({ ...prev, [ruleIndex]: true }));
  };

  const removeQuestion = (ruleIndex: number, qIndex: number) => {
    const next = (rules[ruleIndex]?.questions ?? []).filter((_, i) => i !== qIndex);
    updateFunnelRule(ruleIndex, "questions", next);
    if (next.length === 0) {
      updateFunnelRule(ruleIndex, "questionsEnabled", false);
      updateFunnelRule(ruleIndex, "summary", "");
      updateFunnelRule(ruleIndex, "branches", []);
      setQuestionEditorsOpen((prev) => ({ ...prev, [ruleIndex]: false }));
      setBranchEditorsOpen((prev) => ({ ...prev, [ruleIndex]: false }));
    }
  };

  const updateQuestion = (ruleIndex: number, qIndex: number, text: string) => {
    const current = [...(rules[ruleIndex]?.questions ?? [])];
    current[qIndex] = text;
    updateFunnelRule(ruleIndex, "questions", current);
  };

  const dialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] sm:w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Support Agent" : "New Support Agent"}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 flex-1 overflow-y-auto pr-1 -mr-1">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <p className="text-xs text-muted-foreground">
                Must be unique among your support agents.
              </p>
              <Input id="name" {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <Tabs
                value={formMode}
                onValueChange={(v) =>
                  form.setValue("mode", v as "support" | "sdr", { shouldDirty: true })
                }
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="support">Support</TabsTrigger>
                  <TabsTrigger value="sdr">SDR</TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-xs text-muted-foreground">
                {formMode === "support"
                  ? "Knowledge Based answers with agent"
                  : "Agentic funnel automation with user-defined triggers"}
              </p>
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
            {formMode === "support" && (
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
            )}
            {formMode === "sdr" && (
              <div className="space-y-2">
                <Label>Skills</Label>
                {(skillsData?.skills ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    You have no skills yet.{" "}
                    <NextLink href="/skills" className="text-primary underline">
                      Create a skill
                    </NextLink>{" "}
                    to attach knowledge for nuanced replies.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-32 overflow-y-auto rounded-md border bg-muted/30 px-3 py-2 pr-1">
                    {(skillsData?.skills ?? []).map((skill) => {
                      const selectedSkillIds = form.watch("skillIds") || [];
                      const checked = selectedSkillIds.includes(skill.id);
                      return (
                        <label key={skill.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border"
                            checked={checked}
                            onChange={(e) => {
                              const current = form.getValues("skillIds") || [];
                              if (e.target.checked) {
                                form.setValue("skillIds", [...current, skill.id], {
                                  shouldDirty: true,
                                });
                              } else {
                                form.setValue(
                                  "skillIds",
                                  current.filter((id) => id !== skill.id),
                                  { shouldDirty: true }
                                );
                              }
                            }}
                          />
                          <span className="truncate">{skill.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Attach skills for objection handling and qualification (especially useful for SDR
                  mode).
                </p>
              </div>
            )}
            {formMode === "sdr" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="campaignContext">Campaign context</Label>
                  <Textarea
                    id="campaignContext"
                    rows={4}
                    placeholder="Paste your post, ad copy, or campaign content here. Used for personalization and when the user is vague."
                    value={form.watch("campaignContext") ?? ""}
                    onChange={(e) =>
                      form.setValue("campaignContext", e.target.value || null, {
                        shouldDirty: true,
                      })
                    }
                    className="resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Funnel rules</Label>
                  <p className="text-xs text-muted-foreground">
                    Trigger-based flow with flexible paths: direct trigger to CTA, Q1 only, or Q1 +
                    Q2. Use {"{{answer1}}"} and {"{{answer2}}"} in later steps to personalize.
                  </p>
                  <div className="space-y-3 max-h-48 overflow-y-auto rounded-md border p-3">
                    {rules.map((rule, idx) => (
                      <div key={idx} className="rounded border bg-muted/20 p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium">Rule {idx + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => removeFunnelRule(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Trigger phrases (comma-separated, e.g. Template, Reach)"
                          value={rule.triggers?.join(", ") ?? ""}
                          onChange={(e) => updateFunnelRule(idx, "triggers", e.target.value)}
                        />
                        {!isQuestionEditorOpen(rule, idx) && (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                              placeholder="Asset URL (optional)"
                              value={rule.assetUrl ?? ""}
                              onChange={(e) => updateFunnelRule(idx, "assetUrl", e.target.value)}
                              className="flex-1 min-w-0"
                            />
                            <Input
                              placeholder="Link label (optional)"
                              value={rule.assetLabel ?? ""}
                              onChange={(e) => updateFunnelRule(idx, "assetLabel", e.target.value)}
                              className="sm:w-36 flex-shrink-0"
                            />
                          </div>
                        )}
                        {!isQuestionEditorOpen(rule, idx) && (
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={rule.autoWriteDeliveryMessage === true}
                              onChange={(e) =>
                                updateFunnelRule(idx, "autoWriteDeliveryMessage", e.target.checked)
                              }
                            />
                            <span>Auto-write delivery message (keyword-only)</span>
                          </label>
                        )}
                        {/* Dynamic question list */}
                        {(rule.questions ?? []).map((q, qIdx) => (
                          <div
                            key={`${idx}-q-${qIdx}`}
                            className="rounded border bg-muted/10 p-2 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">
                                Question {qIdx + 1}
                                {qIdx > 0 && (
                                  <span className="ml-1 text-[10px] text-muted-foreground/60">
                                    (use {`{{answer${qIdx}}}`} to ref previous answer)
                                  </span>
                                )}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => removeQuestion(idx, qIdx)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                            <Textarea
                              rows={2}
                              placeholder={
                                qIdx === 0
                                  ? "Question 1"
                                  : `Question ${qIdx + 1} (optional: use {{answer${qIdx}}})`
                              }
                              value={q}
                              onChange={(e) => updateQuestion(idx, qIdx, e.target.value)}
                            />
                          </div>
                        ))}
                        {/* Add question / enter question mode */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addQuestion(idx)}
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          {(rule.questions ?? []).length === 0
                            ? "Add question"
                            : "Add another question"}
                        </Button>
                        {isQuestionEditorOpen(rule, idx) && (
                          <div className="space-y-2">
                            <Textarea
                              placeholder={`Final CTA message (optional, use {{answer1}}${(rule.questions ?? []).length > 1 ? ", {{answer2}}, ..." : ""})`}
                              rows={2}
                              value={rule.summary ?? ""}
                              onChange={(e) => updateFunnelRule(idx, "summary", e.target.value)}
                            />
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Input
                                placeholder="CTA URL (optional)"
                                value={rule.assetUrl ?? ""}
                                onChange={(e) => updateFunnelRule(idx, "assetUrl", e.target.value)}
                                className="flex-1 min-w-0"
                              />
                              <Input
                                placeholder="Link label (optional)"
                                value={rule.assetLabel ?? ""}
                                onChange={(e) =>
                                  updateFunnelRule(idx, "assetLabel", e.target.value)
                                }
                                className="sm:w-36 flex-shrink-0"
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              CTA link is sent after all questions are answered. For keyword-only
                              rules it is sent immediately.
                            </p>
                          </div>
                        )}
                        {isQuestionEditorOpen(rule, idx) && (
                          <div className="space-y-1">
                            <Input
                              type="number"
                              min={1}
                              placeholder="Max funnel replies (default 3)"
                              value={rule.maxAgentReplies ?? 3}
                              onChange={(e) =>
                                updateFunnelRule(
                                  idx,
                                  "maxAgentReplies",
                                  Number(e.target.value || 3)
                                )
                              }
                            />
                            <p className="text-[11px] text-muted-foreground">
                              Safety cap. Limits total messages this funnel sends before it stops.
                            </p>
                          </div>
                        )}
                        {isQuestionEditorOpen(rule, idx) && (
                          <div className="space-y-2">
                            {!isBranchEditorOpen(rule, idx) ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setBranchEditorsOpen((prev) => ({ ...prev, [idx]: true }));
                                  addBranch(idx);
                                }}
                              >
                                Add answer branches (optional)
                              </Button>
                            ) : (
                              <div className="space-y-2 rounded border bg-muted/30 p-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-medium">Answer branches</p>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs px-2"
                                    onClick={() => {
                                      updateFunnelRule(idx, "branches", []);
                                      setBranchEditorsOpen((prev) => ({ ...prev, [idx]: false }));
                                    }}
                                  >
                                    Remove all branches
                                  </Button>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  Branches route to a specific CTA based on the user&apos;s final
                                  answer. If their last answer contains a branch keyword, that
                                  branch&apos;s asset is delivered. If no branch matches, the
                                  default CTA below is used. Use {"{{answer1}}"}, {"{{answer2}}"}{" "}
                                  etc. in the summary.
                                </p>
                                {(rule.branches ?? []).map((branch, branchIdx) => (
                                  <div
                                    key={`${idx}-branch-${branchIdx}`}
                                    className="rounded border bg-background p-2 space-y-2"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium text-muted-foreground">
                                        Branch {branchIdx + 1}
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => removeBranch(idx, branchIdx)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                      </Button>
                                    </div>
                                    <Input
                                      placeholder="Match keywords (comma-separated, e.g. Reach, reach)"
                                      value={(branch.matchKeywords ?? []).join(", ")}
                                      onChange={(e) =>
                                        updateBranch(
                                          idx,
                                          branchIdx,
                                          "matchKeywords",
                                          e.target.value
                                        )
                                      }
                                    />
                                    <Textarea
                                      rows={2}
                                      placeholder="Branch CTA summary (optional, use {{answer1}})"
                                      value={branch.summary ?? ""}
                                      onChange={(e) =>
                                        updateBranch(idx, branchIdx, "summary", e.target.value)
                                      }
                                    />
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <Input
                                        placeholder="Branch asset URL (optional)"
                                        value={branch.assetUrl ?? ""}
                                        onChange={(e) =>
                                          updateBranch(idx, branchIdx, "assetUrl", e.target.value)
                                        }
                                        className="flex-1 min-w-0"
                                      />
                                      <Input
                                        placeholder="Link label"
                                        value={branch.assetLabel ?? ""}
                                        onChange={(e) =>
                                          updateBranch(idx, branchIdx, "assetLabel", e.target.value)
                                        }
                                        className="sm:w-32 flex-shrink-0"
                                      />
                                    </div>
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addBranch(idx)}
                                  className="w-full"
                                >
                                  <Plus className="mr-2 h-3.5 w-3.5" />
                                  Add branch
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="space-y-2 rounded border bg-muted/20 p-2">
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={rule.followUpEnabled === true}
                              onChange={(e) =>
                                updateFunnelRule(idx, "followUpEnabled", e.target.checked)
                              }
                            />
                            <span>Enable delayed follow-up</span>
                          </label>
                          {rule.followUpEnabled === true && (
                            <div className="space-y-2">
                              <p className="text-[11px] text-muted-foreground">
                                Choose how each follow-up is scheduled. “After minutes” is measured
                                from the last message the agent sent in this funnel (for example:
                                the asset link in keyword-only rules, or the final CTA in
                                question-based funnels).
                              </p>

                              <div className="space-y-2">
                                {(rule.followUps ?? []).map((fu, fuIdx) => (
                                  <div
                                    key={`${idx}-followup-${fuIdx}`}
                                    className="rounded border p-2 space-y-2"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium">
                                        Follow-up message {fuIdx + 1}
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => removeFollowUp(idx, fuIdx)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                      </Button>
                                    </div>
                                    {/* Custom message toggle */}
                                    <div className="flex items-center justify-between rounded border px-2.5 py-1.5 bg-muted/40">
                                      <div className="space-y-0.5">
                                        <p className="text-xs font-medium leading-none">
                                          Use custom message
                                        </p>
                                        <p className="text-[10px] text-muted-foreground leading-snug">
                                          {fu.useCustomMessage
                                            ? "Sending verbatim — exactly what you write below."
                                            : "Agent generates a contextual nudge using your text as a topic."}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        role="switch"
                                        aria-checked={!!fu.useCustomMessage}
                                        onClick={() => toggleFollowUpCustomMessage(idx, fuIdx)}
                                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${fu.useCustomMessage ? "bg-primary" : "bg-input"}`}
                                      >
                                        <span
                                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${fu.useCustomMessage ? "translate-x-4" : "translate-x-0"}`}
                                        />
                                      </button>
                                    </div>
                                    <Textarea
                                      rows={3}
                                      placeholder={
                                        fu.useCustomMessage
                                          ? "Write the exact message to send…"
                                          : "Topic or summary for the agent to expand on…"
                                      }
                                      value={fu.message ?? ""}
                                      onChange={(e) =>
                                        updateFollowUp(idx, fuIdx, "message", e.target.value)
                                      }
                                    />
                                    <div className="space-y-1">
                                      <Label className="text-[11px] text-muted-foreground">
                                        When to send this follow-up
                                      </Label>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          type="button"
                                          variant={
                                            (fu.scheduleType ?? "delay") === "delay"
                                              ? "secondary"
                                              : "outline"
                                          }
                                          size="sm"
                                          onClick={() =>
                                            updateFollowUpScheduleType(idx, fuIdx, "delay")
                                          }
                                        >
                                          After minutes
                                        </Button>
                                        <Button
                                          type="button"
                                          variant={
                                            (fu.scheduleType ?? "delay") === "datetime"
                                              ? "secondary"
                                              : "outline"
                                          }
                                          size="sm"
                                          onClick={() =>
                                            updateFollowUpScheduleType(idx, fuIdx, "datetime")
                                          }
                                        >
                                          Specific date/time
                                        </Button>
                                      </div>
                                      {(fu.scheduleType ?? "delay") === "delay" ? (
                                        <Input
                                          type="number"
                                          min={1}
                                          max={60}
                                          placeholder="Minutes (max 60)"
                                          value={fu.delayMinutes ?? 30}
                                          onChange={(e) =>
                                            updateFollowUpDelay(
                                              idx,
                                              fuIdx,
                                              Number(e.target.value || 30)
                                            )
                                          }
                                        />
                                      ) : (
                                        <Input
                                          type="datetime-local"
                                          value={fu.sendAt ?? ""}
                                          onChange={(e) =>
                                            updateFollowUpSendAt(idx, fuIdx, e.target.value)
                                          }
                                        />
                                      )}
                                      <p className="text-[11px] text-muted-foreground">
                                        Pick one option. Use minutes for relative follow-ups (up to
                                        60 minutes), or choose a specific date/time for a fixed
                                        schedule.
                                      </p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <Input
                                        className="sm:col-span-2"
                                        placeholder="Optional follow-up CTA URL"
                                        value={fu.ctaUrl ?? ""}
                                        onChange={(e) =>
                                          updateFollowUp(idx, fuIdx, "ctaUrl", e.target.value)
                                        }
                                      />
                                    </div>
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addFollowUp(idx)}
                                  className="w-full"
                                >
                                  <Plus className="mr-2 h-3.5 w-3.5" />
                                  Add follow-up message
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addFunnelRule}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Add rule
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="soulMd">Personality / soul (optional)</Label>
                  <Textarea
                    id="soulMd"
                    rows={3}
                    placeholder="Optional: Define how the SDR should speak and behave (tone, style, boundaries)."
                    value={form.watch("soulMd") ?? ""}
                    onChange={(e) =>
                      form.setValue("soulMd", e.target.value || null, { shouldDirty: true })
                    }
                    className="resize-none"
                  />
                </div>
              </>
            )}
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isFormSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isFormSubmitting}>
                {isFormSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editing ? "Saving…" : "Creating…"}
                  </>
                ) : editing ? (
                  "Save changes"
                ) : (
                  "Create"
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
      disabled={createMutation.isPending}
      isCreating={createMutation.isPending}
    >
      <div className="min-w-0 w-full max-w-full overflow-hidden space-y-3">
        <div className="min-w-0 w-full max-w-full overflow-hidden space-y-2 rounded-lg border bg-card p-3 sm:p-4">
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
                className="min-w-0 w-full max-w-full overflow-hidden flex flex-col gap-3 rounded-md border bg-background p-3 sm:p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="h-7 w-7 shrink-0 rounded-md border"
                      style={{ borderColor: agent.brandColor || "#6366f1" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{agent.name}</p>
                        {agent.mode === "sdr" && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 font-medium"
                          >
                            SDR
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {agent.description ||
                          (agent.mode === "sdr"
                            ? "SDR agent with funnel rules"
                            : "Support agent using your knowledge bases")}
                      </p>
                    </div>
                    <div
                      className="flex shrink-0 items-center gap-2"
                      title={
                        agent.status === SUPPORT_AGENT_STATUS.ACTIVE
                          ? "Agent answers messages from connected channels"
                          : "Agent disabled — messages from channels will not be answered"
                      }
                    >
                      <Label
                        htmlFor={`status-${agent.id}`}
                        className="text-xs font-medium whitespace-nowrap cursor-pointer"
                      >
                        {agent.status === SUPPORT_AGENT_STATUS.ACTIVE ? "Active" : "Disabled"}
                      </Label>
                      <Switch
                        id={`status-${agent.id}`}
                        checked={agent.status === SUPPORT_AGENT_STATUS.ACTIVE}
                        disabled={
                          updateMutation.isPending &&
                          (updateMutation.variables as { id: string } | undefined)?.id === agent.id
                        }
                        onCheckedChange={(checked) => {
                          updateMutation.mutate({
                            id: agent.id,
                            data: {
                              status: checked
                                ? SUPPORT_AGENT_STATUS.ACTIVE
                                : SUPPORT_AGENT_STATUS.DISABLED,
                            },
                          });
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground break-words">
                    {agent.knowledgeBaseIds.length
                      ? `${agent.knowledgeBaseIds.length} knowledge base${agent.knowledgeBaseIds.length > 1 ? "s" : ""} linked`
                      : "No knowledge bases linked yet"}
                    {agent.fallbackEmail
                      ? ` • Fallback: ${agent.fallbackEmail}`
                      : " • No fallback email set"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap sm:gap-2">
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(publicLink)
                          .then(() => toast.success("Public chat link copied"))
                          .catch(() => toast.error("Failed to copy link"));
                      }}
                    >
                      <LinkIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(embedCode)
                          .then(() => toast.success("Embed code copied"))
                          .catch(() => toast.error("Failed to copy embed code"));
                      }}
                    >
                      <Code2 className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      Embed
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setChannelsAgent(agent)}
                      title="Manage support channels"
                    >
                      <PlugIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      Channels
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setContactsAgent(agent)}
                      title="View contacts"
                    >
                      <Users className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      Contacts
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setInsightsAgent(agent)}
                      title="View insights"
                    >
                      <BarChart3 className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      Insights
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => openEditDialog(agent)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
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
              Conversations are answered by this agent using your knowledge bases and fallback.
            </p>
            <div className="space-y-3 rounded-lg border bg-card/40 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">WhatsApp</span>
                <Badge
                  variant="outline"
                  className={
                    channels.find((c) => c.platform === "WHATSAPP" && c.status !== "disabled") &&
                    whatsappStatus?.status === "connected"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium"
                      : "text-muted-foreground"
                  }
                >
                  {channelsLoading || refreshingWhatsApp
                    ? "Loading…"
                    : channels.find((c) => c.platform === "WHATSAPP" && c.status !== "disabled") &&
                        whatsappStatus?.status === "connected"
                      ? "Connected"
                      : "Disconnected"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Scan the QR to link your number; the support agent replies to chats on this number.
              </p>
              {channels.find((c) => c.platform === "WHATSAPP" && c.status !== "disabled") &&
              whatsappStatus?.status === "connected" ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={channelsLoading || refreshingWhatsApp}
                    onClick={handleRefreshWhatsApp}
                    className="flex-1"
                  >
                    {refreshingWhatsApp ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnectChannel("WHATSAPP")}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
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
                  {whatsappStatus?.qr && (
                    <div className="mt-1 flex flex-col items-center gap-2 rounded-md border bg-muted/40 p-3">
                      <p className="text-[11px] text-muted-foreground text-center">
                        Scan this QR code with WhatsApp on your phone to connect this support agent
                        to your number.
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
              )}
            </div>

            <div className="space-y-3 rounded-lg border bg-card/40 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Telegram</span>
                <Badge
                  variant="outline"
                  className={
                    telegramChannel
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium"
                      : "text-muted-foreground"
                  }
                >
                  {channelsLoading ? "Loading…" : telegramChannel ? "Connected" : "Disconnected"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Bot token from BotFather. We set the webhook so DMs and groups are answered by this
                agent.
              </p>
              {telegramChannel ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDisconnectChannel("TELEGRAM")}
                >
                  Disconnect
                </Button>
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
              {/* {telegramWebhookUrl && (
                <p className="text-[11px] text-muted-foreground break-all">
                  Webhook URL: {telegramWebhookUrl}
                </p>
              )} */}
            </div>

            <div className="space-y-3 rounded-lg border bg-card/40 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Slack</span>
                <Badge
                  variant="outline"
                  className={
                    slackChannel
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium"
                      : "text-muted-foreground"
                  }
                >
                  {channelsLoading ? "Loading…" : slackChannel ? "Connected" : "Disconnected"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Bot token and signing secret. Set your Slack app Events URL to the URL shown after
                connecting.
              </p>
              {slackChannel ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDisconnectChannel("SLACK")}
                >
                  Disconnect
                </Button>
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

            <div className="space-y-3 rounded-lg border bg-card/40 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Discord</span>
                <Badge
                  variant="outline"
                  className={
                    discordChannel
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium"
                      : "text-muted-foreground"
                  }
                >
                  {channelsLoading ? "Loading…" : discordChannel ? "Connected" : "Disconnected"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Discord connector. Add the bot to your server; messages are answered by this agent.
              </p>
              {discordChannel ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDisconnectChannel("DISCORD")}
                >
                  Disconnect
                </Button>
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
                        <li key={i} className="px-3 py-2 text-sm">
                          <span className="truncate">{q.text}</span>
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

      {/* Contacts dialog */}
      <Dialog
        open={!!contactsAgent}
        onOpenChange={(open) => {
          if (!open) {
            setContactsAgent(null);
            setContactsPlatform("ALL");
            setContactsQuery("");
            setContactsPage(1);
            setMessageContact(null);
            setMessageText("");
            setNewMessageOpen(false);
            setNewMessageText("");
            setNewMessagePhone("");
            setNewMessageName("");
          }
        }}
      >
        <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full sm:max-w-2xl h-[82vh] max-h-[82vh] min-h-[560px] flex flex-col">
          <DialogHeader>
            <DialogTitle className="pr-8">
              {contactsAgent?.name ?? "Support agent"} — Contacts
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1 min-h-0">
            {contactsStatsQuery.isLoading || contactsListQuery.isLoading ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading contacts</p>
              </div>
            ) : contactsStatsQuery.data ? (
              <>
                <p className="text-xs text-muted-foreground">
                  People who messaged this agent via WhatsApp or Telegram. Export to add them to
                  your address book.
                </p>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => setNewMessageOpen(true)}
                  >
                    <Mail className="mr-2 h-3.5 w-3.5" />
                    Send WhatsApp message
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={contactsStatsQuery.data.total === 0 || exportingVcf}
                      >
                        {exportingVcf ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-3.5 w-3.5" />
                        )}
                        Export VCF
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        disabled={contactsStatsQuery.data.total === 0 || exportingVcf}
                        onClick={async () => {
                          if (!contactsAgent || contactsStatsQuery.data.total === 0) return;
                          setExportingVcf(true);
                          try {
                            const res = await authenticatedFetch(
                              `/api/support-agents/${contactsAgent.id}/contacts/export`
                            );
                            if (!res.ok) throw new Error("Export failed");
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `support-contacts-${contactsAgent.name.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.vcf`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success("All contacts exported as VCF");
                          } catch {
                            toast.error("Failed to export contacts");
                          } finally {
                            setExportingVcf(false);
                          }
                        }}
                      >
                        Export all ({contactsStatsQuery.data.total})
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={
                          (contactsStatsQuery.data.byPlatform?.WHATSAPP ?? 0) === 0 || exportingVcf
                        }
                        onClick={async () => {
                          if (!contactsAgent) return;
                          setExportingVcf(true);
                          try {
                            const res = await authenticatedFetch(
                              `/api/support-agents/${contactsAgent.id}/contacts/export?platform=WHATSAPP`
                            );
                            if (!res.ok) throw new Error("Export failed");
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `support-contacts-${contactsAgent.name.replace(/\s+/g, "-")}-whatsapp-${new Date().toISOString().slice(0, 10)}.vcf`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success("WhatsApp contacts exported as VCF");
                          } catch {
                            toast.error("Failed to export contacts");
                          } finally {
                            setExportingVcf(false);
                          }
                        }}
                      >
                        Export WhatsApp only ({contactsStatsQuery.data.byPlatform?.WHATSAPP ?? 0})
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={
                          (contactsStatsQuery.data.byPlatform?.TELEGRAM ?? 0) === 0 || exportingVcf
                        }
                        onClick={async () => {
                          if (!contactsAgent) return;
                          setExportingVcf(true);
                          try {
                            const res = await authenticatedFetch(
                              `/api/support-agents/${contactsAgent.id}/contacts/export?platform=TELEGRAM`
                            );
                            if (!res.ok) throw new Error("Export failed");
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `support-contacts-${contactsAgent.name.replace(/\s+/g, "-")}-telegram-${new Date().toISOString().slice(0, 10)}.vcf`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success("Telegram contacts exported as VCF");
                          } catch {
                            toast.error("Failed to export contacts");
                          } finally {
                            setExportingVcf(false);
                          }
                        }}
                      >
                        Export Telegram only ({contactsStatsQuery.data.byPlatform?.TELEGRAM ?? 0})
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold">{contactsStatsQuery.data.total}</p>
                      <p className="text-xs text-muted-foreground">Total contacts</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold">
                        {contactsStatsQuery.data.byPlatform?.WHATSAPP ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">WhatsApp</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold">
                        {contactsStatsQuery.data.byPlatform?.TELEGRAM ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Telegram</p>
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-2">
                    {/* <div className="space-y-1">
                      <h4 className="text-sm font-medium">Contact List</h4>
                      <p className="text-xs text-muted-foreground">
                        Filter by platform or search by name or phone
                      </p>
                    </div> */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <Tabs
                        value={contactsPlatform}
                        onValueChange={(v) => {
                          const next = (v as "ALL" | "WHATSAPP" | "TELEGRAM") || "ALL";
                          setContactsPlatform(next);
                          setContactsPage(1);
                        }}
                      >
                        <TabsList className="h-9">
                          <TabsTrigger value="ALL" className="text-xs">
                            All
                          </TabsTrigger>
                          <TabsTrigger value="WHATSAPP" className="text-xs">
                            WhatsApp
                          </TabsTrigger>
                          <TabsTrigger value="TELEGRAM" className="text-xs">
                            Telegram
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <Input
                        value={contactsQuery}
                        onChange={(e) => setContactsQuery(e.target.value)}
                        placeholder="Search by name or phone"
                        className="h-9 w-full sm:w-[220px]"
                      />
                    </div>
                  </div>
                  {contactsListQuery.isFetching && !contactsListQuery.data ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !contactsListQuery.data?.contacts?.length ? (
                    <div className="rounded-md border bg-muted/30 px-3 py-10">
                      <p className="text-sm text-muted-foreground">
                        No contacts yet. Contacts are saved when users message this agent via
                        WhatsApp or Telegram.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-md border overflow-hidden">
                        <div className="grid grid-cols-12 gap-3 px-3 py-2 bg-muted/30 text-[11px] font-medium text-muted-foreground">
                          <div className="col-span-5">Contact</div>
                          <div className="col-span-2">Platform</div>
                          <div className="col-span-3 text-right">Last seen</div>
                          <div className="col-span-2 text-right">Actions</div>
                        </div>
                        <div className="divide-y">
                          {contactsListQuery.data.contacts
                            .filter((c) => {
                              const q = contactsQuery.trim().toLowerCase();
                              if (!q) return true;
                              return (
                                (c.externalName || "").toLowerCase().includes(q) ||
                                (c.phone || "").toLowerCase().includes(q) ||
                                (c.externalId || "").toLowerCase().includes(q)
                              );
                            })
                            .map((c) => {
                              const displayName = c.externalName || c.phone || "Unknown contact";
                              const lastSeen = c.lastContactAt
                                ? new Date(c.lastContactAt).toLocaleString([], {
                                    month: "short",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—";
                              return (
                                <div
                                  key={c.id}
                                  className="grid grid-cols-12 gap-3 px-3 py-2.5 text-sm items-center"
                                >
                                  <div className="col-span-5 min-w-0">
                                    <div className="font-medium truncate">{displayName}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {c.phone || c.externalId}
                                    </div>
                                  </div>
                                  <div className="col-span-2 flex items-center">
                                    <Badge variant="outline" className="text-[11px]">
                                      {c.platform}
                                    </Badge>
                                  </div>
                                  <div className="col-span-3 text-right text-xs text-muted-foreground flex items-center justify-end">
                                    <span>{lastSeen}</span>
                                  </div>
                                  <div className="col-span-2 flex justify-end">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 px-2"
                                      onClick={() => {
                                        setMessageContact(c);
                                        setMessageText("");
                                      }}
                                    >
                                      <Mail className="h-3.5 w-3.5 mr-1" />
                                      Message
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                      {contactsListQuery.data.totalPages > 1 && (
                        <div className="mt-6 flex justify-center">
                          <EntityPagination
                            currentPage={contactsPage}
                            totalPages={contactsListQuery.data.totalPages}
                            onPageChange={(p) => setContactsPage(p)}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* New outbound message dialog */}
      <Dialog
        open={newMessageOpen}
        onOpenChange={(open) => {
          if (!open) {
            setNewMessageOpen(false);
            setNewMessageText("");
          } else {
            setNewMessageOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-lg w-[calc(100%-2rem)] sm:w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send WhatsApp message</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Name (optional)</Label>
                <Input
                  value={newMessageName}
                  onChange={(e) => setNewMessageName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp number</Label>
                <Input
                  value={newMessagePhone}
                  onChange={(e) => setNewMessagePhone(e.target.value)}
                  placeholder="e.g. +49123456789"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                placeholder="Type your message..."
                className="min-h-[120px]"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Save to contacts</p>
                <p className="text-xs text-muted-foreground">
                  Adds this recipient to your contact list for future messaging and broadcasts.
                </p>
              </div>
              <Switch
                checked={newMessageSave}
                onCheckedChange={(v) => setNewMessageSave(Boolean(v))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNewMessageOpen(false);
                setNewMessageText("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !contactsAgent?.id ||
                !newMessageText.trim() ||
                newOutboundMessageMutation.isPending ||
                !newMessagePhone.trim()
              }
              onClick={() => {
                if (!contactsAgent?.id) return;
                newOutboundMessageMutation.mutate({
                  agentId: contactsAgent.id,
                  platform: "WHATSAPP",
                  text: newMessageText.trim(),
                  saveToContacts: newMessageSave,
                  name: newMessageName.trim() || undefined,
                  phone: newMessagePhone.trim(),
                });
              }}
            >
              {newOutboundMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message contact dialog */}
      <Dialog
        open={!!messageContact}
        onOpenChange={(open) => {
          if (!open) {
            setMessageContact(null);
            setMessageText("");
          }
        }}
      >
        <DialogContent className="max-w-lg w-[calc(100%-2rem)] sm:w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Message{" "}
              {messageContact?.externalName ||
                messageContact?.phone ||
                `Contact (${messageContact?.platform || ""})`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[120px]"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMessageContact(null);
                setMessageText("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !contactsAgent?.id ||
                !messageContact?.id ||
                !messageText.trim() ||
                messageContactMutation.isPending
              }
              onClick={() => {
                if (!contactsAgent?.id || !messageContact?.id) return;
                messageContactMutation.mutate({
                  agentId: contactsAgent.id,
                  contactId: messageContact.id,
                  text: messageText.trim(),
                });
              }}
            >
              {messageContactMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SupportContainer>
  );
}
