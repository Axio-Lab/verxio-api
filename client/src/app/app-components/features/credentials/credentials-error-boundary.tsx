"use client";

import { FallbackProps } from "react-error-boundary";
import { CredentialsErrorView } from "./credential";

/**
 * Client component wrapper for ErrorBoundary FallbackComponent
 */
export function CredentialsErrorBoundaryFallback({ error, resetErrorBoundary }: FallbackProps) {
  return <CredentialsErrorView />;
}
