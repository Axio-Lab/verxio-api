"use client";

import { useMutation, UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Protected Mutation Hook - Similar to tRPC's protected procedure
 * 
 * This hook ensures that:
 * 1. User is authenticated before executing the mutation
 * 2. Automatically redirects to login if not authenticated
 * 
 * Usage:
 * ```ts
 * const { mutate, isLoading } = useProtectedMutation({
 *   mutationFn: (data) => authenticatedPost("/deal/create", data),
 * });
 * ```
 */
export function useProtectedMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext> & {
    redirectToLogin?: boolean; // Whether to redirect to login if not authenticated (default: true)
    mutationFn: (variables: TVariables) => Promise<TData>; // Make mutationFn required
  }
): UseMutationResult<TData, TError, TVariables, TContext> {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const { redirectToLogin = true, mutationFn, ...mutationOptions } = options;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated && redirectToLogin) {
      router.push("/login");
    }
  }, [isAuthenticated, isAuthLoading, redirectToLogin, router]);

  // Wrap mutation function to check authentication
  const wrappedMutationFn = async (variables: TVariables): Promise<TData> => {
    if (!isAuthenticated) {
      router.push("/login");
      // Create error without using Error constructor to avoid type issues
      const authError = { message: "Authentication required" } as TError;
      throw authError;
    }
    return mutationFn(variables);
  };

  return useMutation<TData, TError, TVariables, TContext>({
    ...mutationOptions,
    mutationFn: wrappedMutationFn,
  });
}

