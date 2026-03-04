import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery, useProtectedMutation } from "@/hooks/useProtectedApi";
import { authenticatedGet, authenticatedPost, authenticatedDelete } from "@/lib/api-client";
import { toast } from "sonner";

// ============================================
// Types
// ============================================

export interface ComposioConnectedAccount {
  id: string;
  appSlug: string;
  status: string;
  createdAt?: string;
}

export interface ComposioApp {
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
  categories: string[];
  noAuth: boolean;
}

interface ConnectedAccountsResponse {
  accounts: ComposioConnectedAccount[];
  configured: boolean;
}

interface AppsResponse {
  apps: ComposioApp[];
  configured: boolean;
}

interface AppDetailsResponse {
  app: any;
  configured: boolean;
}

interface InitiateResponse {
  redirectUrl: string | null;
  connectionId: string;
}

// ============================================
// Hooks
// ============================================

/**
 * Fetch the user's connected Composio accounts
 */
export function useComposioConnectedAccounts() {
  return useProtectedQuery<ConnectedAccountsResponse>({
    queryKey: ["composio", "connected-accounts"],
    queryFn: () => authenticatedGet<ConnectedAccountsResponse>("/api/composio/connections"),
  });
}

/**
 * Fetch available Composio apps the user can connect
 */
export function useComposioApps() {
  return useProtectedQuery<AppsResponse>({
    queryKey: ["composio", "apps"],
    queryFn: () => authenticatedGet<AppsResponse>("/api/composio/connections/apps"),
    staleTime: 5 * 60 * 1000, // cache for 5 minutes since the app list rarely changes
  });
}

/**
 * Fetch details for a specific Composio app/toolkit.
 */
export function useComposioAppDetails(appSlug?: string) {
  return useProtectedQuery<AppDetailsResponse>({
    queryKey: ["composio", "apps", "details", appSlug],
    enabled: !!appSlug,
    queryFn: () =>
      authenticatedGet<AppDetailsResponse>(
        `/api/composio/connections/apps/${encodeURIComponent(appSlug || "")}`
      ),
  });
}

/**
 * Initiate a Composio app connection (OAuth flow).
 * On success, redirects the user to the OAuth provider.
 */
export function useInitiateComposioConnection() {
  const queryClient = useQueryClient();

  return useProtectedMutation<InitiateResponse, Error, { appSlug: string }>({
    mutationFn: (data) =>
      authenticatedPost<InitiateResponse>("/api/composio/connections/initiate", data),
    onSuccess: (data) => {
      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank");
        toast.info("Complete the connection in the new tab. We'll detect it when you return.");

        const handleFocus = () => {
          queryClient.invalidateQueries({
            queryKey: ["composio", "connected-accounts"],
          });
        };
        window.addEventListener("focus", handleFocus);
        setTimeout(() => window.removeEventListener("focus", handleFocus), 5 * 60 * 1000);
      } else {
        queryClient.invalidateQueries({
          queryKey: ["composio", "connected-accounts"],
        });
        toast.success("App connected successfully");
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to initiate connection";
      toast.error(msg);
    },
  });
}

/**
 * Disconnect a Composio account
 */
export function useDisconnectComposioAccount() {
  const queryClient = useQueryClient();

  return useProtectedMutation<void, Error, { accountId: string; appSlug: string }>({
    mutationFn: ({ accountId }) => authenticatedDelete(`/api/composio/connections/${accountId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["composio", "connected-accounts"] });
      toast.success(`${variables.appSlug} disconnected`);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to disconnect account";
      toast.error(msg);
    },
  });
}
