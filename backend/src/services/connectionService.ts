import { basePrismaClient } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { UserConnectionType } from "../../node_modules/.prisma/client";

const prismaClient = basePrismaClient as any;

// ============================================
// Types and Interfaces
// ============================================

export interface CreateConnectionData {
  name: string;
  description?: string;
  type: UserConnectionType;
  config: McpServerConfig | DatabaseConfig | DocumentationConfig | ApiEndpointConfig;
  metadata?: Record<string, any>;
  userId: string;
}

export interface UpdateConnectionData {
  name?: string;
  description?: string;
  type?: UserConnectionType;
  config?: McpServerConfig | DatabaseConfig | DocumentationConfig | ApiEndpointConfig;
  metadata?: Record<string, any>;
  isActive?: boolean;
}

export interface ConnectionResponse {
  id: string;
  name: string;
  description: string | null;
  type: UserConnectionType;
  config: Record<string, any>;
  metadata: Record<string, any> | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  lastTestedAt: Date | null;
  testStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectionsListResponse {
  connections: ConnectionResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// Config Types for Different Connection Types
// ============================================

export interface McpServerConfig {
  serverUrl: string;
  transport: "stdio" | "sse" | "streamable-http";
  command?: string; // For stdio transport
  args?: string[]; // For stdio transport
  env?: Record<string, string>;
  headers?: Record<string, string>; // For HTTP transports
  apiKey?: string; // Optional API key
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
  oauthConfig?: {
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
    scopes?: string[];
  };
  headers?: Record<string, string>;
  documentation?: string; // Optional embedded documentation
}

// ============================================
// Connection Type Validators
// ============================================

export function validateMcpServerConfig(config: any): config is McpServerConfig {
  if (!config.serverUrl && !config.command) {
    return false;
  }
  if (config.transport && !["stdio", "sse", "streamable-http"].includes(config.transport)) {
    return false;
  }
  return true;
}

export function validateDatabaseConfig(config: any): config is DatabaseConfig {
  if (!config.provider) return false;
  const validProviders = ["postgresql", "mysql", "sqlite", "mongodb", "supabase"];
  if (!validProviders.includes(config.provider)) return false;

  // Supabase requires specific fields
  if (config.provider === "supabase") {
    return !!(config.supabaseUrl && config.supabaseKey);
  }

  // Other databases need connection string or host
  return !!(config.connectionString || config.host);
}

export function validateDocumentationConfig(config: any): config is DocumentationConfig {
  if (!config.sourceType) return false;
  const validSourceTypes = ["url", "file", "text"];
  if (!validSourceTypes.includes(config.sourceType)) return false;

  if (config.sourceType === "url" && !config.url) return false;
  if (config.sourceType === "text" && !config.content) return false;

  return true;
}

export function validateApiEndpointConfig(config: any): config is ApiEndpointConfig {
  return !!config.baseUrl;
}

export function validateConnectionConfig(
  type: UserConnectionType,
  config: any
): { valid: boolean; error?: string } {
  switch (type) {
    case "MCP_SERVER":
      if (!validateMcpServerConfig(config)) {
        return {
          valid: false,
          error: "Invalid MCP server config. Requires serverUrl or command, and valid transport.",
        };
      }
      break;
    case "DATABASE":
      if (!validateDatabaseConfig(config)) {
        return {
          valid: false,
          error: "Invalid database config. Requires provider and connection details.",
        };
      }
      break;
    case "DOCUMENTATION":
      if (!validateDocumentationConfig(config)) {
        return {
          valid: false,
          error: "Invalid documentation config. Requires sourceType and corresponding source.",
        };
      }
      break;
    case "API_ENDPOINT":
      if (!validateApiEndpointConfig(config)) {
        return { valid: false, error: "Invalid API endpoint config. Requires baseUrl." };
      }
      break;
    default:
      return { valid: false, error: `Unknown connection type: ${type}` };
  }
  return { valid: true };
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a new user connection
 */
export const createConnection = async (data: CreateConnectionData): Promise<ConnectionResponse> => {
  if (!data.name || data.name.trim() === "") {
    throw new AppError("Connection name is required", 400);
  }

  if (!data.type) {
    throw new AppError("Connection type is required", 400);
  }

  if (!data.config) {
    throw new AppError("Connection config is required", 400);
  }

  if (!data.userId) {
    throw new AppError("User ID is required", 400);
  }

  // Verify user exists
  const user = await prismaClient.user.findUnique({
    where: { id: data.userId },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Validate config based on type
  const validation = validateConnectionConfig(data.type, data.config);
  if (!validation.valid) {
    throw new AppError(validation.error || "Invalid connection config", 400);
  }

  const connection = await prismaClient.userConnection.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      type: data.type,
      config: data.config,
      metadata: data.metadata || null,
      userId: data.userId,
    },
  });

  return connection;
};

/**
 * Get connections for a user with pagination and optional type filter
 */
export const getConnections = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
  type?: UserConnectionType,
  activeOnly: boolean = false
): Promise<ConnectionsListResponse> => {
  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  const skip = (page - 1) * limit;
  const take = limit;

  // Build where clause
  const where: any = { userId };
  if (type) {
    where.type = type;
  }
  if (activeOnly) {
    where.isActive = true;
  }

  // Get total count
  const total = await prismaClient.userConnection.count({ where });

  // Get connections
  const connections = await prismaClient.userConnection.findMany({
    where,
    skip,
    take,
    orderBy: {
      createdAt: "desc",
    },
  });

  const totalPages = Math.ceil(total / limit);

  return {
    connections,
    total,
    page,
    limit,
    totalPages: totalPages || 1,
  };
};

/**
 * Get a single connection by ID (only if it belongs to the user)
 */
export const getConnection = async (id: string, userId: string): Promise<ConnectionResponse> => {
  if (!id) {
    throw new AppError("Connection ID is required", 400);
  }

  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  const connection = await prismaClient.userConnection.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!connection) {
    throw new AppError("Connection not found", 404);
  }

