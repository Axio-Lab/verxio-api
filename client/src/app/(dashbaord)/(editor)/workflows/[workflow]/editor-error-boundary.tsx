"use client";

import { FallbackProps } from "react-error-boundary";
import { EditorError } from "@/app/app-components/features/editor";

/**
 * Client component wrapper for ErrorBoundary FallbackComponent
 */
export function EditorErrorBoundaryFallback({ error, resetErrorBoundary }: FallbackProps) {
  return <EditorError />;
}

