"use client";

import type { NodeProps } from "@xyflow/react";
import { memo, useState, useCallback } from "react";
import { BaseExecutionNode } from "../anthropic/base-execution-node";
import { AgentTeamDialog, AgentTeamFormValues } from "./dialog";
import { useReactFlow } from "@xyflow/react";
import { useNodeStatus } from "@/app/app-components/features/executions/hooks/use-node-status";
import { Users } from "lucide-react";

type AgentTeamNodeData = {
  variables?: string;
  objective?: string;
  strategy?: "sequential" | "parallel" | "supervisor";
  agents?: Array<{ name: string; role: string; personality?: string }>;
  maxRounds?: number;
  [key: string]: unknown;
};

function AgentTeamNodeComponent(props: NodeProps) {
  const { id, data } = props;
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status } = useNodeStatus({ nodeId: id });

  const nodeData = data as AgentTeamNodeData;
  const agentCount = nodeData.agents?.length || 0;

  const handleSubmit = useCallback(
    (values: AgentTeamFormValues) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...values } } : n))
      );
    },
    [id, setNodes]
  );

  return (
    <>
      <BaseExecutionNode
        {...props}
        name="Agent Team"
        icon={Users}
        status={status}
        onSettings={() => setDialogOpen(true)}
        description={
          agentCount > 0
            ? `${agentCount} agents · ${nodeData.strategy || "sequential"}`
            : "Configure agents"
        }
      />
      <AgentTeamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData as AgentTeamFormValues}
      />
    </>
  );
}

export const AgentTeamNode = memo(AgentTeamNodeComponent);
