import { useState, useEffect } from "react";
import { authenticatedGet, authenticatedDelete } from "@/lib/api-client";
import { toast } from "sonner";

interface GoogleOAuthStatus {
  connected: boolean;
  hasRefreshToken: boolean;
  expiresAt: Date | null;
}

export function useGoogleOAuth() {
  const [status, setStatus] = useState<GoogleOAuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Check connection status
  const checkStatus = async () => {
    setIsLoading(true);
    try {
      const response = await authenticatedGet<{
        success: boolean;
        connected: boolean;
        hasRefreshToken: boolean;
        expiresAt: string | null;
      }>(`/api/auth/google/status`);

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
    setIsConnecting(true);
    try {
      // Get current pathname and search params to redirect back after OAuth
      const returnUrl =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : undefined;
      const queryParam = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : "";
      const response = await authenticatedGet<{
        success: boolean;
        authUrl: string;
      }>(`/api/auth/google/connect${queryParam}`);

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
    setIsLoading(true);
    try {
      await authenticatedDelete(`/api/auth/google/disconnect`);
      toast.success("Disconnected from Google");
      await checkStatus();
    } catch (error) {
      console.error("Failed to disconnect from Google:", error);
      toast.error("Failed to disconnect from Google");
    } finally {
      setIsLoading(false);
    }
  };

  // Check status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  return {
    status,
    isLoading,
    isConnecting,
    connect,
    disconnect,
    checkStatus,
  };
}
