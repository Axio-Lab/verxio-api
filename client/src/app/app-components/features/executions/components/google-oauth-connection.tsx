"use client";

import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Link2 } from "lucide-react";
import { useGoogleOAuth } from "@/hooks/useGoogleOAuth";
import { cn } from "@/lib/utils";

interface GoogleOAuthConnectionProps {
  credentialId: string | undefined;
  className?: string;
}

export function GoogleOAuthConnection({ credentialId, className }: GoogleOAuthConnectionProps) {
  const {
    status,
    isLoading: isStatusLoading,
    isConnecting,
    connect,
    disconnect,
  } = useGoogleOAuth(credentialId);

  if (!credentialId) {
    return null;
  }

  if (isStatusLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking connection status...</span>
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div
        className={cn("flex items-center justify-between p-3 rounded-lg border bg-card", className)}
      >
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span>Connected to Google</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={disconnect}
          disabled={isStatusLoading}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center justify-between p-3 rounded-lg border bg-card", className)}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <XCircle className="h-4 w-4" />
        <span>Not connected to Google</span>
      </div>
      <Button
        type="button"
        variant="default"
        size="sm"
        onClick={connect}
        disabled={isConnecting || isStatusLoading}
      >
        {isConnecting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Link2 className="mr-2 h-4 w-4" />
            Connect to Google
          </>
        )}
      </Button>
    </div>
  );
}
