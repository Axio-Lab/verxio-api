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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css';
import { NodeComponents } from '@/app/app-components/features/editor/node-components';
import { AddNodeButton } from '@/app/app-components/features/editor/node-components';
import { NodeType } from '@/app/app-components/features/editor/node-types';
import { useSetAtom } from "jotai";
import { editorAtom } from "./atoms";

export const EditorLoader = () => {
  return <LoadingView message="Loading editor..." />;
}

export const EditorError = () => {
  return <ErrorView message="Error loading editor..." />;
}

export const Editor = ({ workflowId }: { workflowId: string }) => {
  const { data: workflow, isLoading, error } = useWorkflow(workflowId);
  const setEditor = useSetAtom(editorAtom);

  // Use ref to store the latest delete handler to avoid recreating nodes
  const deleteHandlerRef = useRef<(nodeId: string) => void>();
  
  // Handle node deletion - only removes from local state
  // Database is updated when user clicks save button
  const handleDeleteNode = useCallback((nodeId: string) => {
    // Remove node from local state immediately
    setNodes((currentNodes) => currentNodes.filter(node => node.id !== nodeId));
    // Also remove any edges connected to this node
    setEdges((currentEdges) => 
      currentEdges.filter(edge => edge.source !== nodeId && edge.target !== nodeId)
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
    return workflow.connections.map((conn) => ({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      sourceHandle: conn.sourceHandle,
      targetHandle: conn.targetHandle,
    }));
  }, [workflow?.connections]);

  // Local state is the source of truth - only sync from saved workflow on initial load
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const hasInitializedRef = useRef(false);
  const lastSavedWorkflowRef = useRef<string>('');
  const workflowIdRef = useRef<string>('');

  // Only sync from saved workflow on initial load or when workflow ID changes
  useEffect(() => {
    if (!workflow) return;
    
    // Reset if workflow ID changed (switched to different workflow)
    if (workflowIdRef.current !== workflow.id) {
      hasInitializedRef.current = false;
      lastSavedWorkflowRef.current = '';
      workflowIdRef.current = workflow.id;
    }
    
    // Create a unique key for the saved workflow state
    const workflowKey = JSON.stringify({
      nodeIds: (workflow.nodes || []).map(n => n.id).sort(),
      edgeIds: (workflow.connections || []).map(c => c.id).sort(),
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
      // Update our reference but keep local state as source of truth
      // The change detection will handle updating hasChanges
      lastSavedWorkflowRef.current = workflowKey;
    }
  }, [workflow?.id, workflowNodes, workflowEdges]);

  // Check if we should show the initial node (only when there are no other nodes)
  const hasNonInitialNodes = useMemo(() => {
    return nodes.some(node => node.type !== NodeType.INITIAL);
  }, [nodes]);

  // Filter out INITIAL node if there are other nodes
  const displayNodes = useMemo(() => {
    if (hasNonInitialNodes) {
      return nodes.filter(node => node.type !== NodeType.INITIAL);
    }
    return nodes;
  }, [nodes, hasNonInitialNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
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
        const hasNonInitial = updatedNodes.some(node => node.type !== NodeType.INITIAL);
        if (hasNonInitial) {
          return updatedNodes.filter(node => node.type !== NodeType.INITIAL);
        }
        return updatedNodes;
      });
    },
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect = useCallback(
    (params: Connection) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );
 

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
        >
          <Background />
          <Controls />
          <MiniMap />
          <Panel position="top-right">
            <AddNodeButton />
          </Panel>
        </ReactFlow>

    </div>
  );
};

export default Editor;