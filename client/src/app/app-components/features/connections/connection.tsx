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
import {
  useDeleteConnection,
  useToggleConnection,
  useTestConnection,
  Connection,
  ConnectionType,
} from "@/hooks/useConnections";
import { formatDistanceToNow } from "date-fns";
import {
  PlugIcon,
  Database,
  FileText,
  Globe,
  Server,
  CheckCircle2,
  XCircle,
  Clock,
  ToggleLeft,
  ToggleRight,
  TestTube2,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================================
// Connection Type Options
// ============================================

export const connectionTypeOptions = [
  {
    value: ConnectionType.MCP_SERVER,
    label: "MCP Server",
    description: "Connect to any MCP server (custom or third-party)",
    icon: Server,
    color: "bg-purple-500/10 text-purple-500",
  },
  {
    value: ConnectionType.DATABASE,
    label: "Database",
    description: "Direct database connection via MCP",
    icon: Database,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    value: ConnectionType.DOCUMENTATION,
    label: "Documentation",
    description: "API docs, guides, references (OpenAPI, markdown)",
    icon: FileText,
    color: "bg-green-500/10 text-green-500",
  },
  {
    value: ConnectionType.API_ENDPOINT,
    label: "API Endpoint",
    description: "REST/GraphQL API documentation",
    icon: Globe,
    color: "bg-orange-500/10 text-orange-500",
  },
];

export const getConnectionTypeOption = (type: ConnectionType) => {
  return connectionTypeOptions.find((option) => option.value === type);
};

// ============================================
// Header Component
// ============================================

export const ConnectionsHeader = ({ disabled }: { disabled?: boolean }) => {
  const router = useRouter();

  const handleNew = () => {
    router.push("/connections/new");
  };

  return (
    <EntityHeader
      title="Connections"
      description="Connect data sources for Verxio Agent"
      newButtonLabel="New Connection"
      onNew={handleNew}
      disabled={disabled}
    />
  );
};

// ============================================
// Container Component
// ============================================

export const ConnectionsContainer = ({
  children,
  searchValue,
  onSearchChange,
  currentPage,
  totalPages,
  onPageChange,
  disabled,
}: {
  children: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  disabled?: boolean;
}) => {
  return (
    <EntityContainer
      header={<ConnectionsHeader disabled={disabled} />}
      search={
        searchValue !== undefined && onSearchChange ? (
          <ConnectionsSearch value={searchValue} onChange={onSearchChange} />
        ) : undefined
      }
      pagination={
        currentPage !== undefined && totalPages !== undefined && onPageChange ? (
          <ConnectionsPagination
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

// ============================================
// Search Component
// ============================================

export const ConnectionsSearch = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return <EntitySearch value={value} onChange={onChange} placeholder="Search connections" />;
};

// ============================================
// Pagination Component
// ============================================

export const ConnectionsPagination = ({
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
    />
  );
};

// ============================================
// Loading View
// ============================================

export const ConnectionsLoadingView = () => {
  return <LoadingView entity="connections" message="Loading connections..." />;
};

// ============================================
// Error View
// ============================================

export const ConnectionsErrorView = () => {
  return <ErrorView message="Error loading connections" />;
};

// ============================================
// Empty View
// ============================================

export const ConnectionsEmptyView = ({
  isCreating,
  onCreateConnection,
}: {
  isCreating?: boolean;
  onCreateConnection?: () => void;
}) => {
  return (
    <EmptyView
      message="No connections found. Add data sources for Verxio Agent to access."
      onNew={onCreateConnection}
      isCreating={isCreating}
    />
  );
};

// ============================================
// List Component
// ============================================

export const ConnectionsList = ({ connections }: { connections: Connection[] }) => {
  return (
    <EntityList
      items={connections}
      renderItem={(connection) => <ConnectionsItem connection={connection} />}
      getKey={(connection) => connection.id}
      emptyView={<ConnectionsEmptyView />}
    />
  );
};

// ============================================
// Item Component
// ============================================

export const ConnectionsItem = ({ connection }: { connection: Connection }) => {
  const router = useRouter();
  const deleteConnection = useDeleteConnection();
  const toggleConnection = useToggleConnection();
  const testConnection = useTestConnection();

  const connectionOption = getConnectionTypeOption(connection.type);
  const Icon = connectionOption?.icon || PlugIcon;

  const handleClick = () => {
    router.push(`/connections/${connection.id}`);
  };

  const handleDelete = () => {
    deleteConnection.mutate({ id: connection.id, name: connection.name });
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleConnection.mutate(connection.id);
  };

  const handleTest = (e: React.MouseEvent) => {
    e.stopPropagation();
    testConnection.mutate(connection.id);
  };

  const getStatusIcon = () => {
    if (testConnection.isPending) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    switch (connection.testStatus) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <EntityItem
      href={`/connections/${connection.id}`}
      title={connection.name}
      subtitle={
        <div className="flex flex-col gap-1 mt-1">
          <span className="text-xs text-muted-foreground">
            {connection.description || connectionOption?.description || ""}
          </span>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={connection.isActive ? "default" : "secondary"} className="text-xs">
              {connection.isActive ? "Active" : "Inactive"}
            </Badge>
            <span>
              {connection.lastUsedAt
                ? `Used ${formatDistanceToNow(new Date(connection.lastUsedAt), { addSuffix: true })}`
                : "Never used"}
            </span>
            {connection.testStatus && (
              <span className="flex items-center gap-1">
                {getStatusIcon()}
                {connection.testStatus === "success" && "Tested"}
                {connection.testStatus === "failed" && "Failed"}
              </span>
            )}
          </div>
        </div>
      }
      image={
        <div className={cn("p-2 rounded-lg shrink-0", connectionOption?.color || "bg-muted")}>
          <Icon className="h-5 w-5" />
        </div>
      }
      action={
        <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleTest}
            disabled={testConnection.isPending}
            title="Test connection"
          >
            {testConnection.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            disabled={toggleConnection.isPending}
            title={connection.isActive ? "Deactivate" : "Activate"}
          >
            {connection.isActive ? (
              <ToggleRight className="h-4 w-4 text-green-500" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      }
      onRemove={handleDelete}
      isRemoving={deleteConnection.isPending}
    />
  );
};
