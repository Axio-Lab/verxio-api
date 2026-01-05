import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ExecutionsLoadingView } from "@/app/app-components/features/executions/execution";
import { ExecutionsContent } from "@/app/app-components/features/executions/executions-content-client";
import { ExecutionsErrorBoundaryFallback } from "@/app/app-components/features/executions/executions-error-boundary";

const ExecutionsPage = () => {
  return (
    <ErrorBoundary FallbackComponent={ExecutionsErrorBoundaryFallback}>
      <Suspense fallback={<ExecutionsLoadingView />}>
        <ExecutionsContent />
      </Suspense>
    </ErrorBoundary>
  );
};

export default ExecutionsPage;
