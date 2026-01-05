"use client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { ExecutionBreadcrumbs } from "@/app/app-components/features/executions/execution-header";

export const AppHeader = () => {
  const pathname = usePathname();

  // Check if we're on an execution detail page
  const executionIdMatch = pathname?.match(/^\/executions\/([^/]+)$/);
  const executionId = executionIdMatch ? executionIdMatch[1] : null;

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-2 border-b px-4
        bg-background"
    >
      <SidebarTrigger />
      {executionId ? (
        <div className="flex flex-row items-center justify-between gap-x-4 w-full">
          <ExecutionBreadcrumbs executionId={executionId} />
        </div>
      ) : null}
    </header>
  );
};
