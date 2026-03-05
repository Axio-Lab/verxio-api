"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useEffect, useState, useCallback } from "react";
import { authenticatedGet } from "@/lib/api-client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Clock, DollarSign, Zap, TrendingUp } from "lucide-react";
import { LoadingView, ErrorView } from "@/app/app-components/features/editor/entity-component";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface WorkflowAnalytics {
  workflowId: string;
  name: string;
  executions: number;
  timeSavedMs: number;
  moneySaved: number;
  successRate: number;
}

interface DashboardData {
  totalTimeSavedMs: number;
  totalMoneySaved: number;
  totalExecutions: number;
  successRate: number;
  workflows: WorkflowAnalytics[];
  executionsByDay: Array<{ day: string; count: number }>;
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round((ms / 3_600_000) * 10) / 10}h`;
}

function AnalyticsContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [insight, setInsight] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState(50);

  const fetchData = useCallback(async () => {
    try {
      const [dashboard, insightRes] = await Promise.all([
        authenticatedGet<DashboardData>(`/api/analytics/dashboard?hourlyRate=${hourlyRate}`),
        authenticatedGet<{ insight: string }>("/api/analytics/insight"),
      ]);
      setData(dashboard);
      setInsight(insightRes.insight);
    } catch {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [hourlyRate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col min-h-[60vh]">
        <LoadingView entity="analytics" message="Loading analytics..." />
      </div>
    );
  }

  if (!data) return null;

  const maxExec = Math.max(...(data.executionsByDay.map((d) => d.count) || [1]), 1);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">ROI Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track how much time and money your automations save.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Hourly Rate ($)</Label>
          <Input
            type="number"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(parseInt(e.target.value) || 50)}
            className="w-24 h-8"
          />
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(data.totalTimeSavedMs)}</p>
                <p className="text-xs text-muted-foreground">Time Saved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">${data.totalMoneySaved.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Money Saved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalExecutions.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Workflows Run</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.successRate}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Executions Over Time (simple bar chart) */}
      {data.executionsByDay.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Executions (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {data.executionsByDay.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-primary/80 rounded-t-sm min-h-[2px] transition-all"
                    style={{ height: `${(d.count / maxExec) * 100}%` }}
                    title={`${d.day}: ${d.count} executions`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{data.executionsByDay[0]?.day.slice(5)}</span>
              <span>{data.executionsByDay[data.executionsByDay.length - 1]?.day.slice(5)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Agentic Insight */}
        {insight && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agentic Insight</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{insight}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Per-Workflow Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workflow Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {data.workflows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workflow executions recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {data.workflows.slice(0, 10).map((wf) => (
                  <div
                    key={wf.workflowId}
                    className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{wf.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {wf.executions} runs &middot; {wf.successRate}% success
                      </p>
                    </div>
                    <div className="text-left sm:text-right sm:ml-4 shrink-0">
                      <p className="text-sm font-semibold">{formatDuration(wf.timeSavedMs)}</p>
                      <p className="text-xs text-green-600">${wf.moneySaved.toFixed(0)} saved</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ErrorBoundary FallbackComponent={() => <ErrorView message="Error loading analytics" />}>
      <Suspense
        fallback={
          <div className="flex flex-1 flex-col min-h-[60vh]">
            <LoadingView entity="analytics" message="Loading analytics..." />
          </div>
        }
      >
        <AnalyticsContent />
      </Suspense>
    </ErrorBoundary>
  );
}
