import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery, useProtectedMutation } from "@/hooks/useProtectedApi";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedPut,
  authenticatedDelete,
} from "@/lib/api-client";
import { toast } from "sonner";

export enum CredentialType {
  OPENAI = "OPENAI",
  ANTHROPIC = "ANTHROPIC",
  GEMINI = "GEMINI",
  TELEGRAM = "TELEGRAM",
  WHATSAPP = "WHATSAPP",
  AIRTABLE = "AIRTABLE",
  CUSTOM = "CUSTOM",
}

export interface Credential {
  id: string;
  name: string;
  type: CredentialType;
  createdAt: Date;
  updatedAt: Date;
  value?: string;
}

export interface CredentialsResponse {
  credentials: Credential[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateCredentialData {
  name: string;
  value: string;
  type: CredentialType;
}

export interface UpdateCredentialData {
  name?: string;
  value?: string;
  type?: CredentialType;
}

/**
 * Get credentials with pagination and optional type filter
 */
export function useCredentials(page: number = 1, limit: number = 10, type?: CredentialType) {
  return useProtectedQuery<CredentialsResponse>({
    queryKey: ["credentials", page, limit, type],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (type) {
        params.append("type", type);
      }
      return authenticatedGet<CredentialsResponse>(`/credential?${params.toString()}`);
    },
  });
}

/**
 * Get a single credential by ID
 * Uses cached data from credentials list if available, then fetches fresh data
 */
export function useCredential(id: string) {
  const queryClient = useQueryClient();

  return useProtectedQuery<Credential>({
    queryKey: ["credential", id],
    queryFn: () => authenticatedGet<Credential>(`/credential/${id}`),
    enabled: !!id,
    // Use cached data from credentials list if available
    placeholderData: () => {
      // Check all credentials queries in cache
      const queries = queryClient.getQueriesData<CredentialsResponse>({
        queryKey: ["credentials"],
      });

      // Find the credential in any of the cached credentials lists
      for (const [, data] of queries) {
        if (data?.credentials) {
          const cachedCredential = data.credentials.find((c) => c.id === id);
          if (cachedCredential) {
            return cachedCredential;
          }
        }
      }

      return undefined;
    },
  });
}

/**
 * Create a new credential
 */
export function useCreateCredential() {
  const queryClient = useQueryClient();

  return useProtectedMutation<Credential, Error, CreateCredentialData>({
    mutationFn: (data) => authenticatedPost<Credential>("/credential", data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      toast.success(`Credential "${data.name}" created`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to create credential";
      toast.error(errorMessage);
    },
  });
}

/**
 * Update a credential
 */
export function useUpdateCredential() {
  const queryClient = useQueryClient();

  return useProtectedMutation<Credential, Error, { id: string; data: UpdateCredentialData }>({
    mutationFn: ({ id, data }) => authenticatedPut<Credential>(`/credential/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      queryClient.invalidateQueries({ queryKey: ["credential", data.id] });
      toast.success(`Credential "${data.name}" updated`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to update credential";
      toast.error(errorMessage);
    },
  });
}

/**
 * Connect WhatsApp for a WHATSAPP credential (start session, get QR).
 */
export function useConnectCredentialWhatsApp(credentialId: string) {
  const queryClient = useQueryClient();
  return useProtectedMutation<
    { success: boolean; sessionId: string; status: string; qr?: string },
    Error,
    void
  >({
    mutationFn: () =>
      authenticatedPost<{ success: boolean; sessionId: string; status: string; qr?: string }>(
        `/credential/${credentialId}/whatsapp/connect`,
        {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credential", credentialId] });
    },
  });
}

/**
 * Get WhatsApp session status (and QR if connecting) for a WHATSAPP credential.
 */
export function useCredentialWhatsAppStatus(credentialId: string, enabled: boolean) {
  return useProtectedQuery<{ status: string; qr?: string }>({
    queryKey: ["credential", credentialId, "whatsapp-status"],
    queryFn: () =>
      authenticatedGet<{ status: string; qr?: string }>(
        `/credential/${credentialId}/whatsapp/status`
      ),
    enabled: !!credentialId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "qr" || data?.status === "connecting") return 3000;
      return false;
    },
  });
}

/**
 * Delete a credential
 */
export function useDeleteCredential() {
  const queryClient = useQueryClient();

  return useProtectedMutation<void, Error, { id: string; name: string }>({
    mutationFn: ({ id }) => authenticatedDelete(`/credential/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      toast.success(`Credential "${variables.name}" deleted`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete credential";

      // Check if error is about credential being in use
      if (errorMessage.includes("being used")) {
        toast.error(
          "Cannot delete credential. It is currently being used by one or more workflow nodes."
        );
      } else {
        toast.error(errorMessage);
      }
    },
  });
}
