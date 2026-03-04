"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { authenticatedPost, getAuthHeaders } from "@/lib/api-client";
import { useReactFlow, type Edge } from "@xyflow/react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";

export interface ExistingNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface ExistingConnection {
  id: string;
  source: string;
  target: string;
}

interface WorkflowGenerationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId?: string;
  mode?: "generate" | "edit";
  existingNodes?: ExistingNode[];
  existingConnections?: ExistingConnection[];
}

interface GeneratedNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
  position: { x: number; y: number };
}

interface GeneratedConnection {
  id: string;
  source: string;
  target: string;
  fromOutput?: string;
  toInput?: string;
}

interface WorkflowSummary {
  nodesCreated: Array<{
    id: string;
    type: string;
    name: string;
  }>;
  credentialsRequired: Array<{
    type: string;
    nodeId: string;
    nodeName: string;
    setupUrl: string;
  }>;
  fieldsToUpdate: Array<{
    nodeId: string;
    nodeName: string;
    field: string;
    instruction: string;
  }>;
  flowDescription: string;
}

interface GeneratedWorkflow {
  workflowId: string;
  nodes: GeneratedNode[];
  connections: GeneratedConnection[];
  summary?: WorkflowSummary;
}

interface AgentProgress {
  status: string;
  detail?: string;
  toolName?: string;
  nodeType?: string;
}

