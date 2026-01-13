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
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { authenticatedPost, authenticatedGet } from "@/lib/api-client";
import { useReactFlow, addEdge, type Edge } from "@xyflow/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Available Claude models for workflow generation
const CLAUDE_MODELS = [
  { value: "claude-opus-4-1-20250805", label: "Claude Opus 4.1" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-opus-4-5-20251101", label: "Claude Opus 4.5" },
  { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
] as const;

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

interface SetupInstruction {
  type: "credential" | "configuration" | "oauth";
  nodeId?: string;
  nodeType?: string;
  nodeLabel?: string;
  message: string;
  priority: "high" | "medium" | "low";
  action?: {
    type: "open_node" | "add_credential" | "connect_oauth";
    nodeId?: string;
    credentialType?: string;
    credentialName?: string;
  };
}

interface GeneratedWorkflow {
  id: string;
  nodes: GeneratedNode[];
  connections: GeneratedConnection[];
  status: string;
  setupInstructions?: SetupInstruction[];
}

export const WorkflowGenerationPanel = ({
  open,
  onOpenChange,
  workflowId,
  mode = "generate",
  existingNodes = [],
  existingConnections = [],
}: WorkflowGenerationPanelProps) => {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>("claude-3-5-sonnet-latest");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddingToCanvas, setIsAddingToCanvas] = useState(false);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [generatedWorkflow, setGeneratedWorkflow] = useState<GeneratedWorkflow | null>(null);
  const { setNodes, setEdges, fitView, getViewport } = useReactFlow();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt describing the workflow you want to generate");
      return;
    }

    setIsGenerating(true);
    setGenerationId(null);
    setGeneratedWorkflow(null);

    try {
      // Call workflow generation API
      const data = await authenticatedPost<GeneratedWorkflow>("/workflow-generation/generate", {
        prompt: prompt.trim(),
        workflowId: workflowId || undefined,
        model: model || "claude-sonnet-4-5-20250929",
        editMode: mode === "edit",
        existingNodes:
          mode === "edit" && existingNodes
            ? existingNodes.map((n) => ({
                type: n.type,
                data: n.data || {},
              }))
            : undefined,
      });

      setGenerationId(data.id);
      setGeneratedWorkflow(data);

      if (data.status === "completed") {
        toast.success("Workflow generated successfully!");
        setIsGenerating(false);
      } else {
        toast.info("Workflow generation started. Please wait...");
        // Poll for completion
        pollGenerationStatus(data.id);
      }
    } catch (error) {
      console.error("Workflow generation error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate workflow. Please try again."
      );
      setIsGenerating(false);
    }
  };

  const pollGenerationStatus = async (id: string) => {
    const maxAttempts = 60; // 60 seconds max
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const data = await authenticatedGet<GeneratedWorkflow>(`/workflow-generation/${id}`);
        // Merge nodes and connections from root level if generatedWorkflow is nested
        const workflowData: GeneratedWorkflow = {
          ...data,
          nodes: data.nodes || (data as any).generatedWorkflow?.nodes || [],
          connections: data.connections || (data as any).generatedWorkflow?.connections || [],
          setupInstructions: data.setupInstructions || (data as any).setupInstructions,
        };
        setGeneratedWorkflow(workflowData);

        if (data.status === "completed") {
          clearInterval(interval);
          setIsGenerating(false);
          toast.success("Workflow generated successfully!");
        } else if (data.status === "failed") {
          clearInterval(interval);
          setIsGenerating(false);
          toast.error("Workflow generation failed. Please try again.");
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setIsGenerating(false);
          toast.error("Workflow generation timed out. Please try again.");
        }
      } catch (error) {
        clearInterval(interval);
        setIsGenerating(false);
        console.error("Error polling generation status:", error);
      }
    }, 1000);

    // Cleanup on unmount or dialog close
    return () => clearInterval(interval);
  };

  const handleApprove = async () => {
    if (!generationId || !generatedWorkflow) {
      return;
    }

    setIsAddingToCanvas(true);
    try {
      // Get approved workflow data
      const result = await authenticatedPost<{
        nodes: GeneratedNode[];
        connections: GeneratedConnection[];
      }>(`/workflow-generation/${generationId}/approve`);
      const { nodes: approvedNodes, connections: approvedConnections } = result;

      // Nodes are already positioned around origin (0, 0) from backend
      // Backend's calculateWorkflowPositions centers the layout around origin
      // So we can use positions directly, or keep them as-is
      // Convert generated nodes to React Flow format
      const newNodes = approvedNodes.map((node: any) => {
        const position = node.position || { x: 0, y: 0 };

        return {
          id: node.id,
          type: node.type,
          data: node.data,
          position,
        };
      });

      // Validate that all connection sources and targets exist in newNodes
      const nodeIds = new Set(newNodes.map((n) => n.id));
      const validConnections = approvedConnections.filter((conn: any) => {
        const sourceExists = nodeIds.has(conn.source);
        const targetExists = nodeIds.has(conn.target);
        if (!sourceExists) {
          console.warn(`Connection source node not found: ${conn.source}`);
        }
        if (!targetExists) {
          console.warn(`Connection target node not found: ${conn.target}`);
        }
        return sourceExists && targetExists;
      });

      // Convert connections to edges (matching React Flow format from editor.tsx)
      // Note: React Flow uses sourceHandle/targetHandle for connection points
      // If handles are undefined, React Flow will use default handles
      const newEdges: Edge[] = validConnections.map((conn: any, index: number) => {
        // Map fromOutput/toInput to sourceHandle/targetHandle
        // React Flow expects handle IDs or undefined (uses default)
        const sourceHandle = conn.fromOutput || conn.sourceHandle;
        const targetHandle = conn.toInput || conn.targetHandle;

        // Helper to normalize handle values - convert "null", "main", empty string to undefined
        const normalizeHandle = (handle: any): string | undefined => {
          if (
            !handle ||
            handle === "null" ||
            handle === "main" ||
            handle === "" ||
            handle === null
          ) {
            return undefined;
          }
          return handle;
        };

        return {
          id: conn.id || `edge-${conn.source}-${conn.target}-${Date.now()}-${index}`,
          source: conn.source,
          target: conn.target,
          // Use undefined if handle is "main", "null", empty, or null - React Flow will use default handles
          sourceHandle: normalizeHandle(sourceHandle),
          targetHandle: normalizeHandle(targetHandle),
          deletable: true,
          selectable: true,
        };
      });

      // In edit mode, replace existing workflow with generated workflow
      // In generate mode, add new nodes to existing workflow
      if (mode === "edit") {
        // Replace all nodes and edges with the generated workflow (no deduplication)
        // This ensures the AI-generated workflow completely replaces the existing one
        setNodes(newNodes);
        setEdges(newEdges);
      } else {
        // Generate mode: add new nodes to existing workflow
        setNodes((nodes) => {
          const updated = [...nodes, ...newNodes];
          return updated;
        });

        setEdges((edges) => {
          const updated = [...edges, ...newEdges];
          return updated;
        });
      }

      // Center the view on the newly added nodes after a short delay
      // This ensures nodes are rendered before fitView is called
      // Use fitViewOptions to center both horizontally and vertically
      setTimeout(() => {
        // Get current viewport to ensure nodes stay within bounds
        const currentViewport = getViewport();

        // Fit view to show all new nodes, ensuring they're within viewport
        fitView({
          padding: 0.25, // 25% padding around nodes for better visual spacing
          duration: 500, // Smooth animation
          includeHiddenNodes: false,
          nodes: newNodes.map((n) => ({ id: n.id })),
          minZoom: 0.5, // Don't zoom in too much
          maxZoom: 1.5, // Don't zoom out too much
        });

        setIsAddingToCanvas(false);

        // Note: Change detection will automatically detect the changes
        // The save button will be enabled once changes are detected
      }, 150);

      toast.success(
        mode === "edit" ? "Workflow updated on canvas!" : "Workflow added to your canvas!"
      );
      onOpenChange(false);
      setPrompt("");
      setGeneratedWorkflow(null);
      setGenerationId(null);
    } catch (error) {
      console.error("Error approving workflow:", error);
      setIsAddingToCanvas(false);
      toast.error("Failed to add workflow to canvas. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
        {isAddingToCanvas && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              <p className="text-sm font-medium">Adding nodes to canvas...</p>
              <p className="text-xs text-muted-foreground">Please wait</p>
            </div>
          </div>
        )}
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            {mode === "edit" ? "Edit Workflow with AI" : "Generate Workflow with AI"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Describe clearly the changes you want to make to your workflow, and Verxio will update it for you."
              : "Describe clearly the workflow you want to create, and Verxio will generate it for you using existing nodes or custom code blocks."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 space-y-4 mt-4 overflow-hidden">
          <div className="flex-shrink-0 space-y-4">
            <div>
              <Label htmlFor="model" className="text-sm font-medium mb-2 block">
                Claude Model
              </Label>
              <Select value={model} onValueChange={setModel} disabled={isGenerating}>
                <SelectTrigger id="model" className="w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {CLAUDE_MODELS.map((modelOption) => (
                    <SelectItem key={modelOption.value} value={modelOption.value}>
                      {modelOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Choose the Claude model to use for workflow generation. More capable models may
                produce better results but take longer.
              </p>
            </div>

            <div>
              <label htmlFor="prompt" className="text-sm font-medium mb-2 block">
                {mode === "edit" ? "Describe Changes to Your Workflow" : "Describe Your Workflow"}
              </label>
              <Textarea
                id="prompt"
                placeholder={
                  mode === "edit"
                    ? "e.g., Add a step to send an email after the Slack message, or update the Airtable node to include more fields..."
                    : "e.g., Create a workflow that sends a Slack message when a new Airtable record is added..."
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px]"
                disabled={isGenerating}
              />
            </div>
          </div>

          {isGenerating && (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <p className="text-sm text-muted-foreground">Generating workflow...</p>
                {generationId && (
                  <p className="text-xs text-muted-foreground">This may take a few moments</p>
                )}
              </div>
            </div>
          )}

          {generatedWorkflow && generatedWorkflow.status === "completed" && (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Setup Instructions */}
              {generatedWorkflow.setupInstructions &&
                generatedWorkflow.setupInstructions.length > 0 && (
                  <div className="border rounded-md p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg
                          className="h-5 w-5 text-amber-600 dark:text-amber-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">
                          Setup Required
                        </h3>
                        <ul className="space-y-2">
                          {generatedWorkflow.setupInstructions.map((instruction, index) => (
                            <li
                              key={index}
                              className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2"
                            >
                              <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                              <span>{instruction.message}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

              {/* Workflow Preview */}
              <div className="border rounded-md p-4 bg-muted/50">
                <h3 className="text-sm font-semibold mb-3">Generated Workflow Preview</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Nodes ({generatedWorkflow.nodes.length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {generatedWorkflow.nodes.map((node) => (
                        <span
                          key={node.id}
                          className="px-2 py-1 bg-background border rounded text-xs"
                        >
                          {(typeof node.data.label === "string" ? node.data.label : null) ||
                            node.type}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Connections ({generatedWorkflow.connections.length}):
                    </p>
                    <div className="text-xs text-muted-foreground">
                      {generatedWorkflow.connections.length > 0
                        ? `${generatedWorkflow.connections.length} connections between nodes`
                        : "No connections"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 mt-4">
          {generatedWorkflow && generatedWorkflow.status === "completed" ? (
            <Button type="button" onClick={handleApprove}>
              Add to Canvas
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
