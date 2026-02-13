import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery, useProtectedMutation } from "@/hooks/useProtectedApi";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedPut,
  authenticatedDelete,
} from "@/lib/api-client";
import { toast } from "sonner";

// ============================================
// Types
// ============================================

export interface ChatIntegration {
  id: string;
  label: string;
  platform: "TELEGRAM" | "WHATSAPP" | "DISCORD" | "SLACK";
  scope: "SINGLE_WORKFLOW" | "ALL_WORKFLOWS" | "ALLOW_LIST";
  scopeWorkflowId?: string | null;
  allowedWorkflowIds?: string[];
  webhookUrl: string | null;
  secretPreview: string;
  isActive: boolean;
  defaultWorkflowId: string | null;
  allowPlanMode: boolean;
  allowWorkflowExecution: boolean;
  totalRequests: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  telegramBotTokenSet?: boolean;
  whatsappSessionId?: string | null;
  /** When true (default), only the connected number can chat with the agent. When false, anyone who messages the number can chat (customer support). */
  whatsappOnlyOwnerCanChat?: boolean;
  slackBotTokenSet?: boolean;
  slackTeamId?: string | null;
  discordBotTokenSet?: boolean;
  discordBotUserId?: string | null;
  // Agent personality (soul.md)
  hasSoulMd?: boolean;
  soulMd?: string | null;
  evolvePersonality?: boolean;
  // Skill access
  skillScope?: "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS";
  allowedSkillIds?: string[];
}

export interface ChatIntegrationSecret {
  sharedSecret: string;
  webhookUrl: string;
}

