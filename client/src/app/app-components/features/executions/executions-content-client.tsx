"use client";

import { useState } from "react";
import {
  ExecutionsContainer,
  ExecutionsLoadingView,
  ExecutionsErrorView,
  ExecutionsEmptyView,
  ExecutionsList,
} from "@/app/app-components/features/executions/execution";
import { useAllExecutions } from "@/hooks/useExecutions";

// Client component that fetches and displays all executions for the user
export function ExecutionsContent() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 5;

  const { data: apiData, isLoading, error } = useAllExecutions(currentPage, limit);

  // Filter executions by search query on client side
  const filteredExecutions =
    apiData?.executions.filter((execution) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        execution.status.toLowerCase().includes(query) ||
        execution.id.toLowerCase().includes(query) ||
        (execution.error && execution.error.toLowerCase().includes(query))
      );
    }) || [];

  // Calculate pagination for filtered results
  const filteredTotal = filteredExecutions.length;
  const filteredTotalPages = Math.ceil(filteredTotal / limit);

  // Show loading state
  if (isLoading) {
    return (
      <ExecutionsContainer
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        currentPage={currentPage}
        totalPages={0}
        onPageChange={setCurrentPage}
      >
        <ExecutionsLoadingView />
      </ExecutionsContainer>
    );
  }

  // Show error state
  if (error) {
    return (
      <ExecutionsContainer
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        currentPage={currentPage}
        totalPages={0}
        onPageChange={setCurrentPage}
      >
        <ExecutionsErrorView />
      </ExecutionsContainer>
    );
  }

  // Always show the container with header and search, even when empty
  const hasExecutions = filteredExecutions.length > 0;
  const isEmpty = !apiData || apiData.executions.length === 0;

  // If there's no data at all (not just empty search results), show empty view outside container
  if (isEmpty && !searchQuery && currentPage === 1) {
    return <ExecutionsEmptyView />;
  }

  // Render executions container with header and search always visible
  return (
    <ExecutionsContainer
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      currentPage={searchQuery ? 1 : currentPage}
      totalPages={searchQuery ? filteredTotalPages : apiData?.totalPages || 0}
      onPageChange={setCurrentPage}
    >
      {hasExecutions ? (
        <ExecutionsList executions={filteredExecutions} />
      ) : (
        // Show empty view inside container when search returns no results
        <ExecutionsEmptyView />
      )}
    </ExecutionsContainer>
  );
}
