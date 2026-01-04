import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  CredentialsLoadingView,
  CredentialsErrorView,
} from "@/app/app-components/features/credentials/credential";
import { CredentialsContent } from "../../../app-components/features/credentials/credentials-content-client";
import { CredentialsErrorBoundaryFallback } from "@/app/app-components/features/credentials/credentials-error-boundary";

const CredentialsPage = () => {
  return (
    <ErrorBoundary FallbackComponent={CredentialsErrorBoundaryFallback}>
      <Suspense fallback={<CredentialsLoadingView />}>
        <CredentialsContent />
      </Suspense>
    </ErrorBoundary>
  );
};

export default CredentialsPage;
