"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { OrganizationContent } from "./organization-content-client";

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function ErrorFallback({ error }: { error: unknown }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
      <p>Something went wrong loading the organization page.</p>
      <p className="text-sm">{error instanceof Error ? error.message : "Unknown error"}</p>
    </div>
  );
}

const OrganizationPage = () => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={<LoadingFallback />}>
        <OrganizationContent />
      </Suspense>
    </ErrorBoundary>
  );
};

export default OrganizationPage;
