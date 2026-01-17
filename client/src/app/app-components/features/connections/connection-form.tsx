"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateConnection,
  useUpdateConnection,
  useTestConnection,
  Connection,
  ConnectionType,
  McpServerConfig,
} from "@/hooks/useConnections";
import { connectionTypeOptions } from "./connection";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, TestTube2 } from "lucide-react";

// ============================================
// Form Schema
// ============================================

const baseFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  type: z.nativeEnum(ConnectionType),
});

// MCP Server config schema
const mcpServerConfigSchema = z.object({
  transport: z.enum(["stdio", "sse", "streamable-http"]),
  serverUrl: z.string().optional(),
  command: z.string().optional(),
  args: z.string().optional(), // Will be split by newlines
  apiKey: z.string().optional(),
});

// Database config schema
const databaseConfigSchema = z.object({
  provider: z.enum(["postgresql", "mysql", "sqlite", "mongodb", "supabase"]),
  connectionString: z.string().optional(),
  host: z.string().optional(),
  port: z.coerce.number().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().default(false),
  supabaseUrl: z.string().optional(),
  supabaseKey: z.string().optional(),
});

// Documentation config schema
const documentationConfigSchema = z.object({
  sourceType: z.enum(["url", "file", "text"]),
  url: z.string().optional(),
  content: z.string().optional(),
  fileName: z.string().optional(),
  fileType: z.enum(["markdown", "openapi", "json", "yaml", "text"]).optional(),
});

// API endpoint config schema
const apiEndpointConfigSchema = z.object({
  baseUrl: z.string().min(1, "Base URL is required"),
  authType: z.enum(["none", "api_key", "bearer", "basic"]).default("none"),
  apiKey: z.string().optional(),
  apiKeyHeader: z.string().optional(),
  bearerToken: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  documentation: z.string().optional(),
});

type FormValues = z.infer<typeof baseFormSchema> & {
  mcpConfig?: z.infer<typeof mcpServerConfigSchema>;
  databaseConfig?: z.infer<typeof databaseConfigSchema>;
  documentationConfig?: z.infer<typeof documentationConfigSchema>;
  apiConfig?: z.infer<typeof apiEndpointConfigSchema>;
};

// ============================================
// Component
// ============================================

interface ConnectionFormProps {
  connection?: Connection;
  isEditing?: boolean;
}

