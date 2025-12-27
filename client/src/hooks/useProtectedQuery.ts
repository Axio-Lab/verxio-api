"use client";

import { useQuery, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Protected Query Hook - Similar to tRPC's protected procedure
 * 
 * This hook ensures that:
 * 1. User is authenticated before making the query
 * 2. Query is disabled if user is not authenticated
 * 3. Automatically redirects to login if not authenticated
 * 
 * Usage:
 * ```ts
 * const { data, isLoading } = useProtectedQuery({
 *   queryKey: ["user", "profile"],
 *   queryFn: () => authenticatedGet("/user/profile"),
 * });
 * ```
 */
export function useProtectedQuery<TData = unknown, TError = Error>(
  options: UseQueryOptions<TData, TError> & {
    redirectToLogin?: boolean; // Whether to redirect to login if not authenticated (default: true)
  }
): UseQueryResult<TData, TError> {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const { redirectToLogin = true, enabled = true, ...queryOptions } = options;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated && redirectToLogin) {
      router.push("/login");
    }
  }, [isAuthenticated, isAuthLoading, redirectToLogin, router]);

  return useQuery<TData, TError>({
    ...queryOptions,
    enabled: enabled && isAuthenticated && !isAuthLoading,
  });
}

