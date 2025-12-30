"use client";

import { useWorkflow } from "@/hooks/useWorkflows";
import { useCallback, useState, useEffect, useMemo } from "react";
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

export const EditorLoader = () => {
  return <LoadingView message="Loading editor..." />;
}

export const EditorError = () => {
  return <ErrorView message="Error loading editor..." />;
}

export const Editor = ({ workflowId }: { workflowId: string }) => {
  const { data: workflow, isLoading, error } = useWorkflow(workflowId);

  // Transform workflow nodes to ReactFlow Node format
  const workflowNodes = useMemo<Node[]>(() => {
    if (!workflow?.nodes) return [];
    return workflow.nodes.map((node) => ({
      id: node.id,
      position: node.position,
      data: {
        ...node.data,
        label: node.name,
      },
      type: node.type,
    }));
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

  const [nodes, setNodes] = useState<Node[]>(workflowNodes);
  const [edges, setEdges] = useState<Edge[]>(workflowEdges);

  // Update nodes and edges when workflow data changes
  useEffect(() => {
    setNodes(workflowNodes);
    setEdges(workflowEdges);
  }, [workflowNodes, workflowEdges]);

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
        const updatedNodes = applyNodeChanges(changes, nodesSnapshot);
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
        fitView
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