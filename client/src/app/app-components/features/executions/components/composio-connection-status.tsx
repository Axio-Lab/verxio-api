"use client";

import { useComposioConnectedAccounts } from "@/hooks/useComposioConnections";
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ComposioConnectionStatusProps {
  appPrefix?: string;
  className?: string;
}

/**
 * Inline connection status indicator for Composio node dialogs.
 * Shows connected accounts count, or a prompt to connect if none exist.
 * If appPrefix is provided (e.g. "GITHUB"), highlights that specific app.
 */
export function ComposioConnectionStatus({ appPrefix, className }: ComposioConnectionStatusProps) {
  const { data, isLoading } = useComposioConnectedAccounts();

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg border bg-muted/30",
          className
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking connected apps...</span>
      </div>
    );
  }

  if (!data?.configured) {
    return null;
  }

  const accounts = data.accounts || [];
  const normalizedPrefix = appPrefix?.toLowerCase();

  const hasSpecificApp = normalizedPrefix
    ? accounts.some((a) => a.appSlug.toLowerCase() === normalizedPrefix)
    : false;

  if (accounts.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-between p-3 rounded-lg border bg-amber-500/5 border-amber-500/20",
          className
        )}
      >
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span className="text-amber-700 dark:text-amber-400">
            No apps connected. Connect apps to use Composio actions.
          </span>
        </div>
        <Link
          href="/connections"
          className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0"
        >
          Connect Apps <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  if (normalizedPrefix && !hasSpecificApp) {
    return (
      <div
        className={cn(
          "flex items-center justify-between p-3 rounded-lg border bg-amber-500/5 border-amber-500/20",
          className
        )}
      >
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span className="text-amber-700 dark:text-amber-400">
            <span className="font-medium capitalize">{normalizedPrefix}</span> is not connected.
          </span>
        </div>
        <Link
          href="/connections"
          className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0"
        >
          Connect it <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border bg-primary/5 border-primary/20",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <span>
          {accounts.length} app{accounts.length !== 1 ? "s" : ""} connected
          {normalizedPrefix && hasSpecificApp && (
            <span className="text-muted-foreground">
              {" "}
              (incl. <span className="font-medium capitalize">{normalizedPrefix}</span>)
            </span>
          )}
        </span>
      </div>
      <Link
        href="/connections"
        className="text-xs text-muted-foreground hover:underline flex items-center gap-1 flex-shrink-0"
      >
        Manage <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
