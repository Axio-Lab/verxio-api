import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { SupportContent } from "@/app/app-components/features/support/support-content-client";
import { SupportLoadingView } from "@/app/app-components/features/support/support";
import { SupportErrorBoundaryFallback } from "@/app/app-components/features/support/support-error-boundary";

export default function SupportPage() {
  return (
    <ErrorBoundary FallbackComponent={SupportErrorBoundaryFallback}>
      <Suspense fallback={<SupportLoadingView />}>
        <SupportContent />
      </Suspense>
    </ErrorBoundary>
  );
}
