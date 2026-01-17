"use client";

import { useState } from "react";
import {
  BarChart3Icon,
  TrendingUpIcon,
  ZapIcon,
  DollarSignIcon,
  ActivityIcon,
  SparklesIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "lucide-react";
import SectionHeader from "@/app/app-components/SectionHeader";
import { useAnalytics } from "@/hooks/useAnalytics";

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  subtext,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number | undefined;
  subtext?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md shadow-gray-900/5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{icon}</div>
        <div>
          <p className="text-sm text-textSecondary">{label}</p>
          <p className="text-2xl font-bold text-textPrimary">{value ?? "-"}</p>
          {subtext && <p className="text-xs text-textSecondary">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

// Optimization Suggestion Card
function OptimizationCard({
  suggestion,
  onOptimize,
  isOptimizing,
}: {
  suggestion: {
    promptType: string;
    currentScore: number;
    suggestion: string;
    potentialImprovement: number;
    priority: string;
  };
  onOptimize: () => void;
  isOptimizing: boolean;
}) {
  const priorityColors = {
    high: "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-green-100 text-green-700",
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-textPrimary capitalize">
              {suggestion.promptType.replace("_", " ")}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                priorityColors[suggestion.priority as keyof typeof priorityColors] ||
                priorityColors.low
              }`}
            >
              {suggestion.priority}
            </span>
          </div>
          <p className="text-sm text-textSecondary">{suggestion.suggestion}</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-textSecondary">
            <span>Current: {suggestion.currentScore.toFixed(0)}%</span>
            <span className="text-green-600">
              +{suggestion.potentialImprovement.toFixed(0)}% potential
            </span>
          </div>
        </div>
        <button
          onClick={onOptimize}
          disabled={isOptimizing}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-primary/90 disabled:opacity-50"
        >
          {isOptimizing ? <RefreshCwIcon className="h-4 w-4 animate-spin" /> : "Optimize"}
        </button>
      </div>
    </div>
  );
}

// Activity Item
function ActivityItem({
  activity,
}: {
  activity: {
    id: string;
    type: string;
    timestamp: string;
    success: boolean;
    duration?: number;
    cost?: number;
  };
}) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      {activity.success ? (
        <CheckCircleIcon className="h-5 w-5 text-green-500" />
      ) : (
        <XCircleIcon className="h-5 w-5 text-red-500" />
      )}
      <div className="flex-1">
        <p className="text-sm font-medium text-textPrimary capitalize">
          {activity.type.replace("_", " ")}
        </p>
        <p className="text-xs text-textSecondary">{formatTime(activity.timestamp)}</p>
      </div>
      <div className="text-right text-xs text-textSecondary">
        {activity.duration && (
          <p className="flex items-center gap-1">
            <ClockIcon className="h-3 w-3" />
            {(activity.duration / 1000).toFixed(1)}s
          </p>
        )}
        {activity.cost !== undefined && <p>${activity.cost.toFixed(4)}</p>}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { overview, costs, quality, optimizations, activity, isLoading, runOptimization } =
    useAnalytics();

  const [optimizingType, setOptimizingType] = useState<string | null>(null);

  const handleOptimize = async (promptType: string) => {
    setOptimizingType(promptType);
    try {
      await runOptimization.mutateAsync(promptType);
    } finally {
      setOptimizingType(null);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-textSecondary">
            <RefreshCwIcon className="h-5 w-5 animate-spin" />
            <span>Loading analytics...</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <SectionHeader
        eyebrow="Self-Learning Copilot"
        title="Agent Analytics"
        description="Track your Verxio agent's performance, costs, and optimization opportunities."
      />

      {/* Overview Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ZapIcon className="h-5 w-5" />}
          label="Total Calls"
          value={overview?.totalCalls ?? 0}
        />
        <StatCard
          icon={<DollarSignIcon className="h-5 w-5" />}
          label="Total Cost"
          value={`$${(overview?.totalCost ?? 0).toFixed(4)}`}
        />
        <StatCard
          icon={<TrendingUpIcon className="h-5 w-5" />}
          label="Success Rate"
          value={`${(overview?.successRate ?? 0).toFixed(0)}%`}
        />
        <StatCard
          icon={<BarChart3Icon className="h-5 w-5" />}
          label="Optimizations"
          value={optimizations?.length ?? 0}
          subtext="suggestions available"
        />
      </div>

      {/* Two Column Layout */}
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* Cost Breakdown */}
        <section>
          <h3 className="text-lg font-semibold text-textPrimary mb-4 flex items-center gap-2">
            <DollarSignIcon className="h-5 w-5 text-primary" />
            Cost Breakdown
          </h3>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md shadow-gray-900/5">
            {costs?.data && costs.data.length > 0 ? (
              <div className="space-y-3">
                {costs.data.slice(-7).map((item) => (
                  <div key={item.date} className="flex items-center justify-between">
                    <span className="text-sm text-textSecondary">{item.date}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-textSecondary">{item.calls} calls</span>
                      <span className="text-sm font-medium text-textPrimary">
                        ${item.cost.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-3 mt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-textPrimary">Total</span>
                  <span className="text-sm font-bold text-primary">
                    ${costs.totalCost.toFixed(4)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-textSecondary text-center py-8">
                No cost data available yet. Start using the agent to see costs.
              </p>
            )}
          </div>
        </section>

        {/* Quality Metrics */}
        <section>
          <h3 className="text-lg font-semibold text-textPrimary mb-4 flex items-center gap-2">
            <TrendingUpIcon className="h-5 w-5 text-primary" />
            Quality by Type
          </h3>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md shadow-gray-900/5">
            {quality?.byType && Object.keys(quality.byType).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(quality.byType).map(([type, score]) => (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-textSecondary capitalize">
                        {type.replace("_", " ")}
                      </span>
                      <span className="text-sm font-medium text-textPrimary">{score}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-textSecondary text-center py-8">
                No quality data available yet. Use the agent to see metrics.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Optimization Suggestions */}
      <section className="mt-10">
        <h3 className="text-lg font-semibold text-textPrimary mb-4 flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-primary" />
          Optimization Suggestions
        </h3>
        {optimizations && optimizations.length > 0 ? (
          <div className="space-y-3">
            {optimizations.map((suggestion, index) => (
              <OptimizationCard
                key={index}
                suggestion={suggestion}
                onOptimize={() => handleOptimize(suggestion.promptType)}
                isOptimizing={optimizingType === suggestion.promptType}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-md shadow-gray-900/5 text-center">
            <SparklesIcon className="h-10 w-10 text-primary/40 mx-auto mb-3" />
            <p className="text-textSecondary">
              No optimization suggestions yet. Keep using the agent and suggestions will appear
              based on usage patterns.
            </p>
          </div>
        )}
      </section>

      {/* Recent Activity */}
      <section className="mt-10">
        <h3 className="text-lg font-semibold text-textPrimary mb-4 flex items-center gap-2">
          <ActivityIcon className="h-5 w-5 text-primary" />
          Recent Activity
        </h3>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md shadow-gray-900/5">
          {activity && activity.length > 0 ? (
            <div>
              {activity.map((item) => (
                <ActivityItem key={item.id} activity={item} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-textSecondary text-center py-8">
              No recent activity. Start using the Verxio agent to see activity here.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