export function ConnectionForm({ connection, isEditing = false }: ConnectionFormProps) {
  const router = useRouter();
  const createConnection = useCreateConnection();
  const updateConnection = useUpdateConnection();
  const testConnection = useTestConnection();

  const [selectedType, setSelectedType] = useState<ConnectionType>(
    connection?.type || ConnectionType.MCP_SERVER
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(baseFormSchema),
    defaultValues: {
      name: connection?.name || "",
      description: connection?.description || "",
      type: connection?.type || ConnectionType.MCP_SERVER,
      mcpConfig: {
        transport: "sse",
        serverUrl: "",
        command: "",
        args: "",
        apiKey: "",
      },
      databaseConfig: {
        provider: "supabase",
        connectionString: "",
        host: "",
        port: 5432,
        database: "",
        username: "",
        password: "",
        ssl: true,
        supabaseUrl: "",
        supabaseKey: "",
      },
      documentationConfig: {
        sourceType: "url",
        url: "",
        content: "",
        fileName: "",
        fileType: "markdown",
      },
      apiConfig: {
        baseUrl: "",
        authType: "none",
        apiKey: "",
        apiKeyHeader: "X-API-Key",
        bearerToken: "",
        username: "",
        password: "",
        documentation: "",
      },
    },
  });

  // Load existing connection data
  useEffect(() => {
    if (connection) {
      form.reset({
        name: connection.name,
        description: connection.description || "",
        type: connection.type,
        mcpConfig:
          connection.type === ConnectionType.MCP_SERVER
            ? {
                ...(connection.config as McpServerConfig),
                args: (connection.config as McpServerConfig).args?.join("\n") || "",
              }
            : undefined,
        databaseConfig:
          connection.type === ConnectionType.DATABASE ? (connection.config as any) : undefined,
        documentationConfig:
          connection.type === ConnectionType.DOCUMENTATION ? (connection.config as any) : undefined,
        apiConfig:
          connection.type === ConnectionType.API_ENDPOINT ? (connection.config as any) : undefined,
      });
      setSelectedType(connection.type);
    }
  }, [connection, form]);

  const onSubmit = async (data: FormValues) => {
    // Build config based on type
    let config: any = {};

    switch (data.type) {
      case ConnectionType.MCP_SERVER:
        config = {
          transport: data.mcpConfig?.transport || "sse",
          serverUrl: data.mcpConfig?.serverUrl,
          command: data.mcpConfig?.command,
          args: data.mcpConfig?.args?.split("\n").filter(Boolean) || [],
          apiKey: data.mcpConfig?.apiKey,
        };
        break;

      case ConnectionType.DATABASE:
        config = {
          provider: data.databaseConfig?.provider || "supabase",
          connectionString: data.databaseConfig?.connectionString,
          host: data.databaseConfig?.host,
          port: data.databaseConfig?.port,
          database: data.databaseConfig?.database,
          username: data.databaseConfig?.username,
          password: data.databaseConfig?.password,
          ssl: data.databaseConfig?.ssl,
          supabaseUrl: data.databaseConfig?.supabaseUrl,
          supabaseKey: data.databaseConfig?.supabaseKey,
        };
        break;

      case ConnectionType.DOCUMENTATION:
        config = {
          sourceType: data.documentationConfig?.sourceType || "url",
          url: data.documentationConfig?.url,
          content: data.documentationConfig?.content,
          fileName: data.documentationConfig?.fileName,
          fileType: data.documentationConfig?.fileType,
        };
        break;

      case ConnectionType.API_ENDPOINT:
        config = {
          baseUrl: data.apiConfig?.baseUrl,
          authType: data.apiConfig?.authType || "none",
          apiKey: data.apiConfig?.apiKey,
          apiKeyHeader: data.apiConfig?.apiKeyHeader,
          bearerToken: data.apiConfig?.bearerToken,
          username: data.apiConfig?.username,
          password: data.apiConfig?.password,
          documentation: data.apiConfig?.documentation,
        };
        break;
    }

    try {
      if (isEditing && connection) {
        await updateConnection.mutateAsync({
          id: connection.id,
          data: {
            name: data.name,
            description: data.description,
            type: data.type,
            config,
          },
        });
      } else {
        await createConnection.mutateAsync({
          name: data.name,
          description: data.description,
          type: data.type,
          config,
        });
      }
      router.push("/connections");
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleTest = () => {
    if (connection?.id) {
      testConnection.mutate(connection.id);
    }
  };

  const isPending = createConnection.isPending || updateConnection.isPending;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle>{isEditing ? "Edit Connection" : "Create Connection"}</CardTitle>
            <CardDescription>
              {isEditing
                ? "Update your connection settings"
                : "Add a new data source for Verxio Agent"}
            </CardDescription>
          </div>
          {isEditing && connection && (
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testConnection.isPending}
              className="shrink-0"
            >
              {testConnection.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <TestTube2 className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Supabase Database" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Production database for user data"
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Connection Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedType(value as ConnectionType);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {connectionTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <option.icon className="h-4 w-4" />
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {connectionTypeOptions.find((o) => o.value === selectedType)?.description}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Type-specific Configuration - rendered as bordered sections */}
            {selectedType === ConnectionType.MCP_SERVER && <McpServerConfigSection form={form} />}

            {selectedType === ConnectionType.DATABASE && <DatabaseConfigSection form={form} />}

            {selectedType === ConnectionType.DOCUMENTATION && (
              <DocumentationConfigSection form={form} />
            )}

            {selectedType === ConnectionType.API_ENDPOINT && (
              <ApiEndpointConfigSection form={form} />
            )}

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update" : "Create"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/connections")}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ============================================
// MCP Server Config Section
// ============================================

function McpServerConfigSection({ form }: { form: any }) {
  const transport = form.watch("mcpConfig.transport");

  return (
    <div className="space-y-4 pt-6 border-t">
      <div>
        <h3 className="text-sm font-medium">MCP Server Configuration</h3>
        <p className="text-sm text-muted-foreground">Configure how to connect to the MCP server</p>
      </div>
      <FormField
        control={form.control}
        name="mcpConfig.transport"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Transport</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select transport" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="sse">SSE (Server-Sent Events)</SelectItem>
                <SelectItem value="streamable-http">Streamable HTTP</SelectItem>
                <SelectItem value="stdio">Stdio (Local Process)</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {(transport === "sse" || transport === "streamable-http") && (
        <FormField
          control={form.control}
          name="mcpConfig.serverUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Server URL</FormLabel>
              <FormControl>
                <Input placeholder="https://mcp.example.com" {...field} />
              </FormControl>
              <FormDescription>The URL of the MCP server endpoint</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {transport === "stdio" && (
        <>
          <FormField
            control={form.control}
            name="mcpConfig.command"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Command</FormLabel>
                <FormControl>
                  <Input placeholder="npx" {...field} />
                </FormControl>
                <FormDescription>Command to start the MCP server process</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mcpConfig.args"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Arguments (one per line)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={"@supabase/mcp-server\n--url\nhttps://your-project.supabase.co"}
                    className="font-mono text-sm resize-none"
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormDescription>Command arguments, one per line</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      <FormField
        control={form.control}
        name="mcpConfig.apiKey"
        render={({ field }) => (
          <FormItem>
            <FormLabel>API Key (optional)</FormLabel>
            <FormControl>
              <Input type="password" placeholder="sk-..." {...field} />
            </FormControl>
            <FormDescription>API key for authentication if required</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// ============================================
// Database Config Section
// ============================================

function DatabaseConfigSection({ form }: { form: any }) {
  const provider = form.watch("databaseConfig.provider");

  return (
    <div className="space-y-4 pt-6 border-t">
      <div>
        <h3 className="text-sm font-medium">Database Configuration</h3>
        <p className="text-sm text-muted-foreground">Configure database connection details</p>
      </div>
      <FormField
        control={form.control}
        name="databaseConfig.provider"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Provider</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="supabase">Supabase</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="mongodb">MongoDB</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {provider === "supabase" ? (
        <>
          <FormField
            control={form.control}
            name="databaseConfig.supabaseUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supabase URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://your-project.supabase.co" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="databaseConfig.supabaseKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supabase API Key</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="eyJ..." {...field} />
                </FormControl>
                <FormDescription>Use the service role key for full database access</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      ) : (
        <>
          <FormField
            control={form.control}
            name="databaseConfig.connectionString"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Connection String (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="postgresql://user:pass@host:5432/db"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Full connection string (overrides other fields)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="databaseConfig.host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host</FormLabel>
                  <FormControl>
                    <Input placeholder="localhost" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="databaseConfig.port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="5432" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="databaseConfig.database"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Database Name</FormLabel>
                <FormControl>
                  <Input placeholder="mydb" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="databaseConfig.username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="postgres" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="databaseConfig.password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="databaseConfig.ssl"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <FormLabel className="font-normal">Use SSL</FormLabel>
                  <FormDescription>Enable SSL for secure connections</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </>
      )}
    </div>
  );
}

// ============================================
// Documentation Config Section
// ============================================

function DocumentationConfigSection({ form }: { form: any }) {
  const sourceType = form.watch("documentationConfig.sourceType");

  return (
    <div className="space-y-4 pt-6 border-t">
      <div>
        <h3 className="text-sm font-medium">Documentation Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Add API documentation for Verxio Agent context
        </p>
      </div>
      <FormField
        control={form.control}
        name="documentationConfig.sourceType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Source Type</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select source type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="text">Paste Content</SelectItem>
                <SelectItem value="file">Upload File</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {sourceType === "url" && (
        <FormField
          control={form.control}
          name="documentationConfig.url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Documentation URL</FormLabel>
              <FormControl>
                <Input placeholder="https://api.example.com/openapi.json" {...field} />
              </FormControl>
              <FormDescription>URL to OpenAPI spec, markdown docs, etc.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {sourceType === "text" && (
        <FormField
          control={form.control}
          name="documentationConfig.content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Documentation Content</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Paste your documentation content here..."
                  className="font-mono text-sm resize-none"
                  rows={10}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={form.control}
        name="documentationConfig.fileType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Content Type</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select content type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="openapi">OpenAPI/Swagger</SelectItem>
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="yaml">YAML</SelectItem>
                <SelectItem value="text">Plain Text</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// ============================================
// API Endpoint Config Section
// ============================================

function ApiEndpointConfigSection({ form }: { form: any }) {
  const authType = form.watch("apiConfig.authType");

  return (
    <div className="space-y-4 pt-6 border-t">
      <div>
        <h3 className="text-sm font-medium">API Endpoint Configuration</h3>
        <p className="text-sm text-muted-foreground">Configure REST/GraphQL API connection</p>
      </div>
      <FormField
        control={form.control}
        name="apiConfig.baseUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Base URL</FormLabel>
            <FormControl>
              <Input placeholder="https://api.example.com/v1" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="apiConfig.authType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Authentication Type</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select auth type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="api_key">API Key</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {authType === "api_key" && (
        <>
          <FormField
            control={form.control}
            name="apiConfig.apiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API Key</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="sk-..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="apiConfig.apiKeyHeader"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API Key Header</FormLabel>
                <FormControl>
                  <Input placeholder="X-API-Key" {...field} />
                </FormControl>
                <FormDescription>Header name for the API key</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      {authType === "bearer" && (
        <FormField
          control={form.control}
          name="apiConfig.bearerToken"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bearer Token</FormLabel>
              <FormControl>
                <Input type="password" placeholder="eyJ..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {authType === "basic" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="apiConfig.username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="apiConfig.password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      <FormField
        control={form.control}
        name="apiConfig.documentation"
        render={({ field }) => (
          <FormItem>
            <FormLabel>API Documentation (optional)</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Paste API documentation or OpenAPI spec here..."
                className="font-mono text-sm resize-none"
                rows={6}
                {...field}
              />
            </FormControl>
            <FormDescription>
              Optional inline documentation to help Claude understand the API
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
