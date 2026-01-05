"use client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import Link from "next/link";

export const ExecutionBreadcrumbs = ({ executionId }: { executionId: string }) => {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link prefetch href="/executions">
              Executions
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <span className="text-muted-foreground">Execution Details</span>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export const ExecutionHeader = ({ executionId }: { executionId: string }) => {
  return (
    <div className="flex flex-row items-center justify-between gap-x-4 w-full">
      <ExecutionBreadcrumbs executionId={executionId} />
    </div>
  );
};
