import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ConnectionsLoadingView } from "@/app/app-components/features/connections/connection";
import { ConnectionsContent } from "../../../app-components/features/connections/connections-content-client";
import { ConnectionsErrorBoundaryFallback } from "@/app/app-components/features/connections/connections-error-boundary";

const ConnectionsPage = () => {
  return (
    <ErrorBoundary FallbackComponent={ConnectionsErrorBoundaryFallback}>
      <Suspense fallback={<ConnectionsLoadingView />}>
        <ConnectionsContent />
      </Suspense>
    </ErrorBoundary>
  );
};

export default ConnectionsPage;
