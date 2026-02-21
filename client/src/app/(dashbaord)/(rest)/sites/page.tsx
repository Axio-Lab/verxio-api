import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { SitesLoadingView } from "@/app/app-components/features/sites/site";
import { SitesContent } from "@/app/app-components/features/sites/sites-content-client";
import { SitesErrorBoundaryFallback } from "@/app/app-components/features/sites/sites-error-boundary";

export default function SitesPage() {
  return (
    <ErrorBoundary FallbackComponent={SitesErrorBoundaryFallback}>
      <Suspense fallback={<SitesLoadingView />}>
        <SitesContent />
      </Suspense>
    </ErrorBoundary>
  );
}
