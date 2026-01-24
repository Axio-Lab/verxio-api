"use client";

import type { NodeProps, Node, Edge } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState, useCallback } from "react";
import { PlanDialog, PlanFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { Sparkles } from "lucide-react";
import { useParams } from "next/navigation";
import { authenticatedGet } from "@/lib/api-client";

export const PlanNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes, setEdges, fitView } = useReactFlow();
  const params = useParams();
  const workflowId = (params?.id || params?.workflow) as string;
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: PlanFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...values,
            },
          };
        }
        return node;
      })
    );
  };

  // Refresh canvas by fetching latest workflow data from backend
  const handleRefreshCanvas = useCallback(async () => {
    if (!workflowId) return;

    try {
      const workflow = await authenticatedGet<{
        nodes: Array<{
          id: string;
          type: string;
          name: string;
          position: { x: number; y: number };
          data: Record<string, any>;
        }>;
        connections: Array<{
          id: string;
          source: string;
          target: string;
          sourceHandle?: string | null;
          targetHandle?: string | null;
        }>;
      }>(`/workflow/${workflowId}`);

      // Normalize handle values - convert "null", "main", empty string, or null to undefined
      const normalizeHandle = (handle: any): string | undefined => {
        if (!handle || handle === "null" || handle === "main" || handle === "" || handle === null) {
          return undefined;
        }
        return handle;
      };

      // Transform to React Flow format (matching editor.tsx transformation)
      const newNodes: Node[] = workflow.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          ...node.data,
          label: node.name,
        },
      }));

      const newEdges: Edge[] = workflow.connections.map((conn) => ({
        id: conn.id,
        source: conn.source,
        target: conn.target,
        sourceHandle: normalizeHandle(conn.sourceHandle),
        targetHandle: normalizeHandle(conn.targetHandle),
        deletable: true,
        selectable: true,
      }));

      // Update React Flow state
      setNodes(newNodes);
      setEdges(newEdges);

      // Fit view to show all nodes
      setTimeout(() => fitView({ padding: 0.2 }), 100);
    } catch (error) {
      console.error("Failed to refresh canvas:", error);
      throw error;
    }
  }, [workflowId, setNodes, setEdges, fitView]);

  const nodeData = props.data as any;

  // Generate description - PLAN nodes don't need label anymore
  const getDescription = () => {
    return "Plan workflow with AI";
  };

  return (
    <>
      <PlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
        onRefreshCanvas={handleRefreshCanvas}
      />
      <BaseExecutionNode
        {...props}
        icon={Sparkles}
        name="Plan Workflow"
        description={getDescription()}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-yellow-600 dark:!text-yellow-400"
        handleColor="!border-yellow-500 !bg-yellow-500"
      />
    </>
  );
});

PlanNode.displayName = "PlanNode";
