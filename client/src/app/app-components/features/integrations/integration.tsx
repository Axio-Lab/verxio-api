"use client";

import {
  EntityHeader,
  EntityContainer,
  EntitySearch,
  LoadingView,
  ErrorView,
  EmptyView,
  EntityList,
  EntityItem,
} from "../editor/entity-component";
import { ChatIntegration, useDeleteChatIntegration } from "@/hooks/useChatIntegrations";
import { formatDistanceToNow } from "date-fns";
import { Cable } from "lucide-react";
import { useRouter } from "next/navigation";

export const IntegrationsHeader = ({ disabled }: { disabled?: boolean }) => {
  const router = useRouter();

  const handleNew = () => {
    router.push("/integrations/new");
  };

  return (
    <EntityHeader
      title="Integrations"
      description="Create and manage your chat integrations"
      newButtonLabel="New Integration"
      onNew={handleNew}
      disabled={disabled}
      newButtonDataTourTarget="new-integration-button"
    />
  );
};

export const IntegrationsContainer = ({
  children,
  searchValue,
  onSearchChange,
  disabled,
}: {
  children: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  disabled?: boolean;
}) => {
  return (
    <EntityContainer
      header={
        <div data-tour-target="integrations-page">
          <IntegrationsHeader disabled={disabled} />
        </div>
      }
      search={
        searchValue !== undefined && onSearchChange ? (
          <EntitySearch
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Search integrations"
            dataTourTarget="integrations-search"
          />
        ) : undefined
      }
    >
      {children}
    </EntityContainer>
  );
};

export const IntegrationsLoadingView = () => {
  return <LoadingView entity="integrations" message="Loading integrations..." />;
};

export const IntegrationsErrorView = () => {
  return <ErrorView message="Error loading integrations" />;
};

export const IntegrationsEmptyView = ({
  isCreating,
  onCreateIntegration,
}: {
  isCreating?: boolean;
  onCreateIntegration?: () => void;
}) => {
  return (
    <div data-tour-target="integrations-list">
      <EmptyView
        message="No integrations found. Create your first integration to get started."
        onNew={onCreateIntegration}
        isCreating={isCreating}
        newButtonDataTourTarget="new-integration-button"
      />
    </div>
  );
};

export const IntegrationsList = ({ integrations }: { integrations: ChatIntegration[] }) => {
  return (
    <div data-tour-target="integrations-list">
      <EntityList
        items={integrations}
        renderItem={(integration) => <IntegrationItem integration={integration} />}
        getKey={(integration) => integration.id}
        emptyView={<IntegrationsEmptyView />}
      />
    </div>
  );
};

export const IntegrationItem = ({ integration }: { integration: ChatIntegration }) => {
  const deleteIntegration = useDeleteChatIntegration(integration.id);

  const handleDelete = async () => {
    await deleteIntegration.mutateAsync();
  };

  return (
    <EntityItem
      href={`/integrations/${integration.id}`}
      title={integration.label}
      subtitle={
        <span>
          {integration.platform} &bull; {integration.scope} &bull; Updated{" "}
          {formatDistanceToNow(new Date(integration.createdAt), { addSuffix: true })}
        </span>
      }
      image={
        <div className="size-8 flex items-center justify-center">
          <Cable className="size-5 text-muted-foreground" />
        </div>
      }
      onRemove={handleDelete}
      isRemoving={deleteIntegration.isPending}
    />
  );
};
