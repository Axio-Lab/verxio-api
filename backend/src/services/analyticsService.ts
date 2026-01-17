/**
 * Analytics Service
 *
 * Aggregates Opik trace data for user-facing analytics dashboard.
 * Provides metrics, cost breakdowns, and optimization insights.
 */

import { getUserTraces, getUserMetrics, getCostByPeriod } from "./opikService";
import {
  generateOptimizationSuggestions,
  runOptimization,
  type PromptType,
  type OptimizationSuggestion,
} from "./promptOptimizer";

// ============================================
// Types
// ============================================

export interface AnalyticsOverview {
  totalCalls: number;
  totalCost: number;
  avgQuality: number;
  successRate: number;
  callsByType: Record<string, number>;
  lastUpdated: string;
}

export interface CostBreakdown {
  period: string;
  data: Array<{
    date: string;
    cost: number;
    calls: number;
  }>;
  totalCost: number;
  avgCostPerCall: number;
}

export interface QualityMetrics {
  overall: number;
  byType: Record<string, number>;
  trend: Array<{
    date: string;
    score: number;
  }>;
  successRate: number;
}

export interface OptimizationRun {
  id: string;
  promptType: PromptType;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  improvement?: number;
  error?: string;
}

// ============================================
// Analytics Functions
// ============================================

/**
 * Get user's analytics overview
 */
export async function getUserOverview(userId: string): Promise<AnalyticsOverview> {
  try {
    const metrics = await getUserMetrics(userId);

    return {
      totalCalls: metrics.totalTraces,
      totalCost: Math.round(metrics.totalCost * 10000) / 10000, // Round to 4 decimal places
      avgQuality: metrics.successRate,
      successRate: metrics.successRate,
      callsByType: metrics.tracesByType,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[AnalyticsService] Error getting user overview:", error);
    return {
      totalCalls: 0,
      totalCost: 0,
      avgQuality: 0,
      successRate: 0,
      callsByType: {},
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Get user's cost breakdown by period
 */
export async function getCostBreakdown(
  userId: string,
  period: string = "daily"
): Promise<CostBreakdown> {
  try {
    const validPeriod = ["daily", "weekly", "monthly"].includes(period)
      ? (period as "daily" | "weekly" | "monthly")
      : "daily";

    const costData = await getCostByPeriod(userId, validPeriod);

    const totalCost = costData.reduce((sum, item) => sum + item.cost, 0);
    const totalCalls = costData.reduce((sum, item) => sum + item.calls, 0);

    return {
      period: validPeriod,
      data: costData,
      totalCost: Math.round(totalCost * 10000) / 10000,
      avgCostPerCall: totalCalls > 0 ? Math.round((totalCost / totalCalls) * 10000) / 10000 : 0,
    };
  } catch (error) {
    console.error("[AnalyticsService] Error getting cost breakdown:", error);
    return {
      period: period || "daily",
      data: [],
      totalCost: 0,
      avgCostPerCall: 0,
    };
  }
}

/**
 * Get user's quality metrics over time
 */
export async function getQualityMetrics(userId: string): Promise<QualityMetrics> {
  try {
    const traces = await getUserTraces(userId, { limit: 500 });

    if (!traces.length) {
      return {
        overall: 0,
        byType: {},
        trend: [],
        successRate: 0,
      };
    }

    // Calculate success rate by type
    const typeStats: Record<string, { success: number; total: number }> = {};
    const dailyStats: Record<string, { success: number; total: number }> = {};

    let totalSuccess = 0;

    for (const trace of traces) {
      const metadata = trace.metadata || {};
      const traceType = metadata.traceType || "unknown";
      const isSuccess = metadata.success !== false;
      const date = metadata.startedAt
        ? new Date(metadata.startedAt).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      // Type stats
      if (!typeStats[traceType]) {
        typeStats[traceType] = { success: 0, total: 0 };
      }
      typeStats[traceType].total++;
      if (isSuccess) {
        typeStats[traceType].success++;
        totalSuccess++;
      }

      // Daily stats
      if (!dailyStats[date]) {
        dailyStats[date] = { success: 0, total: 0 };
      }
      dailyStats[date].total++;
      if (isSuccess) {
        dailyStats[date].success++;
      }
    }

    // Convert to percentages
    const byType: Record<string, number> = {};
    for (const [type, stats] of Object.entries(typeStats)) {
      byType[type] = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;
    }

    const trend = Object.entries(dailyStats)
      .map(([date, stats]) => ({
        date,
        score: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const overall = traces.length > 0 ? Math.round((totalSuccess / traces.length) * 100) : 0;

    return {
      overall,
      byType,
      trend,
      successRate: overall,
    };
  } catch (error) {
    console.error("[AnalyticsService] Error getting quality metrics:", error);
    return {
      overall: 0,
      byType: {},
      trend: [],
      successRate: 0,
    };
  }
}

/**
 * Get optimization suggestions for user
 */
export async function getOptimizationSuggestions(
  userId: string
): Promise<OptimizationSuggestion[]> {
  return generateOptimizationSuggestions(userId);
}

/**
 * Run optimization for a specific prompt type
 */
export async function triggerOptimization(
  userId: string,
  promptType: string
): Promise<OptimizationRun> {
  const validPromptType = ["planning", "code_generation", "workflow", "general"].includes(
    promptType
  )
    ? (promptType as PromptType)
    : "general";

  const runId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // In a production implementation, this would:
    // 1. Queue the optimization job
    // 2. Return immediately with a pending status
    // 3. Process in background and update status

    // For now, we run synchronously with sample data
    const result = await runOptimization(validPromptType, [
      { input: "Sample input 1" },
      { input: "Sample input 2" },
      { input: "Sample input 3" },
      { input: "Sample input 4" },
      { input: "Sample input 5" },
    ]);

    return {
      id: runId,
      promptType: validPromptType,
      status: result.success ? "completed" : "failed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      improvement: result.improvement,
      error: result.error,
    };
  } catch (error: any) {
    return {
      id: runId,
      promptType: validPromptType,
      status: "failed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      error: error.message,
    };
  }
}

/**
 * Get recent agent activity for user
 */
export async function getRecentActivity(
  userId: string,
  limit: number = 10
): Promise<
  Array<{
    id: string;
    type: string;
    timestamp: string;
    success: boolean;
    duration?: number;
    cost?: number;
  }>
> {
  try {
    const traces = await getUserTraces(userId, { limit });

    return traces.map((trace) => {
      const metadata = trace.metadata || {};
      return {
        id: trace.id || `trace_${Date.now()}`,
        type: metadata.traceType || "unknown",
        timestamp: metadata.startedAt || new Date().toISOString(),
        success: metadata.success !== false,
        duration: metadata.duration,
        cost: metadata.cost,
      };
    });
  } catch (error) {
    console.error("[AnalyticsService] Error getting recent activity:", error);
    return [];
  }
}
