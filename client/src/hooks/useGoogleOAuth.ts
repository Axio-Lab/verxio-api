import { useState, useEffect } from "react";
import { authenticatedGet, authenticatedDelete } from "@/lib/api-client";
import { toast } from "sonner";

interface GoogleOAuthStatus {
  connected: boolean;
  hasRefreshToken: boolean;
  expiresAt: Date | null;
}

export function useGoogleOAuth(credentialId: string | undefined) {
  const [status, setStatus] = useState<GoogleOAuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Check connection status
  const checkStatus = async () => {
    if (!credentialId) {
      setStatus(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authenticatedGet<{
        success: boolean;
        connected: boolean;
        hasRefreshToken: boolean;
        expiresAt: string | null;
      }>(`/api/auth/google/status?credentialId=${credentialId}`);

      setStatus({
        connected: response.connected,
        hasRefreshToken: response.hasRefreshToken,
        expiresAt: response.expiresAt ? new Date(response.expiresAt) : null,
      });
    } catch (error) {
      console.error("Failed to check Google OAuth status:", error);
      setStatus({
        connected: false,
        hasRefreshToken: false,
        expiresAt: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Connect to Google (initiate OAuth flow)
  const connect = async () => {
    if (!credentialId) {
      toast.error("Please select a Google OAuth credential first");
      return;
    }

    setIsConnecting(true);
    try {
      // Get current pathname and search params to redirect back after OAuth
      const returnUrl =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : undefined;
      const queryParam = returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : "";
      const response = await authenticatedGet<{
        success: boolean;
        authUrl: string;
      }>(`/api/auth/google/connect?credentialId=${credentialId}${queryParam}`);

      if (response.authUrl) {
        // Open OAuth flow in new window
        window.location.href = response.authUrl;
      } else {
        throw new Error("Failed to get OAuth URL");
      }
    } catch (error) {
      console.error("Failed to initiate Google OAuth:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to connect to Google. Please try again."
      );
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from Google
  const disconnect = async () => {
    if (!credentialId) {
      return;
    }

    setIsLoading(true);
    try {
      await authenticatedDelete(`/api/auth/google/disconnect?credentialId=${credentialId}`);
      toast.success("Disconnected from Google");
      await checkStatus();
    } catch (error) {
      console.error("Failed to disconnect from Google:", error);
      toast.error("Failed to disconnect from Google");
    } finally {
      setIsLoading(false);
    }
  };

  // Check status when credentialId changes
  useEffect(() => {
    checkStatus();
  }, [credentialId]);

  return {
    status,
    isLoading,
    isConnecting,
    connect,
    disconnect,
    checkStatus,
  };
}
