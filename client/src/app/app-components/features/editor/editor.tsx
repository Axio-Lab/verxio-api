"use client";

import { useWorkflow } from "@/hooks/useWorkflows";
import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { ErrorView, LoadingView } from "./entity-component";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  MiniMap,
  Background,
  Controls,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NodeComponents } from "@/app/app-components/features/editor/node-components";
import { AddNodeButton } from "@/app/app-components/features/editor/node-components";
import { NodeType } from "@/app/app-components/features/editor/node-types";
import { useSetAtom } from "jotai";
import { editorAtom } from "./atoms";
import { ExecuteWorkflowButton } from "../executions/execute-workflow-button";
import { WorkflowGenerationPanel } from "./workflow-generation-panel";
import type { ExistingNode, ExistingConnection } from "./workflow-generation-panel";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { AnimatedEdge } from "./animated-edge";
import { useWorkflowOutputsSync } from "../executions/hooks/use-workflow-outputs-sync";

// Custom edge types for animated connections during execution
const edgeTypes = {
  default: AnimatedEdge,
};
import { toast } from "sonner";

export const EditorLoader = () => {
  return <LoadingView message="Loading editor..." />;
};

export const EditorError = () => {
  return <ErrorView message="Error loading editor..." />;
};

export const Editor = ({ workflowId }: { workflowId: string }) => {
  const { data: workflow, isLoading, error } = useWorkflow(workflowId);
  const setEditor = useSetAtom(editorAtom);
  const { subscription } = useSubscription();
  const hasGenerateWorkflowAccess =
    subscription?.features?.includes("generate-workflow-with-ai") ?? false;

  // Subscribe to all workflow outputs and populate global store
  // This allows OUTPUT nodes to read from any source node immediately
  useWorkflowOutputsSync();

  // Use ref to store the latest delete handler to avoid recreating nodes
  const deleteHandlerRef = useRef<(nodeId: string) => void>();

  // Handle node deletion - only removes from local state
  // Database is updated when user clicks save button
  const handleDeleteNode = useCallback((nodeId: string) => {
    // Remove node from local state immediately
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
    // Also remove any edges connected to this node
    setEdges((currentEdges) =>
      currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    );
    // Changes will be saved to database when user clicks save button
  }, []);

  // Update ref whenever handler changes
  useEffect(() => {
    deleteHandlerRef.current = handleDeleteNode;
  }, [handleDeleteNode]);

  // Transform workflow nodes to ReactFlow Node format
  const workflowNodes = useMemo<Node[]>(() => {
    if (!workflow?.nodes) return [];
    return workflow.nodes.map((node) => {
      return {
        id: node.id,
        position: node.position,
        data: {
          ...node.data,
          label: node.name,
          onDelete: () => {
            // Use ref to avoid recreating function on every render
            if (deleteHandlerRef.current) {
              deleteHandlerRef.current(node.id);
            }
          },
        },
        type: node.type,
      };
    });
  }, [workflow?.nodes]);

  // Transform workflow connections to ReactFlow Edge format
  const workflowEdges = useMemo<Edge[]>(() => {
    if (!workflow?.connections) return [];
    return workflow.connections.map((conn) => {
      // Normalize handle values - convert "null", "main", empty string, or null to undefined
      const normalizeHandle = (handle: any): string | undefined => {
        if (!handle || handle === "null" || handle === "main" || handle === "" || handle === null) {
          return undefined;
        }
        return handle;
      };

      return {
        id: conn.id,
        source: conn.source,
        target: conn.target,
        sourceHandle: normalizeHandle(conn.sourceHandle),
        targetHandle: normalizeHandle(conn.targetHandle),
        // Keep edges deletable and selectable but use default styling
        deletable: true,
        selectable: true,
      };
    });
  }, [workflow?.connections]);

  // Local state is the source of truth - only sync from saved workflow on initial load
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const hasInitializedRef = useRef(false);
  const lastSavedWorkflowRef = useRef<string>("");
  const workflowIdRef = useRef<string>("");

  // Only sync from saved workflow on initial load or when workflow ID changes
  useEffect(() => {
    if (!workflow) return;

    // Reset if workflow ID changed (switched to different workflow)
    if (workflowIdRef.current !== workflow.id) {
      hasInitializedRef.current = false;
      lastSavedWorkflowRef.current = "";
      workflowIdRef.current = workflow.id;
    }

    // Create a unique key for the saved workflow state
    const workflowKey = JSON.stringify({
      nodeIds: (workflow.nodes || []).map((n) => n.id).sort(),
      edgeIds: (workflow.connections || []).map((c) => c.id).sort(),
    });

    // Only sync on initial load (when not yet initialized)
    // After that, local state is the source of truth
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      lastSavedWorkflowRef.current = workflowKey;

      // Transform and set nodes from saved workflow
      setNodes(workflowNodes);
      setEdges(workflowEdges);
    } else if (lastSavedWorkflowRef.current !== workflowKey) {
      // Saved workflow changed (likely after a save)
      // Merge saved workflow with current local state to preserve any locally added nodes
      const currentNodeIds = new Set(
        nodes.filter((n) => n.type !== NodeType.INITIAL).map((n) => n.id)
      );
      const savedNodeIds = new Set(
        workflowNodes.filter((n) => n.type !== NodeType.INITIAL).map((n) => n.id)
      );

      // Find nodes that exist in current state but not in saved workflow
      // These are locally added nodes that haven't been saved yet
      const locallyAddedNodes = nodes.filter(
        (n) => n.type !== NodeType.INITIAL && !savedNodeIds.has(n.id)
      );

      // Find nodes that exist in saved workflow but not in current state
      // These should be added (they were saved but missing from local state)
      const savedButMissingNodes = workflowNodes.filter(
        (n) => n.type !== NodeType.INITIAL && !currentNodeIds.has(n.id)
      );

      // Merge: start with saved workflow nodes, then add any locally added nodes
      const mergedNodes = [...workflowNodes, ...locallyAddedNodes];

      // For edges: merge saved edges with edges that connect locally added nodes
      const currentEdgeIds = new Set(edges.map((e) => `${e.source}-${e.target}`));
      const savedEdgeIds = new Set(workflowEdges.map((e) => `${e.source}-${e.target}`));
      const locallyAddedEdges = edges.filter((e) => !savedEdgeIds.has(`${e.source}-${e.target}`));
      const mergedEdges = [...workflowEdges, ...locallyAddedEdges];

      lastSavedWorkflowRef.current = workflowKey;

      // Use merged state: saved nodes + locally added nodes
      // This preserves locally added nodes while syncing saved state
      setNodes(mergedNodes);
      setEdges(mergedEdges);
    }
  }, [workflow?.id, workflowNodes, workflowEdges]);

  // Check if we should show the initial node (only when there are no other nodes)
  const hasNonInitialNodes = useMemo(() => {
    return nodes.some((node) => node.type !== NodeType.INITIAL);
  }, [nodes]);

  // Filter out INITIAL node if there are other nodes
  const displayNodes = useMemo(() => {
    if (hasNonInitialNodes) {
      return nodes.filter((node) => node.type !== NodeType.INITIAL);
    }
    return nodes;
  }, [nodes, hasNonInitialNodes]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nodesSnapshot) => {
      // Apply changes to the full nodes array (including INITIAL if present)
      let updatedNodes = applyNodeChanges(changes, nodesSnapshot);

      // Ensure all nodes have the onDelete handler (for unsaved nodes)
      updatedNodes = updatedNodes.map((node) => {
        // If node doesn't have onDelete handler, add it
        if (!node.data?.onDelete) {
          return {
            ...node,
            data: {
              ...node.data,
              onDelete: () => {
                if (deleteHandlerRef.current) {
                  deleteHandlerRef.current(node.id);
                }
              },
            },
          };
        }
        return node;
      });

      // If we have non-INITIAL nodes, automatically remove INITIAL nodes
      const hasNonInitial = updatedNodes.some((node) => node.type !== NodeType.INITIAL);
      if (hasNonInitial) {
        return updatedNodes.filter((node) => node.type !== NodeType.INITIAL);
      }
      return updatedNodes;
    });
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot));
  }, []);

  const onConnect = useCallback((params: Connection) => {
    // Create edge with default ReactFlow styling but keep it deletable
    const newEdge: Edge = {
      ...params,
      id: `edge-${params.source}-${params.target}-${Date.now()}`,
      deletable: true,
      selectable: true,
    };
    setEdges((edgesSnapshot) => addEdge(newEdge as Connection, edgesSnapshot));
  }, []);

  // Check if we have a manual trigger node (must be before early returns to follow Rules of Hooks)
  const hasManualTriggerNode = useMemo(() => {
    return nodes.some((node) => node.type === NodeType.MANUAL_TRIGGER);
  }, [nodes]);

  // Check if workflow has nodes (to determine button text)
  const hasNodes = useMemo(() => {
    return nodes.length > 0;
  }, [nodes]);

  // Check if there are any actual workflow nodes (excluding INITIAL node)
  const hasWorkflowNodes = useMemo(() => {
    return nodes.some((node) => node.type !== NodeType.INITIAL);
  }, [nodes]);

  const [editWorkflowOpen, setEditWorkflowOpen] = useState(false);

  if (isLoading) {
    return <EditorLoader />;
  }

  if (error) {
    return <EditorError />;
  }

  if (!workflow) {
    return <EditorError />;
  }

  return (
    <div className="size-full">
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        nodeTypes={NodeComponents}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setEditor}
        fitView
        panOnScroll
        snapToGrid
        snapGrid={[10, 10]}
        selectionOnDrag
        panOnDrag={false}
        proOptions={{ hideAttribution: true }}
        // Default edge options - only set deletable/selectable, keep default styling
        defaultEdgeOptions={{
          deletable: true,
          selectable: true,
          type: "default", // Use our custom animated edge
        }}
      >
        <Background />
        <Controls />
        <MiniMap />
        <Panel position="top-right" className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!hasGenerateWorkflowAccess) {
                toast.error("This is a premium feature. Please upgrade your plan to use it.");
                return;
              }
              setEditWorkflowOpen(true);
            }}
            className={`flex items-center gap-2 border-primary ${
              !hasGenerateWorkflowAccess ? "opacity-60" : ""
            }`}
            disabled={!hasGenerateWorkflowAccess}
          >
            <Sparkles className="h-4 w-4" />
            {hasWorkflowNodes ? "Edit with AI" : "Generate with AI"}
          </Button>
          <AddNodeButton workflowId={workflowId} />
        </Panel>
        {hasManualTriggerNode && (
          <Panel position="bottom-center">
            <ExecuteWorkflowButton workflowId={workflowId} />
          </Panel>
        )}
        <WorkflowGenerationPanel
          open={editWorkflowOpen}
          onOpenChange={setEditWorkflowOpen}
          workflowId={workflowId}
          mode={hasWorkflowNodes ? "edit" : "generate"}
          existingNodes={
            hasWorkflowNodes
              ? nodes
                  .filter((n) => n.type !== NodeType.INITIAL)
                  .map((n): ExistingNode => {
                    const nodeId: string = n.id || "";
                    const nodeType: string = n.type || "";
                    return {
                      id: nodeId,
                      type: nodeType,
                      data: (n.data || {}) as Record<string, unknown>,
                    };
                  })
              : undefined
          }
          existingConnections={
            hasWorkflowNodes
              ? edges.map((e): ExistingConnection => {
                  const edgeId: string = e.id || `edge-${e.source}-${e.target}`;
                  const source: string = e.source;
                  const target: string = e.target;
                  return {
                    id: edgeId,
                    source,
                    target,
                  };
                })
              : undefined
          }
        />
      </ReactFlow>
    </div>
  );
};

export default Editor;
