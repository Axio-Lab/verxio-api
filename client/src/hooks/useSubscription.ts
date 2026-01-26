"use client";

import { useQuery } from "@tanstack/react-query";

export interface SubscriptionStatus {
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  subscriptionExpiresAt: string | null;
  rateLimitRemaining: number;
  rateLimitTotal: number;
  rateLimitResetAt: string | null;
  features: string[];
  isSubscribed: boolean;
  planDisplayName: string;
}

/**
 * React hook to fetch and manage subscription status
 */
export function useSubscription() {
  const { data, isLoading, error, refetch } = useQuery<SubscriptionStatus>({
    queryKey: ["subscription-status"],
    queryFn: async () => {
      // Use Next.js API route proxy to avoid CORS and routing issues
      const response = await fetch("/api/billing/status", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch subscription status");
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - don't refetch too often
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    refetchInterval: false, // Disable automatic refetching
    retry: 1, // Only retry once on failure
  });

  return {
    subscription: data,
    isLoading,
    error,
    refetch,
    isSubscribed: data?.isSubscribed ?? false,
    planDisplayName: data?.planDisplayName ?? "Free",
    rateLimitRemaining: data?.rateLimitRemaining ?? 0,
    rateLimitTotal: data?.rateLimitTotal ?? 0,
  };
}
