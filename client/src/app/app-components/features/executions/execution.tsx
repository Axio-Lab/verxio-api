"use client";

import {
  EntityHeader,
  EntityContainer,
  EntitySearch,
  EntityPagination,
  LoadingView,
  ErrorView,
  EmptyView,
  EntityList,
  EntityItem,
} from "../editor/entity-component";
import { Execution, ExecutionStatus } from "@/hooks/useExecutions";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2Icon, XCircleIcon, Loader2Icon, ClockIcon } from "lucide-react";

export const ExecutionsHeader = ({ disabled }: { disabled?: boolean }) => {
  return (
    <EntityHeader
      title="Executions"
      description="View workflow execution history and logs"
      newButtonLabel="Execute Workflow"
      disabled={disabled}
    />
  );
};

export const ExecutionsContainer = ({
  children,
  searchValue,
  onSearchChange,
  currentPage,
  totalPages,
  onPageChange,
  disabled,
}: {
  children: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  disabled?: boolean;
}) => {
  return (
    <EntityContainer
      header={<ExecutionsHeader disabled={disabled} />}
      search={
        searchValue !== undefined && onSearchChange ? (
          <ExecutionsSearch value={searchValue} onChange={onSearchChange} />
        ) : undefined
      }
      pagination={
        currentPage !== undefined && totalPages !== undefined && onPageChange ? (
          <ExecutionsPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        ) : undefined
      }
    >
      {children}
    </EntityContainer>
  );
};

export const ExecutionsSearch = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return <EntitySearch value={value} onChange={onChange} placeholder="Search executions" />;
};

export const ExecutionsPagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) => {
  return (
    <EntityPagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  );
};

export const ExecutionsLoadingView = () => {
  return <LoadingView entity="executions" message="Loading executions..." />;
};

export const ExecutionsErrorView = () => {
  return <ErrorView message="Error loading executions" />;
};

export const ExecutionsEmptyView = () => {
  return (
    <EmptyView message="No executions found. Execute a workflow to see execution logs here." />
  );
};

export const ExecutionsList = ({ executions }: { executions: Execution[] }) => {
  return (
    <EntityList
      items={executions}
      renderItem={(execution) => <ExecutionsItem execution={execution} />}
      getKey={(execution) => execution.id}
      emptyView={<ExecutionsEmptyView />}
    />
  );
};
export const formatStatus = (status: ExecutionStatus) => {
  return status.charAt(0) + status.slice(1).toLowerCase();
};

export const getStatusIcon = (status: ExecutionStatus) => {
  switch (status) {
    case ExecutionStatus.SUCCESS:
      return (
        <CheckCircle2Icon
          className="size-5"
          style={{ color: "rgb(34, 197, 94)" }}
          strokeWidth={2}
        />
      );
    case ExecutionStatus.FAILED:
      return (
        <XCircleIcon className="size-5" style={{ color: "rgb(239, 68, 68)" }} strokeWidth={2} />
      );
    case ExecutionStatus.RUNNING:
      return (
        <Loader2Icon
          className="size-5 animate-spin"
          style={{ color: "rgb(59, 130, 246)" }}
          strokeWidth={2}
        />
      );
    default:
      return <ClockIcon className="size-5 text-muted-foreground" strokeWidth={2} />;
  }
};

export const ExecutionsItem = ({ execution }: { execution: Execution }) => {
  const duration = execution.completedAt
    ? Math.round(
        (new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000
      )
    : null;

  const subtitle = (
    <>
      {execution?.workflow?.name} &bull; Started{" "}
      {formatDistanceToNow(execution.startedAt, { addSuffix: true })}
      {duration !== null && ` • Took ${duration}s`}
    </>
  );

  return (
    <EntityItem
      href={`/executions/${execution.id}`}
      title={formatStatus(execution.status)}
      subtitle={subtitle}
      image={
        <div className="size-8 flex items-center justify-center [&>svg]:flex-shrink-0">
          {getStatusIcon(execution.status)}
        </div>
      }
    />
  );
};
