"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { AgentExecDialog } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { Bot } from "lucide-react";

export const AgentExecNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { status: nodeStatus, output } = useNodeStatus({ nodeId: props.id });

  const nodeData = props.data as any;

  const handleOpenSettings = () => setDialogOpen(true);

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
        nodeId={props.id}
        defaultValues={nodeData}
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
