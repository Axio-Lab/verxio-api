import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { WorkflowsLoadingView } from "@/app/app-components/features/workflow/workflows";
import { WorkflowsErrorBoundaryFallback } from "@/app/app-components/features/workflow/workflows-error-boundary";
import { WorkflowsContent } from "./workflows-content-client";

const WorkflowsPage = () => {
  return (
    <ErrorBoundary FallbackComponent={WorkflowsErrorBoundaryFallback}>
      <Suspense fallback={<WorkflowsLoadingView />}>
        <WorkflowsContent />
      </Suspense>
    </ErrorBoundary>
  );
};

export default WorkflowsPage;
