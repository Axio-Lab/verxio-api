"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CredentialsContainer,
  CredentialsLoadingView,
  CredentialsErrorView,
  CredentialsEmptyView,
  CredentialsList,
} from "@/app/app-components/features/credentials/credential";
import { useCredentials } from "@/hooks/useCredentials";

// Client component that fetches and displays credentials
export function CredentialsContent() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 10;

  const { data: apiData, isLoading, error } = useCredentials(currentPage, limit);

  const handleCreateCredential = () => {
    router.push("/credentials/new");
  };

  // Filter credentials by search query on client side
  const filteredCredentials =
    apiData?.credentials.filter((credential) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        credential.name.toLowerCase().includes(query) ||
        credential.type.toLowerCase().includes(query)
      );
    }) || [];

  // Calculate pagination for filtered results
  const filteredTotal = filteredCredentials.length;
  const filteredTotalPages = Math.ceil(filteredTotal / limit);

  // Show loading state
  if (isLoading) {
    return (
      <CredentialsContainer
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        currentPage={currentPage}
        totalPages={0}
        onPageChange={setCurrentPage}
      >
        <CredentialsLoadingView />
      </CredentialsContainer>
    );
  }

  // Show error state
  if (error) {
    return (
      <CredentialsContainer
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        currentPage={currentPage}
        totalPages={0}
        onPageChange={setCurrentPage}
      >
        <CredentialsErrorView />
      </CredentialsContainer>
    );
  }

  // Always show the container with header and search, even when empty
  const hasCredentials = filteredCredentials.length > 0;
  const isEmpty = !apiData || apiData.credentials.length === 0;

  // If there's no data at all (not just empty search results), show empty view outside container
  if (isEmpty && !searchQuery && currentPage === 1) {
    return <CredentialsEmptyView onCreateCredential={handleCreateCredential} />;
  }

  // Render credentials container with header and search always visible
  return (
    <CredentialsContainer
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      currentPage={searchQuery ? 1 : currentPage}
      totalPages={searchQuery ? filteredTotalPages : apiData?.totalPages || 0}
      onPageChange={setCurrentPage}
    >
      {hasCredentials ? (
        <CredentialsList credentials={filteredCredentials} />
      ) : (
        // Show empty view inside container when search returns no results
        <CredentialsEmptyView onCreateCredential={handleCreateCredential} />
      )}
    </CredentialsContainer>
  );
}
