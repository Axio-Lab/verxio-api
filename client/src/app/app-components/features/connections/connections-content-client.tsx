"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ConnectionsContainer,
  ConnectionsLoadingView,
  ConnectionsErrorView,
  ConnectionsEmptyView,
  ConnectionsList,
} from "@/app/app-components/features/connections/connection";
import { useConnections } from "@/hooks/useConnections";

// Client component that fetches and displays connections
export function ConnectionsContent() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 10;

  const { data: apiData, isLoading, error } = useConnections(currentPage, limit);

  const handleCreateConnection = () => {
    router.push("/connections/new");
  };

  // Filter connections by search query on client side
  const filteredConnections =
    apiData?.connections.filter((connection) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        connection.name.toLowerCase().includes(query) ||
        connection.type.toLowerCase().includes(query) ||
        connection.description?.toLowerCase().includes(query)
      );
    }) || [];

  // Calculate pagination for filtered results
  const filteredTotal = filteredConnections.length;
  const filteredTotalPages = Math.ceil(filteredTotal / limit);

  // Show loading state
  if (isLoading) {
    return (
      <ConnectionsContainer
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        currentPage={currentPage}
        totalPages={0}
        onPageChange={setCurrentPage}
      >
        <ConnectionsLoadingView />
      </ConnectionsContainer>
    );
  }

  // Show error state
  if (error) {
    return (
      <ConnectionsContainer
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        currentPage={currentPage}
        totalPages={0}
        onPageChange={setCurrentPage}
      >
        <ConnectionsErrorView />
      </ConnectionsContainer>
    );
  }

  // Always show the container with header and search, even when empty
  const hasConnections = filteredConnections.length > 0;
  const isEmpty = !apiData || apiData.connections.length === 0;

  // If there's no data at all (not just empty search results), show empty view
  if (isEmpty && !searchQuery && currentPage === 1) {
    return <ConnectionsEmptyView onCreateConnection={handleCreateConnection} />;
  }

  // Render connections container with header and search always visible
  return (
    <ConnectionsContainer
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      currentPage={searchQuery ? 1 : currentPage}
      totalPages={searchQuery ? filteredTotalPages : apiData?.totalPages || 0}
      onPageChange={setCurrentPage}
    >
      {hasConnections ? (
        <ConnectionsList connections={filteredConnections} />
      ) : (
        // Show empty view inside container when search returns no results
        <ConnectionsEmptyView onCreateConnection={handleCreateConnection} />
      )}
    </ConnectionsContainer>
  );
}
