"use client";

import type { FallbackProps } from "react-error-boundary";
import { SupportErrorView } from "@/app/app-components/features/support/support";

/**
 * Client component wrapper for ErrorBoundary FallbackComponent.
 * Next.js Server Components cannot pass function props directly to Client Components.
 */
export function SupportErrorBoundaryFallback(_props: FallbackProps) {
  return <SupportErrorView />;
}
