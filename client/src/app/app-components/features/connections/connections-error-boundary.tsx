"use client";

import { FallbackProps } from "react-error-boundary";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConnectionsErrorBoundaryFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 sm:p-8">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="rounded-full bg-destructive/10 p-3 sm:p-4 mb-4 sm:mb-6">
          <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-destructive" />
        </div>
        <h2 className="text-lg sm:text-xl font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
          {error?.message || "An unexpected error occurred while loading connections."}
        </p>
        <Button onClick={resetErrorBoundary} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
