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

export interface OpenClawIntegration {
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
}

export interface OpenClawSecret {
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

// ============================================
// Integration Hooks
// ============================================

/**
 * Get the user's OpenClaw integrations
 */
export function useOpenClawIntegrations() {
  return useProtectedQuery<{ success: boolean; integrations: OpenClawIntegration[] }>({
    queryKey: ["openclaw", "integrations"],
    queryFn: () =>
      authenticatedGet<{ success: boolean; integrations: OpenClawIntegration[] }>(
        "/api/openclaw/integrations"
      ),
  });
}

/**
 * Get a specific integration
 */
export function useOpenClawIntegration(integrationId?: string) {
  return useProtectedQuery<{ success: boolean; integration: OpenClawIntegration }>({
    queryKey: ["openclaw", "integration", integrationId],
    enabled: !!integrationId,
    queryFn: () =>
      authenticatedGet<{ success: boolean; integration: OpenClawIntegration }>(
        `/api/openclaw/integrations/${integrationId}`
      ),
  });
}

/**
 * Get the full shared secret (for setup)
 */
export function useOpenClawSecret(integrationId?: string) {
  return useProtectedQuery<{ success: boolean; sharedSecret: string; webhookUrl: string }>({
    queryKey: ["openclaw", "secret", integrationId],
    enabled: !!integrationId,
    queryFn: () =>
      authenticatedGet<{ success: boolean; sharedSecret: string; webhookUrl: string }>(
        `/api/openclaw/integrations/${integrationId}/secret`
      ),
    // Don't cache the secret for too long
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Update integration settings
 */
export function useUpdateOpenClawIntegration(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<
    { success: boolean; integration: OpenClawIntegration },
    Error,
    UpdateIntegrationData
  >({
    mutationFn: (data) =>
      authenticatedPut<{ success: boolean; integration: OpenClawIntegration }>(
        `/api/openclaw/integrations/${integrationId}`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openclaw", "integrations"] });
      queryClient.invalidateQueries({ queryKey: ["openclaw", "integration", integrationId] });
      toast.success("OpenClaw integration settings updated");
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
export function useCreateOpenClawIntegration() {
  const queryClient = useQueryClient();

  return useProtectedMutation<
    { success: boolean; integration: OpenClawIntegration },
    Error,
    CreateIntegrationData
  >({
    mutationFn: (data) =>
      authenticatedPost<{ success: boolean; integration: OpenClawIntegration }>(
        "/api/openclaw/integrations",
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openclaw", "integrations"] });
      toast.success("OpenClaw integration created");
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
        `/api/openclaw/integrations/${integrationId}/telegram/token`,
        data
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["openclaw", "integrations"] });
      queryClient.invalidateQueries({ queryKey: ["openclaw", "integration", integrationId] });
      toast.success(result.message);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to save Telegram token";
      toast.error(errorMessage);
    },
  });
}

/**
 * Regenerate the shared secret
 */
export function useRegenerateOpenClawSecret(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<{ success: boolean; message: string; sharedSecret: string }, Error>({
    mutationFn: () =>
      authenticatedPost<{ success: boolean; message: string; sharedSecret: string }>(
        `/api/openclaw/integrations/${integrationId}/regenerate-secret`,
        {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openclaw", "integrations"] });
      queryClient.invalidateQueries({ queryKey: ["openclaw", "secret", integrationId] });
      toast.success("Shared secret regenerated. Update your OpenClaw configuration.");
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
export function useDeleteOpenClawIntegration(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<{ success: boolean; message: string }, Error>({
    mutationFn: () =>
      authenticatedDelete<{ success: boolean; message: string }>(
        `/api/openclaw/integrations/${integrationId}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openclaw"] });
      toast.success("OpenClaw integration deleted");
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete integration";
      toast.error(errorMessage);
    },
  });
}

/**
 * Test the integration connection
 */
export function useTestOpenClawConnection(integrationId: string) {
  const queryClient = useQueryClient();

  return useProtectedMutation<TestConnectionResult, Error>({
    mutationFn: () =>
      authenticatedPost<TestConnectionResult>(
        `/api/openclaw/integrations/${integrationId}/test`,
        {}
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["openclaw", "integrations"] });
      queryClient.invalidateQueries({ queryKey: ["openclaw", "integration", integrationId] });
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
// External Identity Hooks
// ============================================

/**
 * Get all linked external identities
 */
export function useExternalIdentities(integrationId?: string) {
  return useProtectedQuery<{ success: boolean; identities: ExternalIdentity[] }>({
    queryKey: ["openclaw", "identities", integrationId],
    queryFn: () =>
      authenticatedGet<{ success: boolean; identities: ExternalIdentity[] }>(
        `/api/openclaw/identities${integrationId ? `?integrationId=${integrationId}` : ""}`
      ),
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
        "/api/openclaw/identities/link",
        data
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["openclaw", "identities", result.identity?.integrationId],
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
        `/api/openclaw/identities/${platform}/${externalId}${
          integrationId ? `?integrationId=${integrationId}` : ""
        }`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openclaw", "identities", integrationId] });
      toast.success("External identity unlinked");
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to unlink external identity";
      toast.error(errorMessage);
    },
  });
}
