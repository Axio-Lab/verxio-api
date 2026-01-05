"use client";
import { ExecutionStatus, useExecution } from "@/hooks/useExecutions";
import { useWorkflow } from "@/hooks/useWorkflows";
import { getStatusIcon, formatStatus } from "./execution";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const ExecutionView = ({ executionId }: { executionId: string }) => {
  const { data: execution } = useExecution(executionId);
  // Fetch workflow separately if not included in execution data
  const { data: workflow } = useWorkflow(execution?.workflowId ?? "");

  if (!execution) {
    return null;
  }

  // Use workflow name from execution data or fetched workflow
  const workflowName = execution.workflow?.name || workflow?.name;
  const workflowId = execution.workflow?.id || execution.workflowId;

  const duration = execution?.completedAt
    ? Math.round(
        (new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000
      )
    : null;

  return (
    <Card className="shadow-none">
      <CardHeader className="flex items-center justify-center px-3 sm:px-6 py-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex-shrink-0">{getStatusIcon(execution.status as ExecutionStatus)}</div>
          <div className="min-w-0">
            <CardTitle className="text-sm sm:text-base md:text-lg truncate">
              {formatStatus(execution.status as ExecutionStatus)}
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs sm:text-sm line-clamp-1">
              Execution for {workflowName}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-4 sm:pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {workflowName && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Workflow</p>
              <Link
                prefetch
                className="text-sm text-primary hover:underline inline-flex items-center gap-1.5"
                href={`/workflows/${workflowId}`}
              >
                {workflowName}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <p className="text-sm">{formatStatus(execution.status as ExecutionStatus)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Started At</p>
            <p className="text-sm">
              {execution?.startedAt
                ? formatDistanceToNow(execution.startedAt, { addSuffix: true })
                : "N/A"}
            </p>
          </div>
          {execution?.completedAt ? (
            <div>
              <p className="text-sm font-medium">Completed At</p>
              <p className="text-sm">
                {formatDistanceToNow(execution.completedAt, { addSuffix: true })}
              </p>
            </div>
          ) : null}
          {duration !== null ? (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Duration</p>
              <p className="text-sm">{duration}s</p>
            </div>
          ) : null}
          {execution.ingestEventId ? (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Event ID</p>
              <p className="text-xs font-mono">{execution.ingestEventId}</p>
            </div>
          ) : null}
        </div>

        {execution.error && (
          <Card className="w-full">
            <CardHeader className="px-3 sm:px-6 py-4">
              <CardTitle className="text-red-600 dark:text-red-400 text-sm sm:text-base md:text-lg">
                Error Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-4 sm:pb-6">
              <div>
                <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 break-words whitespace-pre-wrap">
                  {execution.error}
                </p>
              </div>
              {execution.errorStack && (
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
                    Stack Trace
                  </p>
                  <pre className="text-[10px] sm:text-xs bg-muted dark:bg-red-950/20 p-2 sm:p-3 md:p-4 rounded-md overflow-auto max-h-48 sm:max-h-64 md:max-h-96">
                    {execution.errorStack}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {execution.output && (
          <Card className="w-full">
            <CardHeader className="px-3 sm:px-6 py-4">
              <CardTitle className="text-sm sm:text-base md:text-lg">Output</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
              <pre className="text-[10px] sm:text-xs bg-muted p-2 sm:p-3 md:p-4 rounded-md overflow-auto max-h-48 sm:max-h-64 md:max-h-96">
                {JSON.stringify(execution.output, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};
