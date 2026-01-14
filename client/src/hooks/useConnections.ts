import { useQueryClient } from "@tanstack/react-query";
import { useProtectedQuery, useProtectedMutation } from "@/hooks/useProtectedApi";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedPut,
  authenticatedDelete,
} from "@/lib/api-client";
import { toast } from "sonner";

// ============================================
// Types
// ============================================

export enum ConnectionType {
  MCP_SERVER = "MCP_SERVER",
  DATABASE = "DATABASE",
  DOCUMENTATION = "DOCUMENTATION",
  API_ENDPOINT = "API_ENDPOINT",
}

export interface McpServerConfig {
  serverUrl?: string;
  transport: "stdio" | "sse" | "streamable-http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  apiKey?: string;
}

export interface DatabaseConfig {
  provider: "postgresql" | "mysql" | "sqlite" | "mongodb" | "supabase";
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  supabaseUrl?: string;
  supabaseKey?: string;
}

export interface DocumentationConfig {
  sourceType: "url" | "file" | "text";
  url?: string;
  content?: string;
  fileName?: string;
  fileType?: "markdown" | "openapi" | "json" | "yaml" | "text";
}

export interface ApiEndpointConfig {
  baseUrl: string;
  authType?: "none" | "api_key" | "bearer" | "basic" | "oauth2";
  apiKey?: string;
  apiKeyHeader?: string;
  bearerToken?: string;
  username?: string;
  password?: string;
  headers?: Record<string, string>;
  documentation?: string;
}

export type ConnectionConfig =
  | McpServerConfig
  | DatabaseConfig
  | DocumentationConfig
  | ApiEndpointConfig;

export interface Connection {
  id: string;
  name: string;
  description: string | null;
  type: ConnectionType;
  config: ConnectionConfig;
  metadata: Record<string, any> | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  lastTestedAt: Date | null;
  testStatus: "success" | "failed" | "pending" | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectionsResponse {
  connections: Connection[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateConnectionData {
  name: string;
  description?: string;
  type: ConnectionType;
  config: ConnectionConfig;
  metadata?: Record<string, any>;
}

export interface UpdateConnectionData {
  name?: string;
  description?: string;
  type?: ConnectionType;
  config?: ConnectionConfig;
  metadata?: Record<string, any>;
  isActive?: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  error?: string;
  details?: any;
}

// ============================================
// Hooks
// ============================================

/**
 * Get connections with pagination and optional type filter
 */
export function useConnections(
  page: number = 1,
  limit: number = 10,
  type?: ConnectionType,
  activeOnly: boolean = false
) {
  return useProtectedQuery<ConnectionsResponse>({
    queryKey: ["connections", page, limit, type, activeOnly],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (type) {
        params.append("type", type);
      }
      if (activeOnly) {
        params.append("activeOnly", "true");
      }
      return authenticatedGet<ConnectionsResponse>(`/connections?${params.toString()}`);
    },
  });
}

/**
 * Get a single connection by ID
 */
export function useConnection(id: string) {
  const queryClient = useQueryClient();

  return useProtectedQuery<Connection>({
    queryKey: ["connection", id],
    queryFn: () => authenticatedGet<Connection>(`/connections/${id}`),
    enabled: !!id,
    placeholderData: () => {
      const queries = queryClient.getQueriesData<ConnectionsResponse>({
        queryKey: ["connections"],
      });

      for (const [, data] of queries) {
        if (data?.connections) {
          const cachedConnection = data.connections.find((c) => c.id === id);
          if (cachedConnection) {
            return cachedConnection;
          }
        }
      }

      return undefined;
    },
  });
}

/**
 * Get all active MCP connections
 */
export function useActiveMcpConnections() {
  return useProtectedQuery<{ connections: Connection[] }>({
    queryKey: ["connections", "mcp", "active"],
    queryFn: () => authenticatedGet<{ connections: Connection[] }>("/connections/mcp/active"),
  });
}

/**
 * Get all active database connections
 */
export function useActiveDatabaseConnections() {
  return useProtectedQuery<{ connections: Connection[] }>({
    queryKey: ["connections", "database", "active"],
    queryFn: () => authenticatedGet<{ connections: Connection[] }>("/connections/database/active"),
  });
}

/**
 * Create a new connection
 */
export function useCreateConnection() {
  const queryClient = useQueryClient();

  return useProtectedMutation<Connection, Error, CreateConnectionData>({
    mutationFn: (data) => authenticatedPost<Connection>("/connections", data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      toast.success(`Connection "${data.name}" created`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to create connection";
      toast.error(errorMessage);
    },
  });
}

/**
 * Update a connection
 */
export function useUpdateConnection() {
  const queryClient = useQueryClient();

  return useProtectedMutation<Connection, Error, { id: string; data: UpdateConnectionData }>({
    mutationFn: ({ id, data }) => authenticatedPut<Connection>(`/connections/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      queryClient.invalidateQueries({ queryKey: ["connection", data.id] });
      toast.success(`Connection "${data.name}" updated`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to update connection";
      toast.error(errorMessage);
    },
  });
}

/**
 * Delete a connection
 */
export function useDeleteConnection() {
  const queryClient = useQueryClient();

  return useProtectedMutation<void, Error, { id: string; name: string }>({
    mutationFn: ({ id }) => authenticatedDelete(`/connections/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      toast.success(`Connection "${variables.name}" deleted`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete connection";
      toast.error(errorMessage);
    },
  });
}

/**
 * Test a connection
 */
export function useTestConnection() {
  const queryClient = useQueryClient();

  return useProtectedMutation<TestConnectionResult, Error, string>({
    mutationFn: (id) => authenticatedPost<TestConnectionResult>(`/connections/${id}/test`, {}),
    onSuccess: (result, id) => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      queryClient.invalidateQueries({ queryKey: ["connection", id] });

      if (result.success) {
        toast.success("Connection test successful!");
      } else {
        toast.error(`Connection test failed: ${result.error}`);
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to test connection";
      toast.error(errorMessage);
    },
  });
}

/**
 * Toggle connection active status
 */
export function useToggleConnection() {
  const queryClient = useQueryClient();

  return useProtectedMutation<Connection, Error, string>({
    mutationFn: (id) => authenticatedPost<Connection>(`/connections/${id}/toggle`, {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      queryClient.invalidateQueries({ queryKey: ["connection", data.id] });
      toast.success(`Connection "${data.name}" ${data.isActive ? "activated" : "deactivated"}`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to toggle connection";
      toast.error(errorMessage);
    },
  });
}

/**
 * Search documentation connections
 */
export function useSearchDocumentation() {
  return useProtectedMutation<
    { results: Array<{ connectionName: string; content: string; score: number }> },
    Error,
    { query: string; connectionIds?: string[] }
  >({
    mutationFn: (data) =>
      authenticatedPost<{
        results: Array<{ connectionName: string; content: string; score: number }>;
      }>("/connections/documentation/search", data),
  });
}