export interface ExternalIdentity {
  id: string;
  platform: string;
  externalId: string;
  externalName: string | null;
  metadata: Record<string, unknown> | null;
  integrationId?: string | null;
  linkedAt: Date;
  lastActiveAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface UpdateIntegrationData {
  label?: string;
  platform?: "TELEGRAM" | "WHATSAPP" | "DISCORD" | "SLACK";
  scope?: "SINGLE_WORKFLOW" | "ALL_WORKFLOWS" | "ALLOW_LIST";
  scopeWorkflowId?: string | null;
  allowedWorkflowIds?: string[];
  isActive?: boolean;
  defaultWorkflowId?: string | null;
  allowPlanMode?: boolean;
  allowWorkflowExecution?: boolean;
  telegramBotToken?: string | null;
  whatsappOnlyOwnerCanChat?: boolean;
  soulMd?: string | null;
  evolvePersonality?: boolean;
  skillScope?: "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS";
  allowedSkillIds?: string[];
}

export interface CreateIntegrationData {
  label: string;
  platform?: "TELEGRAM" | "WHATSAPP" | "DISCORD" | "SLACK";
  scope?: "SINGLE_WORKFLOW" | "ALL_WORKFLOWS" | "ALLOW_LIST";
  scopeWorkflowId?: string | null;
  allowedWorkflowIds?: string[];
  isActive?: boolean;
  allowPlanMode?: boolean;
  allowWorkflowExecution?: boolean;
  soulMd?: string | null;
  evolvePersonality?: boolean;
  skillScope?: "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS";
  allowedSkillIds?: string[];
}

export interface LinkIdentityData {
  platform: string;
  externalId: string;
  integrationId?: string;
  externalName?: string;
  metadata?: Record<string, unknown>;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  integration?: {
    webhookUrl: string;
    isActive: boolean;
    allowPlanMode: boolean;
    allowWorkflowExecution: boolean;
    totalRequests: number;
    lastUsedAt: Date | null;
  };
}

export interface SaveTelegramTokenResult {
  success: boolean;
  message: string;
  integration: {
    id: string;
    telegramBotTokenSet: boolean;
    webhookUrl?: string | null;
  };
}

export interface RefreshTelegramWebhookResult {
  success: boolean;
  message: string;
  integration: {
    id: string;
    telegramBotTokenSet: boolean;
    webhookUrl?: string | null;
  };
}

export interface SaveSlackTokenResult {
  success: boolean;
  message: string;
  integration: {
    id: string;
    slackBotTokenSet: boolean;
    slackTeamId?: string;
    webhookUrl?: string | null;
  };
}

export interface SaveDiscordTokenResult {
  success: boolean;
  message: string;
  integration: {
    id: string;
    discordBotTokenSet: boolean;
    discordBotUserId?: string;
    inviteUrl?: string;
  };
}

// ============================================
// Integration Hooks
// ============================================

/**
 * Get the user's Chat Integration integrations
 */
export function useChatIntegrations() {
  return useProtectedQuery<{ success: boolean; integrations: ChatIntegration[] }>({
    queryKey: ["chatIntegration", "integrations"],
    queryFn: () =>
      authenticatedGet<{ success: boolean; integrations: ChatIntegration[] }>(
        "/api/chat-integrations/integrations"
      ),
  });
}

/**
 * Get a specific integration
 */
export function useChatIntegration(integrationId?: string) {
  return useProtectedQuery<{ success: boolean; integration: ChatIntegration }>({
    queryKey: ["chatIntegration", "integration", integrationId],
    enabled: !!integrationId,
    queryFn: () =>
      authenticatedGet<{ success: boolean; integration: ChatIntegration }>(
        `/api/chat-integrations/integrations/${integrationId}`
      ),
  });
}

/**
 * Get the full shared secret (for setup)
 */
export function useChatIntegrationSecret(integrationId?: string) {
  return useProtectedQuery<{ success: boolean; sharedSecret: string; webhookUrl: string }>({
    queryKey: ["chatIntegration", "secret", integrationId],
    enabled: !!integrationId,
    queryFn: () =>
      authenticatedGet<{ success: boolean; sharedSecret: string; webhookUrl: string }>(
        `/api/chat-integrations/integrations/${integrationId}/secret`
      ),
    // Don't cache the secret for too long
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Update integration settings
 */
export function useUpdateChatIntegration(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<
    { success: boolean; integration: ChatIntegration },
    Error,
    UpdateIntegrationData
  >({
    mutationFn: (data) =>
      authenticatedPut<{ success: boolean; integration: ChatIntegration }>(
        `/api/chat-integrations/integrations/${integrationId}`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatIntegration", "integrations"] });
      queryClient.invalidateQueries({
        queryKey: ["chatIntegration", "integration", integrationId],
      });
      toast.success("Integration settings updated");
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update integration settings";
      toast.error(errorMessage);
    },
  });
}

/**
 * Create a new integration
 */
export function useCreateChatIntegration() {
  const queryClient = useQueryClient();

  return useProtectedMutation<
    { success: boolean; integration: ChatIntegration },
    Error,
    CreateIntegrationData
  >({
    mutationFn: (data) =>
      authenticatedPost<{ success: boolean; integration: ChatIntegration }>(
        "/api/chat-integrations/integrations",
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatIntegration", "integrations"] });
      toast.success("Integration integration created");
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to create integration";
      toast.error(errorMessage);
    },
  });
}

/**
 * Save Telegram bot token (hosted gateway mode)
 */
export function useSaveTelegramBotToken(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<SaveTelegramTokenResult, Error, { telegramBotToken: string }>({
    mutationFn: (data) =>
      authenticatedPost<SaveTelegramTokenResult>(
        `/api/chat-integrations/integrations/${integrationId}/telegram/token`,
        data
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["chatIntegration", "integrations"] });
      queryClient.invalidateQueries({
        queryKey: ["chatIntegration", "integration", integrationId],
      });
      toast.success(result.message);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to save Telegram token";
      toast.error(errorMessage);
    },
  });
}

/**
 * Refresh Telegram webhook using stored bot token
 */
export function useRefreshTelegramWebhook(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<RefreshTelegramWebhookResult, Error>({
    mutationFn: () =>
      authenticatedPost<RefreshTelegramWebhookResult>(
        `/api/chat-integrations/integrations/${integrationId}/telegram/refresh-webhook`,
        {}
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["chatIntegration", "integrations"] });
      queryClient.invalidateQueries({
        queryKey: ["chatIntegration", "integration", integrationId],
      });
      toast.success(result.message);
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to refresh Telegram webhook";
      toast.error(errorMessage);
    },
  });
}

