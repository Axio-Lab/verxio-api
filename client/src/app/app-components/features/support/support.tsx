import {
  EntityHeader,
  EntityContainer,
  EntitySearch,
  LoadingView,
  ErrorView,
  EmptyView,
} from "@/app/app-components/features/editor/entity-component";

export const SupportContainer = ({
  children,
  searchValue,
  onSearchChange,
  disabled,
  onNew,
  isCreating,
}: {
  children: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  disabled?: boolean;
  onNew: () => void;
  isCreating?: boolean;
}) => {
  return (
    <EntityContainer
      header={
        <EntityHeader
          title="Support"
          description="Create support agents that answer from your knowledge base."
          newButtonLabel="New Support Agent"
          onNew={onNew}
          disabled={disabled}
          isCreating={isCreating}
        />
      }
      search={
        searchValue !== undefined && onSearchChange ? (
          <EntitySearch
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Search support agents"
            dataTourTarget="support-search"
          />
        ) : undefined
      }
    >
      {children}
    </EntityContainer>
  );
};

export const SupportLoadingView = () => {
  return <LoadingView entity="support agents" message="Loading support agents..." />;
};

export const SupportErrorView = () => {
  return <ErrorView message="Error loading support agents" />;
};

export const SupportEmptyView = ({
  isCreating,
  onCreateSupportAgent,
}: {
  isCreating?: boolean;
  onCreateSupportAgent?: () => void;
}) => {
  return (
    <EmptyView
      message="No support agents found. Create your first support agent to get started."
      onNew={onCreateSupportAgent}
      isCreating={isCreating}
      newButtonDataTourTarget="new-support-agent-button"
    />
  );
};
