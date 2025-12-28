"use client";

import { useState } from "react";
import { 
  WorkflowsContainer, 
  WorkflowsLoadingView, 
  WorkflowsErrorView, 
  WorkflowsEmptyView,
  WorkflowsList
} from "@/app/app-components/auth-components/workflows";
import { useWorkflows, Workflow, WorkflowsResponse } from "@/hooks/useWorkflows";

// Mock data for testing
const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: "1",
    name: "Email Marketing Campaign",
    userId: "user-1",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-20"),
  },
  {
    id: "2",
    name: "Customer Onboarding",
    userId: "user-1",
    createdAt: new Date("2024-01-18"),
    updatedAt: new Date("2024-01-22"),
  },
  {
    id: "3",
    name: "Order Processing",
    userId: "user-1",
    createdAt: new Date("2024-01-20"),
    updatedAt: new Date("2024-01-25"),
  },
  {
    id: "4",
    name: "Invoice Generation",
    userId: "user-1",
    createdAt: new Date("2024-01-22"),
    updatedAt: new Date("2024-01-27"),
  },
  {
    id: "5",
    name: "Support Ticket Routing",
    userId: "user-1",
    createdAt: new Date("2024-01-25"),
    updatedAt: new Date("2024-01-30"),
  },
  {
    id: "6",
    name: "Product Inventory Sync",
    userId: "user-1",
    createdAt: new Date("2024-01-28"),
    updatedAt: new Date("2024-02-01"),
  },
  {
    id: "7",
    name: "User Registration",
    userId: "user-1",
    createdAt: new Date("2024-02-01"),
    updatedAt: new Date("2024-02-05"),
  },
  {
    id: "8",
    name: "Payment Processing",
    userId: "user-1",
    createdAt: new Date("2024-02-03"),
    updatedAt: new Date("2024-02-08"),
  },
];

const USE_MOCK_DATA = true; // Set to false to use real API

// Workflow item component
function WorkflowItem({ workflow }: { workflow: { id: string; name: string; createdAt: Date } }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-md shadow-gray-900/10">
      <h3 className="font-semibold text-textPrimary">{workflow.name}</h3>
      <p className="text-sm text-textSecondary">
        Created: {new Date(workflow.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}

// Client component that fetches and displays workflows
export function WorkflowsContent() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 5;

  const { data: apiData, isLoading, error } = useWorkflows(currentPage, limit, searchQuery || undefined);

  // Use mock data if enabled
  const data: WorkflowsResponse | undefined = USE_MOCK_DATA
    ? (() => {
        // Filter by search query if provided
        let filteredWorkflows = MOCK_WORKFLOWS;
        if (searchQuery) {
          filteredWorkflows = MOCK_WORKFLOWS.filter((workflow) =>
            workflow.name.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }

        // Calculate pagination
        const total = filteredWorkflows.length;
        const totalPages = Math.ceil(total / limit);
        const startIndex = (currentPage - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedWorkflows = filteredWorkflows.slice(startIndex, endIndex);

        return {
          workflows: paginatedWorkflows,
          total,
          page: currentPage,
          limit,
          totalPages: totalPages || 1,
        };
      })()
    : apiData;

  // Show loading state (only if not using mock data)
  if (!USE_MOCK_DATA && isLoading) {
    return (
      <WorkflowsContainer
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        currentPage={currentPage}
        totalPages={0}
        onPageChange={setCurrentPage}
      >
        <WorkflowsLoadingView />
      </WorkflowsContainer>
    );
  }

  // Show error state (only if not using mock data)
  if (!USE_MOCK_DATA && error) {
    return (
      <WorkflowsContainer
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        currentPage={currentPage}
        totalPages={0}
        onPageChange={setCurrentPage}
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
    return <WorkflowsEmptyView />;
  }

  // Render workflows container with header and search always visible
  return (
    <WorkflowsContainer
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      currentPage={currentPage}
      totalPages={data?.totalPages || 0}
      onPageChange={setCurrentPage}
    >
      {hasWorkflows ? (
        <WorkflowsList 
          workflows={data.workflows}
        />
      ) : (
        // Show empty view inside container when search returns no results
        <WorkflowsEmptyView />
      )}
    </WorkflowsContainer>
  );
}

