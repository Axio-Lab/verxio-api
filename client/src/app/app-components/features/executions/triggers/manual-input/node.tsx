"use client";

import type { NodeProps } from "@xyflow/react";
import { Keyboard } from "lucide-react";
import { BaseExecutionNode } from "../../actions/https-request/base-execution-node";
import { memo, useState } from "react";
import { ManualInputDialog } from "./dialog";
import { useNodeStatus } from "@/app/app-components/features/executions/hooks/use-node-status";

export const ManualInputNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const nodeData = (props.data || {}) as { prompt?: string };
  const description = nodeData?.prompt
    ? `${nodeData.prompt.substring(0, 50)}...`
    : "Not configured";

  return (
    <>
      <ManualInputDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        nodeId={props.id}
        defaultValues={props.data}
      />
      <BaseExecutionNode
        {...props}
        icon={Keyboard}
        name="Manual Input"
        description={description}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-green-600 dark:!text-green-400"
        handleColor="!border-green-500 !bg-green-500"
      />
    </>
  );
});

ManualInputNode.displayName = "ManualInputNode";
