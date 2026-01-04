"use client";

import { useState, useEffect, useRef } from "react";
import { 
  WorkflowsContainer, 
  WorkflowsLoadingView, 
  WorkflowsErrorView, 
  WorkflowsEmptyView,
  WorkflowsList
} from "@/app/app-components/features/workflow/workflows";
import { useWorkflows, useCreateWorkflow } from "@/hooks/useWorkflows";
import { WorkflowNameInput } from "@/app/app-components/features/workflow/workflow-name-input";
import { useWorkflowSearch } from "@/hooks/useSearchParams";



// Client component that fetches and displays workflows
export function WorkflowsContent() {
  const { search: searchQuery, setSearch: setSearchQuery, page: currentPage, setPage: setCurrentPage, limit } = useWorkflowSearch();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Local state for search input to prevent focus loss on URL updates
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local search with URL search on mount or when URL changes externally
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Debounced search update to URL
  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Update URL after 300ms of no typing
    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(value);
      // Reset to page 1 when search changes
      if (value !== searchQuery) {
        setCurrentPage(1);
      }
    }, 300);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const { data: apiData, isLoading, error } = useWorkflows(currentPage, limit, searchQuery || undefined);
  const createWorkflow = useCreateWorkflow();

  const handleCreateWorkflow = (name: string) => {
    createWorkflow.mutate(
      { name },
      {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
        },
      }
    );
  };

  const handleOpenCreateDialog = () => {
    setIsCreateDialogOpen(true);
  };

  const data = apiData;

  // Show loading state
  if (isLoading) {
    return (
      <WorkflowsContainer
        searchValue={localSearch}
        onSearchChange={handleSearchChange}
        currentPage={currentPage}
        totalPages={0}
        onPageChange={setCurrentPage}
        isCreating={createWorkflow.isPending}
        onCreateWorkflow={handleOpenCreateDialog}
      >
        <WorkflowsLoadingView />
      </WorkflowsContainer>
    );
  }

  // Show error state
  if (error) {
    return (
      <WorkflowsContainer
        searchValue={localSearch}
        onSearchChange={handleSearchChange}
        currentPage={currentPage}
        totalPages={0}
        onPageChange={setCurrentPage}
        isCreating={createWorkflow.isPending}
        onCreateWorkflow={handleOpenCreateDialog}
      >
        <WorkflowsErrorView />
      </WorkflowsContainer>
    );
  }

  // Always show the container with header and search, even when empty
  // Only show empty view outside container when there's no data at all (initial load with no workflows)
  const hasWorkflows = data?.workflows && data.workflows.length > 0;
  const isEmpty = !data || !data.workflows || data.workflows.length === 0;
  
  // If there's no data at all (not just empty search results), show empty view outside container
  if (isEmpty && !searchQuery && currentPage === 1) {
    return (
      <>
        <WorkflowNameInput
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSubmit={handleCreateWorkflow}
          isPending={createWorkflow.isPending}
        />
        <WorkflowsEmptyView 
          isCreating={createWorkflow.isPending}
          onCreateWorkflow={handleOpenCreateDialog}
        />
      </>
    );
  }

  // Render workflows container with header and search always visible
  return (
    <>
      <WorkflowNameInput
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateWorkflow}
        isPending={createWorkflow.isPending}
      />

      <WorkflowsContainer
        searchValue={localSearch}
        onSearchChange={handleSearchChange}
        currentPage={currentPage}
        totalPages={data?.totalPages || 0}
        onPageChange={setCurrentPage}
        isCreating={createWorkflow.isPending}
        onCreateWorkflow={handleOpenCreateDialog}
      >
        {hasWorkflows ? (
          <WorkflowsList 
            workflows={data.workflows}
          />
        ) : (
          // Show empty view inside container when search returns no results
          <WorkflowsEmptyView 
            isCreating={createWorkflow.isPending}
            onCreateWorkflow={handleOpenCreateDialog}
          />
        )}
      </WorkflowsContainer>
    </>
  );
}

