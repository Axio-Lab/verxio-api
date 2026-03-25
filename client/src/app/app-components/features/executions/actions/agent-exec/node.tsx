"use client";

import type { NodeProps, Node, Edge } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState, useCallback } from "react";
import { AgentExecDialog, AgentExecFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { useParams } from "next/navigation";
import { authenticatedGet } from "@/lib/api-client";
import { Bot } from "lucide-react";

export const AgentExecNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes, setEdges, fitView } = useReactFlow();
  const params = useParams();
  const workflowId = (params?.id || params?.workflow) as string;
  const { status: nodeStatus, output } = useNodeStatus({ nodeId: props.id });

  const nodeData = props.data as any;

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: AgentExecFormValues) => {
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

  const handleRefreshCanvas = useCallback(async () => {
    if (!workflowId) return;

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

    const normalizeHandle = (handle: any): string | undefined => {
      if (!handle || handle === "null" || handle === "main" || handle === "" || handle === null) {
        return undefined;
      }
      return handle;
    };

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

    setNodes(newNodes);
    setEdges(newEdges);
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  }, [workflowId, setNodes, setEdges, fitView]);

  const getDescription = () => {
    const variableName = nodeData.variables || "agentExec";
    const usageHint = `Use {{${variableName}.result}} in next node`;

    if (nodeData.objective) {
      const objectivePreview =
        nodeData.objective.length > 30
          ? nodeData.objective.slice(0, 30) + "..."
          : nodeData.objective;
      return `${objectivePreview} • ${usageHint}`;
    }
    return usageHint;
  };

  return (
    <>
      <AgentExecDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
        onRefreshCanvas={handleRefreshCanvas}
      />
      <BaseExecutionNode
        {...props}
        icon={Bot}
        name="Agent Execute"
        description={getDescription()}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-violet-600 dark:!text-violet-400"
        handleColor="!border-violet-500 !bg-violet-500"
      />
    </>
  );
});

AgentExecNode.displayName = "AgentExecNode";
