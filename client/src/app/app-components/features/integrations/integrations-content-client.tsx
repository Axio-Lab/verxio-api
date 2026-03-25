"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IntegrationsContainer,
  IntegrationsLoadingView,
  IntegrationsErrorView,
  IntegrationsEmptyView,
  IntegrationsList,
} from "@/app/app-components/features/integrations/integration";
import { useChatIntegrations } from "@/hooks/useChatIntegrations";

export function IntegrationsContent() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: apiData, isLoading, error } = useChatIntegrations();

  const handleCreateIntegration = () => {
    router.push("/coworker/new");
  };

  const integrations = apiData?.integrations || [];
  const filteredIntegrations = integrations.filter((integration) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      integration.label.toLowerCase().includes(query) ||
      integration.platform.toLowerCase().includes(query) ||
      integration.scope.toLowerCase().includes(query)
    );
  });

  if (isLoading) {
    return (
      <IntegrationsContainer searchValue={searchQuery} onSearchChange={setSearchQuery}>
        <IntegrationsLoadingView />
      </IntegrationsContainer>
    );
  }

  if (error) {
    return (
      <IntegrationsContainer searchValue={searchQuery} onSearchChange={setSearchQuery}>
        <IntegrationsErrorView />
      </IntegrationsContainer>
    );
  }

  const isEmpty = integrations.length === 0;

  if (isEmpty && !searchQuery) {
    return <IntegrationsEmptyView onCreateIntegration={handleCreateIntegration} />;
  }

  return (
    <IntegrationsContainer searchValue={searchQuery} onSearchChange={setSearchQuery}>
      {filteredIntegrations.length > 0 ? (
        <IntegrationsList integrations={filteredIntegrations} />
      ) : (
        <IntegrationsEmptyView onCreateIntegration={handleCreateIntegration} />
      )}
    </IntegrationsContainer>
  );
}