  return connection;
};

/**
 * Update a connection
 */
export const updateConnection = async (
  id: string,
  userId: string,
  data: UpdateConnectionData
): Promise<ConnectionResponse> => {
  if (!id) {
    throw new AppError("Connection ID is required", 400);
  }

  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  // Check if connection exists and belongs to user
  const existingConnection = await prismaClient.userConnection.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!existingConnection) {
    throw new AppError("Connection not found", 404);
  }

  // Validate config if type or config is being updated
  if (data.config || data.type) {
    const typeToValidate = data.type || existingConnection.type;
    const configToValidate = data.config || existingConnection.config;
    const validation = validateConnectionConfig(typeToValidate, configToValidate);
    if (!validation.valid) {
      throw new AppError(validation.error || "Invalid connection config", 400);
    }
  }

  // Build update data
  const updateData: any = {};
  if (data.name !== undefined) {
    if (data.name.trim() === "") {
      throw new AppError("Connection name cannot be empty", 400);
    }
    updateData.name = data.name.trim();
  }
  if (data.description !== undefined) {
    updateData.description = data.description?.trim() || null;
  }
  if (data.type !== undefined) {
    updateData.type = data.type;
  }
  if (data.config !== undefined) {
    updateData.config = data.config;
  }
  if (data.metadata !== undefined) {
    updateData.metadata = data.metadata;
  }
  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }

  const connection = await prismaClient.userConnection.update({
    where: { id },
    data: updateData,
  });

  return connection;
};

/**
 * Delete a connection
 */
export const deleteConnection = async (id: string, userId: string): Promise<void> => {
  if (!id) {
    throw new AppError("Connection ID is required", 400);
  }

  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  // Check if connection exists and belongs to user
  const existingConnection = await prismaClient.userConnection.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!existingConnection) {
    throw new AppError("Connection not found", 404);
  }

  await prismaClient.userConnection.delete({
    where: { id },
  });
};

/**
 * Update connection last used timestamp
 */
export const markConnectionUsed = async (id: string): Promise<void> => {
  await prismaClient.userConnection.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });
};

/**
 * Update connection test status
 */
export const updateTestStatus = async (
  id: string,
  status: "success" | "failed" | "pending",
  metadata?: Record<string, any>
): Promise<ConnectionResponse> => {
  const updateData: any = {
    testStatus: status,
    lastTestedAt: new Date(),
  };

  if (metadata) {
    // Merge metadata
    const existing = await prismaClient.userConnection.findUnique({
      where: { id },
      select: { metadata: true },
    });
    updateData.metadata = {
      ...(existing?.metadata || {}),
      testResult: metadata,
    };
  }

  return prismaClient.userConnection.update({
    where: { id },
    data: updateData,
  });
};

// ============================================
// MCP Server Utilities
// ============================================

/**
 * Get all active MCP server connections for a user
 */
export const getActiveMcpConnections = async (userId: string): Promise<ConnectionResponse[]> => {
  return prismaClient.userConnection.findMany({
    where: {
      userId,
      type: "MCP_SERVER",
      isActive: true,
    },
    orderBy: {
      lastUsedAt: "desc",
    },
  });
};

/**
 * Get all active database connections for a user
 */
