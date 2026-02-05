import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { IntegrationsLoadingView } from "@/app/app-components/features/integrations/integration";
import { IntegrationsContent } from "@/app/app-components/features/integrations/integrations-content-client";
import { CredentialsErrorBoundaryFallback } from "@/app/app-components/features/credentials/credentials-error-boundary";

const IntegrationsPage = () => {
  return (
    <ErrorBoundary FallbackComponent={CredentialsErrorBoundaryFallback}>
      <Suspense fallback={<IntegrationsLoadingView />}>
        <IntegrationsContent />
      </Suspense>
    </ErrorBoundary>
  );
};

export default IntegrationsPage;
