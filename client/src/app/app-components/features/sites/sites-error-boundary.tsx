"use client";

import { FallbackProps } from "react-error-boundary";
import { SitesErrorView } from "./site";

export function SitesErrorBoundaryFallback({ error, resetErrorBoundary }: FallbackProps) {
  return <SitesErrorView />;
}
