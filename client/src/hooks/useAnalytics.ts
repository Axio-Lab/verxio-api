/**
 * useAnalytics Hook
 *
 * React Query hooks for fetching and managing analytics data
 * from the Opik-powered analytics backend.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ============================================
// Types
// ============================================

interface AnalyticsOverview {
  totalCalls: number;
  totalCost: number;
  avgQuality: number;
  successRate: number;
  callsByType: Record<string, number>;
  lastUpdated: string;
}

interface CostBreakdown {
  period: string;
  data: Array<{
    date: string;
    cost: number;
    calls: number;
  }>;
  totalCost: number;
  avgCostPerCall: number;
}

interface QualityMetrics {
  overall: number;
  byType: Record<string, number>;
  trend: Array<{
    date: string;
    score: number;
  }>;
  successRate: number;
}

interface OptimizationSuggestion {
  promptType: string;
  currentScore: number;
  suggestion: string;
  potentialImprovement: number;
  priority: "high" | "medium" | "low";
}

interface ActivityItem {
  id: string;
  type: string;
  timestamp: string;
  success: boolean;
  duration?: number;
  cost?: number;
}

interface OptimizationResult {
  id: string;
  promptType: string;
  status: string;
  improvement?: number;
  error?: string;
}

// ============================================
// API Helpers
// ============================================

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem("authToken");

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// Query Keys
// ============================================

const analyticsKeys = {
  all: ["analytics"] as const,
  overview: () => [...analyticsKeys.all, "overview"] as const,
  costs: (period?: string) => [...analyticsKeys.all, "costs", period] as const,
  quality: () => [...analyticsKeys.all, "quality"] as const,
  optimizations: () => [...analyticsKeys.all, "optimizations"] as const,
  activity: (limit?: number) => [...analyticsKeys.all, "activity", limit] as const,
};

// ============================================
// Hooks
// ============================================

/**
 * Fetch analytics overview
 */
export function useAnalyticsOverview() {
  return useQuery({
    queryKey: analyticsKeys.overview(),
    queryFn: () => fetchWithAuth("/analytics/overview") as Promise<AnalyticsOverview>,
    staleTime: 30000, // 30 seconds
    retry: 1,
  });
}

/**
 * Fetch cost breakdown
 */
export function useAnalyticsCosts(period: string = "daily") {
  return useQuery({
    queryKey: analyticsKeys.costs(period),
    queryFn: () => fetchWithAuth(`/analytics/costs?period=${period}`) as Promise<CostBreakdown>,
    staleTime: 60000, // 1 minute
    retry: 1,
  });
}

/**
 * Fetch quality metrics
 */
export function useAnalyticsQuality() {
  return useQuery({
    queryKey: analyticsKeys.quality(),
    queryFn: () => fetchWithAuth("/analytics/quality") as Promise<QualityMetrics>,
    staleTime: 60000,
    retry: 1,
  });
}

/**
 * Fetch optimization suggestions
 */
export function useAnalyticsOptimizations() {
  return useQuery({
    queryKey: analyticsKeys.optimizations(),
    queryFn: () => fetchWithAuth("/analytics/optimizations") as Promise<OptimizationSuggestion[]>,
    staleTime: 120000, // 2 minutes
    retry: 1,
  });
}

/**
 * Fetch recent activity
 */
export function useAnalyticsActivity(limit: number = 10) {
  return useQuery({
    queryKey: analyticsKeys.activity(limit),
    queryFn: () => fetchWithAuth(`/analytics/activity?limit=${limit}`) as Promise<ActivityItem[]>,
    staleTime: 30000,
    retry: 1,
  });
}

/**
 * Trigger optimization run
 */
export function useRunOptimization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (promptType: string) =>
      fetchWithAuth("/analytics/optimize", {
        method: "POST",
        body: JSON.stringify({ promptType }),
      }) as Promise<OptimizationResult>,
    onSuccess: () => {
      // Invalidate optimizations to refetch
      queryClient.invalidateQueries({ queryKey: analyticsKeys.optimizations() });
    },
  });
}

/**
 * Combined hook for analytics page
 */
export function useAnalytics(costPeriod: string = "daily", activityLimit: number = 10) {
  const overview = useAnalyticsOverview();
  const costs = useAnalyticsCosts(costPeriod);
  const quality = useAnalyticsQuality();
  const optimizations = useAnalyticsOptimizations();
  const activity = useAnalyticsActivity(activityLimit);
  const runOptimization = useRunOptimization();

  return {
    overview: overview.data,
    costs: costs.data,
    quality: quality.data,
    optimizations: optimizations.data,
    activity: activity.data,
    isLoading:
      overview.isLoading ||
      costs.isLoading ||
      quality.isLoading ||
      optimizations.isLoading ||
      activity.isLoading,
    isError:
      overview.isError ||
      costs.isError ||
      quality.isError ||
      optimizations.isError ||
      activity.isError,
    runOptimization,
    refetch: () => {
      overview.refetch();
      costs.refetch();
      quality.refetch();
      optimizations.refetch();
      activity.refetch();
    },
  };
}
