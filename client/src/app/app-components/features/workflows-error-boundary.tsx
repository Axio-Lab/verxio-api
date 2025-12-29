"use client";

import { FallbackProps } from "react-error-boundary";
import { WorkflowsErrorView } from "./workflows";

/**
 * Client component wrapper for ErrorBoundary FallbackComponent
 */
export function WorkflowsErrorBoundaryFallback({ error, resetErrorBoundary }: FallbackProps) {
  return <WorkflowsErrorView />;
}

