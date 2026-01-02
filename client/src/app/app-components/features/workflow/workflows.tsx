"use client";

import { EntityHeader, EntityContainer, EntitySearch, EntityPagination, LoadingView, ErrorView, EmptyView, EntityList, EntityItem } from "../editor/entity-component";
import { useDeleteWorkflow, Workflow } from "@/hooks/useWorkflows";
import { formatDistanceToNow } from "date-fns";
import { WorkflowIcon } from "lucide-react";

export const WorkflowsHeader = ({ 
    disabled, 
    isCreating, 
    onNew 
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
        />
    )
}

export const WorkflowsContainer = ({ 
    children, 
    searchValue, 
    onSearchChange, 
    currentPage, 
    totalPages, 
    onPageChange,
    isCreating,
    onCreateWorkflow
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
            search={searchValue !== undefined && onSearchChange ? (
                <WorkflowsSearch value={searchValue} onChange={onSearchChange} />
            ) : undefined}
            pagination={currentPage !== undefined && totalPages !== undefined && onPageChange ? (
                <WorkflowsPagination 
                    currentPage={currentPage} 
                    totalPages={totalPages} 
                    onPageChange={onPageChange} 
                />
            ) : undefined}>
            {children}
        </EntityContainer>
    )
}

export const WorkflowsSearch = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
    return (
        <EntitySearch
            value={value}
            onChange={onChange}
            placeholder="Search workflows"
        />
    )
}

export const WorkflowsPagination = ({ 
    currentPage, 
    totalPages, 
    onPageChange 
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
    )
}

export const WorkflowsLoadingView = () => {
    return (
        <LoadingView
            entity="workflows"
            message="Loading workflows..."
        />
    )
}

export const WorkflowsErrorView = () => {
    return (
        <ErrorView
            message="Error loading workflows"
        />
    )
}

export const WorkflowsEmptyView = ({ 
    isCreating, 
    onCreateWorkflow 
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

export const WorkflowsList = ({ 
    workflows,
}: { 
    workflows: Workflow[];
}) => {
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

    const handleDelete = async () => {
        await deleteWorkflow.mutateAsync({ id: workflow.id, name: workflow.name });
    };

    return (
        <EntityItem
            href={`/workflows/${workflow.id}`}
            title={workflow.name}
            subtitle={
               <>
               Updated {formatDistanceToNow(workflow.updatedAt, {addSuffix: true})} {" "}
               &bull; Created {" "}
               {formatDistanceToNow(workflow.createdAt, {addSuffix: true})}
               </>
            }
            image={
                <div className="size-8 flex items-center justify-center">
                    <WorkflowIcon className="size-5 text-muted-foreground" />
                </div>
            }
            onRemove={handleDelete}
            isRemoving={deleteWorkflow.isPending}
        />
    );
};