export const WorkflowGenerationPanel = ({
  open,
  onOpenChange,
  workflowId,
  mode = "generate",
  existingNodes = [],
}: WorkflowGenerationPanelProps) => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<WorkflowSummary | null>(null);
  const [agentProgress, setAgentProgress] = useState<AgentProgress[]>([]);
  const { setNodes, setEdges, fitView } = useReactFlow();
  const queryClient = useQueryClient();

  // Map tool names to user-friendly descriptions
  const getProgressMessage = (toolName: string, input?: any): string => {
    const toolMessages: Record<string, string> = {
      createWorkflow: "Creating new workflow",
      getWorkflow: "Reading existing workflow",
      addNode: `Adding ${input?.type?.replace(/_/g, " ") || "node"} node`,
      configureNode: `Configuring ${input?.nodeType?.replace(/_/g, " ") || "node"} settings`,
      connectNodes: "Connecting workflow nodes",
      getCredentials: "Checking available credentials",
      requestCredential: "Preparing credential requirements",
      generateCode: "Generating custom code block",
      Read: "Reading documentation",
      Grep: "Searching codebase",
      WebSearch: "Researching best practices",
    };
    return toolMessages[toolName] || `Processing: ${toolName}`;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt describing the workflow you want to generate");
      return;
    }

    setIsGenerating(true);
    setSummary(null);
    setAgentProgress([{ status: "Verxio Agent is analyzing your request..." }]);

    try {
      // Use streaming endpoint for real-time progress
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const authHeaders = await getAuthHeaders();

      const response = await fetch(`${baseUrl}/workflow-generation/generate/stream`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include", // Include cookies for Better Auth session
        body: JSON.stringify({
          prompt: prompt.trim(),
          workflowId: workflowId || undefined,
          editMode: mode === "edit",
          existingNodes:
            mode === "edit" && existingNodes
              ? existingNodes.map((n) => ({
                  type: n.type,
                  data: n.data || {},
                }))
              : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start workflow generation");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let resultData: GeneratedWorkflow | null = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

          for (const line of lines) {
            try {
              const jsonStr = line.replace("data: ", "").trim();
              if (!jsonStr) continue;

              const event = JSON.parse(jsonStr);

              // Handle different event types
              if (event.type === "tool_use") {
                const message = getProgressMessage(event.data.name, event.data.input);
                setAgentProgress((prev) => [
                  ...prev.slice(-4), // Keep last 5 messages
                  { status: message, toolName: event.data.name },
                ]);
              } else if (event.type === "message" && event.data.text) {
                // Show thinking/reasoning in progress
                if (event.data.text.length < 100) {
                  setAgentProgress((prev) => [
                    ...prev.slice(-4),
                    { status: event.data.text.substring(0, 80) + "..." },
                  ]);
                }
              } else if (event.type === "status") {
                setAgentProgress((prev) => [
                  ...prev.slice(-4),
                  { status: `Agent ${event.data.status}` },
                ]);
              } else if (event.type === "result" && event.data) {
                // Final result with workflow data
                resultData = event.data;
              } else if (event.type === "complete" && event.data) {
                resultData = event.data;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      // Process the final result
      if (resultData && resultData.nodes) {
        setAgentProgress((prev) => [...prev.slice(-4), { status: "Adding workflow to canvas..." }]);

        // Add nodes to canvas
        addNodesToCanvas(resultData.nodes, resultData.connections);

        // Invalidate workflow query
        if (resultData.workflowId) {
          await queryClient.invalidateQueries({ queryKey: ["workflow", resultData.workflowId] });
        }
        if (workflowId) {
          await queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
        }

        // Show summary
        if (resultData.summary) {
          setSummary(resultData.summary);
        }

        toast.success(
          mode === "edit" ? "Workflow updated successfully" : "Workflow generated successfully"
        );
      } else {
        // Fallback to non-streaming if no result from stream
        const data = await authenticatedPost<GeneratedWorkflow>("/workflow-generation/generate", {
          prompt: prompt.trim(),
          workflowId: workflowId || undefined,
          editMode: mode === "edit",
          existingNodes:
            mode === "edit" && existingNodes
              ? existingNodes.map((n) => ({ type: n.type, data: n.data || {} }))
              : undefined,
        });

        addNodesToCanvas(data.nodes, data.connections);

        if (data.workflowId) {
          await queryClient.invalidateQueries({ queryKey: ["workflow", data.workflowId] });
        }
        if (workflowId) {
          await queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
        }

        if (data.summary) {
          setSummary(data.summary);
        }

        toast.success(
          mode === "edit" ? "Workflow updated successfully" : "Workflow generated successfully"
        );
      }
    } catch (error) {
      console.error("Workflow generation error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate workflow. Please try again."
      );
    } finally {
      setIsGenerating(false);
      setAgentProgress([]);
    }
  };

  const addNodesToCanvas = (nodes: GeneratedNode[], connections: GeneratedConnection[]) => {
    // Convert generated nodes to React Flow format
    const newNodes = nodes.map((node) => ({
      id: node.id,
      type: node.type,
      data: node.data,
      position: node.position || { x: 0, y: 0 },
    }));

    // Validate connections
    const nodeIds = new Set(newNodes.map((n) => n.id));
    const validConnections = connections.filter((conn) => {
      return nodeIds.has(conn.source) && nodeIds.has(conn.target);
    });

    // Convert connections to edges
    const newEdges: Edge[] = validConnections.map((conn, index) => {
      const normalizeHandle = (handle: any): string | undefined => {
        if (!handle || handle === "null" || handle === "main" || handle === "") {
          return undefined;
        }
        return handle;
      };

      return {
        id: conn.id || `edge-${conn.source}-${conn.target}-${Date.now()}-${index}`,
        source: conn.source,
        target: conn.target,
        sourceHandle: normalizeHandle(conn.fromOutput),
        targetHandle: normalizeHandle(conn.toInput),
        deletable: true,
        selectable: true,
      };
    });

    // Update canvas: always replace with the latest generated workflow
    // This ensures agent/plan/chat-driven generations keep the canvas in sync
    setNodes(newNodes);
    setEdges(newEdges);

    // Fit view to show new nodes
    setTimeout(() => {
      fitView({
        padding: 0.25,
        duration: 500,
        includeHiddenNodes: false,
        nodes: newNodes.map((n) => ({ id: n.id })),
        minZoom: 0.5,
        maxZoom: 1.5,
      });
    }, 150);
  };

  const handleClose = () => {
    onOpenChange(false);
    setPrompt("");
    setSummary(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            {summary
              ? "Workflow Generated"
              : mode === "edit"
                ? "Edit Workflow with AI"
                : "Generate Workflow with AI"}
          </DialogTitle>
          <DialogDescription>
            {summary
              ? "Your workflow has been added to the canvas. Review the summary below."
              : mode === "edit"
                ? "Describe clearly the changes you want to make to your workflow."
                : "Describe clearly the workflow you want to create."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 space-y-4 mt-4 overflow-hidden">
          {/* Generation Form - shown when no summary */}
          {!summary && (
            <div className="flex-shrink-0 space-y-4">
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Powered by Verxio Agent. The agent automatically configures nodes and handles
                credentials.
              </div>

              <div>
                <label htmlFor="prompt" className="text-sm font-medium mb-2 block">
                  {mode === "edit" ? "Describe Changes" : "Describe Your Workflow"}
                </label>
                <Textarea
                  id="prompt"
                  placeholder={
                    mode === "edit"
                      ? "e.g., Add a step to send an email after the Slack message..."
                      : "e.g., Create a workflow that sends a Slack message when a new Airtable record is added..."
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[120px]"
                  disabled={isGenerating}
                />
              </div>
            </div>
          )}

          {/* Loading State with Real-time Progress */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="flex flex-col items-center gap-4 w-full max-w-md">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <p className="text-sm font-medium text-foreground">
                  {mode === "edit"
                    ? "Verxio Agent is updating your workflow"
                    : "Verxio Agent is building your workflow"}
                </p>

                {/* Progress Messages */}
                <div className="w-full space-y-2 bg-muted/50 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                  {agentProgress.length > 0 ? (
                    agentProgress.map((progress, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 text-xs ${
                          idx === agentProgress.length - 1
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {idx === agentProgress.length - 1 ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        )}
                        <span>{progress.status}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                      <span>Initializing agent...</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  The agent is autonomously configuring your workflow
                </p>
              </div>
            </div>
          )}

          {/* Summary - shown after generation */}
          {summary && (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Flow Description */}
              <div className="border rounded-md p-4 bg-muted/50">
                <h3 className="text-sm font-semibold mb-2">Flow Overview</h3>
                <p className="text-sm text-muted-foreground font-mono">{summary.flowDescription}</p>
              </div>

              {/* Nodes Created */}
              <div className="border rounded-md p-4">
                <h3 className="text-sm font-semibold mb-3">
                  Nodes Created ({summary.nodesCreated.length})
                </h3>
                <div className="space-y-2">
                  {summary.nodesCreated.map((node) => (
                    <div key={node.id} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">-</span>
                      <span>{node.name}</span>
                      <span className="text-xs text-muted-foreground">({node.type})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Credentials Required */}
              {summary.credentialsRequired.length > 0 && (
                <div className="border rounded-md p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                  <h3 className="text-sm font-semibold mb-3 text-amber-900 dark:text-amber-100">
                    Credentials Required
                  </h3>
                  <div className="space-y-3">
                    {summary.credentialsRequired.map((cred, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-amber-600 dark:text-amber-400 mt-0.5">-</span>
                        <div className="flex-1">
                          <span className="text-amber-800 dark:text-amber-200">
                            Add {cred.type} credential for &quot;{cred.nodeName}&quot;
                          </span>
                          <Link
                            href={cred.setupUrl}
                            className="ml-2 text-xs text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
                          >
                            Set up <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fields to Update */}
              {summary.fieldsToUpdate.length > 0 && (
                <div className="border rounded-md p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                  <h3 className="text-sm font-semibold mb-3 text-blue-900 dark:text-blue-100">
                    Configuration Required
                  </h3>
                  <div className="space-y-3">
                    {summary.fieldsToUpdate.map((field, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-600 dark:text-blue-400 mt-0.5">-</span>
                        <div className="text-blue-800 dark:text-blue-200">
                          <span className="font-medium">{field.nodeName}</span>: {field.instruction}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success message */}
              {summary.credentialsRequired.length === 0 && summary.fieldsToUpdate.length === 0 && (
                <div className="border rounded-md p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    All nodes have been configured and are ready to use.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 mt-4">
          {summary ? (
            <Button type="button" onClick={handleClose}>
              Close
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === "edit" ? "Updating..." : "Generating..."}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {mode === "edit" ? "Update Workflow" : "Generate Workflow"}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