/**
 * Regenerate the shared secret
 */
export function useRegenerateChatIntegrationSecret(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<{ success: boolean; message: string; sharedSecret: string }, Error>({
    mutationFn: () =>
      authenticatedPost<{ success: boolean; message: string; sharedSecret: string }>(
        `/api/chat-integrations/integrations/${integrationId}/regenerate-secret`,
        {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatIntegration", "integrations"] });
      queryClient.invalidateQueries({ queryKey: ["chatIntegration", "secret", integrationId] });
      toast.success("Shared secret regenerated. Update your ChatIntegration configuration.");
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to regenerate shared secret";
      toast.error(errorMessage);
    },
  });
}

/**
 * Delete the integration
 */
export function useDeleteChatIntegration(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<{ success: boolean; message: string }, Error>({
    mutationFn: () =>
      authenticatedDelete<{ success: boolean; message: string }>(
        `/api/chat-integrations/integrations/${integrationId}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatIntegration"] });
      toast.success("Integration deleted");
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete integration";
      toast.error(errorMessage);
    },
  });
}

/**
 * Connect WhatsApp (start session, get QR)
 */
export function useConnectWhatsApp(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<
    { success: boolean; sessionId: string; status: string; qr: string | null },
    Error
  >({
    mutationFn: () =>
      authenticatedPost<{
        success: boolean;
        sessionId: string;
        status: string;
        qr: string | null;
      }>(`/api/chat-integrations/integrations/${integrationId}/whatsapp/connect`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatIntegration", "integrations"] });
      queryClient.invalidateQueries({
        queryKey: ["chatIntegration", "integration", integrationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["chatIntegration", "whatsappStatus", integrationId],
      });
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start WhatsApp connection";
      toast.error(errorMessage);
    },
  });
}

/**
 * WhatsApp session status (and optional QR)
 */
export function useWhatsAppStatus(
  integrationId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useProtectedQuery<{ status: string; qr: string | null }, Error>({
    queryKey: ["chatIntegration", "whatsappStatus", integrationId],
    queryFn: () =>
      authenticatedGet<{ status: string; qr: string | null }>(
        `/api/chat-integrations/integrations/${integrationId}/whatsapp/status`
      ),
    enabled: !!integrationId && options?.enabled !== false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "open" || status === "disconnected") return false;
      return 3000;
    },
  });
}

/**
 * Test the integration connection
 */
export function useTestChatIntegrationConnection(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<TestConnectionResult, Error>({
    mutationFn: () =>
      authenticatedPost<TestConnectionResult>(
        `/api/chat-integrations/integrations/${integrationId}/test`,
        {}
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["chatIntegration", "integrations"] });
      queryClient.invalidateQueries({
        queryKey: ["chatIntegration", "integration", integrationId],
      });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to test connection";
      toast.error(errorMessage);
    },
  });
}

// ============================================
// Slack Hooks
// ============================================

/**
 * Save Slack bot token and signing secret
 */
export function useSaveSlackBotToken(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<
    SaveSlackTokenResult,
    Error,
    { slackBotToken: string; slackSigningSecret: string }
  >({
    mutationFn: (data) =>
      authenticatedPost<SaveSlackTokenResult>(
        `/api/chat-integrations/integrations/${integrationId}/slack/token`,
        data
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["chatIntegration", "integrations"] });
      toast.success(result.message);
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save Slack bot token";
      toast.error(errorMessage);
    },
  });
}

// ============================================
// Discord Hooks
// ============================================

/**
 * Save Discord bot token
 */
export function useSaveDiscordBotToken(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<
    SaveDiscordTokenResult,
    Error,
    { discordBotToken: string; discordClientId?: string }
  >({
    mutationFn: (data) =>
      authenticatedPost<SaveDiscordTokenResult>(
        `/api/chat-integrations/integrations/${integrationId}/discord/token`,
        data
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["chatIntegration", "integrations"] });
      toast.success(result.message);
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save Discord bot token";
      toast.error(errorMessage);
    },
  });
}

// ============================================
// Agent Personality (Soul) Hooks
// ============================================

export interface GenerateSoulMdData {
  name: string;
  description: string;
  tone: string;
  coreTruths?: string;
  boundaries?: string;
}

export interface GenerateSoulMdResult {
  success: boolean;
  soulMd: string;
}

/**
 * Generate a soul.md personality using AI (costs 20 credits)
 */
export function useGenerateSoulMd(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<GenerateSoulMdResult, Error, GenerateSoulMdData>({
    mutationFn: (data) =>
      authenticatedPost<GenerateSoulMdResult>(
        `/api/chat-integrations/integrations/${integrationId}/generate-soul`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatIntegration", "integrations"] });
      queryClient.invalidateQueries({
        queryKey: ["chatIntegration", "integration", integrationId],
      });
      toast.success("Agent personality generated successfully");
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate personality";
      toast.error(errorMessage);
    },
  });
}

/**
 * Save manually uploaded/pasted soul.md content (free)
 */
export function useSaveSoulMd(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<{ success: boolean }, Error, { soulMd: string }>({
    mutationFn: (data) =>
      authenticatedPost<{ success: boolean }>(
        `/api/chat-integrations/integrations/${integrationId}/save-soul`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatIntegration", "integrations"] });
      queryClient.invalidateQueries({
        queryKey: ["chatIntegration", "integration", integrationId],
      });
      toast.success("Agent personality saved");
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save personality";
      toast.error(errorMessage);
    },
  });
}

// ============================================
// External Identity Hooks
// ============================================

export interface ExternalIdentitiesResponse {
  success: boolean;
  identities: ExternalIdentity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Get linked external identities with pagination (same pattern as workflows, credentials, etc.)
 */
export function useExternalIdentities(
  integrationId?: string,
  page: number = 1,
  limit: number = 10
) {
  return useProtectedQuery<ExternalIdentitiesResponse>({
    queryKey: ["chatIntegration", "identities", integrationId, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (integrationId) params.set("integrationId", integrationId);
      return authenticatedGet<ExternalIdentitiesResponse>(
        `/api/chat-integrations/identities?${params.toString()}`
      );
    },
  });
}

/**
 * Link a new external identity
 */
export function useLinkExternalIdentity() {
  const queryClient = useQueryClient();

  return useProtectedMutation<
    { success: boolean; message: string; identity: ExternalIdentity },
    Error,
    LinkIdentityData
  >({
    mutationFn: (data) =>
      authenticatedPost<{ success: boolean; message: string; identity: ExternalIdentity }>(
        "/api/chat-integrations/identities/link",
        data
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["chatIntegration", "identities", result.identity?.integrationId],
      });
      toast.success(result.message);
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to link external identity";
      toast.error(errorMessage);
    },
  });
}

/**
 * Unlink an external identity
 */
export function useUnlinkExternalIdentity(integrationId?: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<
    { success: boolean; message: string },
    Error,
    { platform: string; externalId: string }
  >({
    mutationFn: ({ platform, externalId }) =>
      authenticatedDelete<{ success: boolean; message: string }>(
        `/api/chat-integrations/identities/${platform}/${externalId}${
          integrationId ? `?integrationId=${integrationId}` : ""
        }`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatIntegration", "identities", integrationId] });
      toast.success("External identity unlinked");
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to unlink external identity";
      toast.error(errorMessage);
    },
  });
}
