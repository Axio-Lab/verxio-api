"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { TasksContentClient } from "@/app/app-components/features/tasks/tasks-content-client";

function TasksLoadingView() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-4 w-96 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

function TasksErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: unknown;
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12">
      <p className="text-destructive">Failed to load Task Manager</p>
      <p className="text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Unknown error"}
      </p>
      <button onClick={resetErrorBoundary} className="text-sm underline">
        Try again
      </button>
    </div>
  );
}

export default function TasksPage() {
  return (
    <ErrorBoundary FallbackComponent={TasksErrorFallback}>
      <Suspense fallback={<TasksLoadingView />}>
        <TasksContentClient />
      </Suspense>
    </ErrorBoundary>
  );
}
