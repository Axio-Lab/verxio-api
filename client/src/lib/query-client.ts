import { QueryClient } from "@tanstack/react-query";
import { cache } from "react";

/**
 * Get or create a QueryClient instance
 * Uses React cache to ensure the same instance is used during a request
 */
export const getQueryClient = cache(() => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  });
});

