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
import { useDeleteWorkflow, useTriggerInfo, Workflow } from "@/hooks/useWorkflows";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import {
  useOrganizations,
  useShareResource,
  useUnshareResource,
  useSharedResources,
} from "@/hooks/useOrganization";
import { formatDistanceToNow } from "date-fns";
import { WorkflowIcon, TrashIcon, FileOutput, Link2, Share2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { ExportWorkflowTemplateDialog } from "./export-workflow-template-dialog";

export const WorkflowsHeader = ({
  disabled,
  isCreating,
  onNew,
}: {
  disabled?: boolean;
  isCreating?: boolean;
  onNew?: () => void;
}) => {
  return (
    <EntityHeader
      title="Workflows"
      description="Create and manage workflows to automate your business processes"
      onNew={onNew}
      newButtonLabel="New Workflow"
      disabled={disabled}
      isCreating={isCreating}
      newButtonDataTourTarget="new-workflow-button"
    />
  );
};

export const WorkflowsContainer = ({
  children,
  searchValue,
  onSearchChange,
  currentPage,
  totalPages,
  onPageChange,
  isCreating,
  onCreateWorkflow,
}: {
  children: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  isCreating?: boolean;
  onCreateWorkflow?: () => void;
}) => {
  return (
    <EntityContainer
      header={<WorkflowsHeader isCreating={isCreating} onNew={onCreateWorkflow} />}
      search={
        searchValue !== undefined && onSearchChange ? (
          <WorkflowsSearch value={searchValue} onChange={onSearchChange} />
        ) : undefined
      }
      pagination={
        currentPage !== undefined && totalPages !== undefined && onPageChange ? (
          <WorkflowsPagination
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

export const WorkflowsSearch = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return <EntitySearch value={value} onChange={onChange} placeholder="Search workflows" />;
};

export const WorkflowsPagination = ({
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
      showInfo={true}
    />
  );
};

export const WorkflowsLoadingView = () => {
  return <LoadingView entity="workflows" message="Loading workflows..." />;
};

export const WorkflowsErrorView = () => {
  return <ErrorView message="Error loading workflows" />;
};

export const WorkflowsEmptyView = ({
  isCreating,
  onCreateWorkflow,
}: {
  isCreating?: boolean;
  onCreateWorkflow?: () => void;
}) => {
  return (
    <EmptyView
      message="No workflows found. Create your first workflow to get started."
      onNew={onCreateWorkflow}
      isCreating={isCreating}
    />
  );
};

export const WorkflowsList = ({ workflows }: { workflows: Workflow[] }) => {
  return (
    <EntityList
      items={workflows}
      renderItem={(workflow) => <WorkflowsItem workflow={workflow} />}
      getKey={(workflow) => workflow.id}
      emptyView={<WorkflowsEmptyView />}
    />
  );
};

export const WorkflowsItem = ({ workflow }: { workflow: Workflow }) => {
  const deleteWorkflow = useDeleteWorkflow();
  const triggerInfo = useTriggerInfo();
  const { subscription } = useSubscription();
  const { user } = useAuth();
  const { data: orgs } = useOrganizations();
  const adminOrg = orgs?.find((o) => o.role === "OWNER" || o.role === "ADMIN") ?? null;
  const { data: sharedResources } = useSharedResources(adminOrg?.id, "WORKFLOW");
  const shareResource = useShareResource();
  const unshareResource = useUnshareResource();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const hasExportAccess = subscription?.features?.includes("export-workflow-as-template") ?? false;
  const creatorUsername = (user?.name as string) || (user?.email as string) || "Creator";
  const isOrgAdmin = !!adminOrg;
  const isShared = sharedResources?.some((s) => s.resourceId === workflow.id) ?? false;
  const isOwnedByMe = workflow.userId === user?.id;

  const handleDelete = async () => {
    await deleteWorkflow.mutateAsync({ id: workflow.id, name: workflow.name });
  };

  const handleExportClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasExportAccess) {
      setExportDialogOpen(true);
    } else {
      toast.info("Upgrade plan to export workflow as template.");
    }
  };

  const handleCopyUrl = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await triggerInfo.mutateAsync(workflow.id);
      if (res.shareable && res.publicChatUrl) {
        await navigator.clipboard.writeText(res.publicChatUrl);
        toast.success("Shareable link copied to clipboard");
      } else {
        toast.info("Add a Webhook trigger to this workflow to enable shareable chat.");
      }
    } catch {
      toast.error("Failed to get shareable link");
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!adminOrg) return;
    if (isShared) {
      unshareResource.mutate({
        orgId: adminOrg.id,
        resourceType: "WORKFLOW",
        resourceId: workflow.id,
      });
    } else {
      shareResource.mutate({
        orgId: adminOrg.id,
        resourceType: "WORKFLOW",
        resourceId: workflow.id,
      });
    }
  };

  const dropdownItems = [
    {
      label: "Copy URL",
      onClick: handleCopyUrl,
      icon: <Link2 className="size-4" />,
      disabled: triggerInfo.isPending,
      loading: triggerInfo.isPending,
    },
    {
      label: "Export as template",
      onClick: handleExportClick,
      icon: <FileOutput className="size-4" />,
      disabled: false,
      loading: false,
    },
    ...(isOrgAdmin && isOwnedByMe
      ? [
          {
            label: isShared ? "Unshare with Org" : "Share with Org",
            onClick: handleShare,
            icon: isShared ? <XCircle className="size-4" /> : <Share2 className="size-4" />,
            disabled: shareResource.isPending || unshareResource.isPending,
            loading: shareResource.isPending || unshareResource.isPending,
          },
        ]
      : []),
    {
      label: "Delete",
      onClick: handleDelete,
      icon: <TrashIcon className="size-4" />,
      disabled: deleteWorkflow.isPending,
      loading: deleteWorkflow.isPending,
    },
  ];

  return (
    <>
      <EntityItem
        href={`/workflows/${workflow.id}`}
        title={workflow.name}
        subtitle={
          <span className="flex items-center gap-2">
            <span>
              Updated {formatDistanceToNow(workflow.updatedAt, { addSuffix: true })} &bull; Created{" "}
              {formatDistanceToNow(workflow.createdAt, { addSuffix: true })}
            </span>
            {isShared && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Shared
              </Badge>
            )}
            {!isOwnedByMe && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                From Org
              </Badge>
            )}
          </span>
        }
        image={
          <div className="size-8 flex items-center justify-center">
            <WorkflowIcon className="size-5 text-muted-foreground" />
          </div>
        }
        dropdownItems={dropdownItems}
      />
      <ExportWorkflowTemplateDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        workflowId={workflow.id}
        workflowName={workflow.name}
        creatorUsername={creatorUsername}
      />
    </>
  );
};