export const getActiveDatabaseConnections = async (
  userId: string
): Promise<ConnectionResponse[]> => {
  return prismaClient.userConnection.findMany({
    where: {
      userId,
      type: "DATABASE",
      isActive: true,
    },
    orderBy: {
      lastUsedAt: "desc",
    },
  });
};

/**
 * Get all documentation connections for a user
 */
export const getDocumentationConnections = async (
  userId: string
): Promise<ConnectionResponse[]> => {
  return prismaClient.userConnection.findMany({
    where: {
      userId,
      type: "DOCUMENTATION",
      isActive: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

/**
 * Search documentation content (for agent context)
 */
export const searchDocumentation = async (
  userId: string,
  query: string,
  connectionIds?: string[]
): Promise<Array<{ connectionName: string; content: string; score: number }>> => {
  // Get documentation connections
  const where: any = {
    userId,
    type: "DOCUMENTATION",
    isActive: true,
  };

  if (connectionIds && connectionIds.length > 0) {
    where.id = { in: connectionIds };
  }

  const docs = await prismaClient.userConnection.findMany({ where });

  // Simple text search (could be enhanced with vector search)
  const results: Array<{ connectionName: string; content: string; score: number }> = [];
  const queryLower = query.toLowerCase();

  for (const doc of docs) {
    const config = doc.config as DocumentationConfig;
    const content = config.content || "";

    if (content.toLowerCase().includes(queryLower)) {
      // Extract relevant section around the match
      const index = content.toLowerCase().indexOf(queryLower);
      const start = Math.max(0, index - 200);
      const end = Math.min(content.length, index + queryLower.length + 200);
      const relevantSection = content.substring(start, end);

      results.push({
        connectionName: doc.name,
        content: relevantSection,
        score: 1.0, // Simple scoring - could be enhanced
      });
    }
  }

  return results;
};

/**
 * Test a connection by attempting to connect
 */
export const testConnection = async (
  id: string,
  userId: string
): Promise<{ success: boolean; error?: string; details?: any }> => {
  const connection = await getConnection(id, userId);

  try {
    switch (connection.type) {
      case "MCP_SERVER":
        // For MCP servers, we'd need to actually try connecting
        // This is a placeholder - real implementation would spawn process or HTTP request
        const mcpConfig = connection.config as McpServerConfig;
        if (mcpConfig.transport === "sse" || mcpConfig.transport === "streamable-http") {
          // Test HTTP connection
          const response = await fetch(mcpConfig.serverUrl, {
            method: "GET",
            headers: mcpConfig.headers || {},
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        }
        await updateTestStatus(id, "success");
        return { success: true };

      case "DATABASE":
        // For databases, attempt a simple connection test
        // This is a placeholder - real implementation would use db client
        const dbConfig = connection.config as DatabaseConfig;
        if (dbConfig.provider === "supabase" && dbConfig.supabaseUrl) {
          const response = await fetch(`${dbConfig.supabaseUrl}/rest/v1/`, {
            headers: {
              apikey: dbConfig.supabaseKey || "",
              Authorization: `Bearer ${dbConfig.supabaseKey}`,
            },
          });
          if (!response.ok) {
            throw new Error(`Supabase connection failed: ${response.status}`);
          }
        }
        await updateTestStatus(id, "success");
        return { success: true };

      case "DOCUMENTATION":
        // For documentation, validate the source
        const docConfig = connection.config as DocumentationConfig;
        if (docConfig.sourceType === "url" && docConfig.url) {
          const response = await fetch(docConfig.url);
          if (!response.ok) {
            throw new Error(`Failed to fetch documentation: ${response.status}`);
          }
        }
        await updateTestStatus(id, "success");
        return { success: true };

      case "API_ENDPOINT":
        // For API endpoints, try a simple request
        const apiConfig = connection.config as ApiEndpointConfig;
        const headers: Record<string, string> = { ...apiConfig.headers };
        if (apiConfig.authType === "api_key" && apiConfig.apiKey) {
          headers[apiConfig.apiKeyHeader || "X-API-Key"] = apiConfig.apiKey;
        } else if (apiConfig.authType === "bearer" && apiConfig.bearerToken) {
          headers["Authorization"] = `Bearer ${apiConfig.bearerToken}`;
        }
        const apiResponse = await fetch(apiConfig.baseUrl, { headers });
        if (!apiResponse.ok) {
          throw new Error(`API connection failed: ${apiResponse.status}`);
        }
        await updateTestStatus(id, "success");
        return { success: true };

      default:
        return { success: false, error: "Unknown connection type" };
    }
  } catch (error: any) {
    await updateTestStatus(id, "failed", { error: error.message });
    return { success: false, error: error.message };
  }
};
