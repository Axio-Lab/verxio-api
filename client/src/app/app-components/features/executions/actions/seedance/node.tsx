"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { SeedanceDialog, SeedanceFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";

export const SeedanceNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({ nodeId: props.id });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: SeedanceFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === props.id ? { ...node, data: { ...node.data, ...values } } : node
      )
    );
  };

  const nodeData = props.data as Record<string, unknown>;
  const description =
    (nodeData?.prompt as string) || (nodeData?.mode as string)
      ? `Seedance ${nodeData?.mode || "video"} configured`
      : "Configure Seedance video generation";

  return (
    <>
      <SeedanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData as Partial<SeedanceFormValues>}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/byteplus.svg"
        name="Seedance"
        description={description}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-blue-600 dark:!text-blue-400"
        handleColor="!border-blue-500 !bg-blue-500"
      />
    </>
  );
});

SeedanceNode.displayName = "SeedanceNode";
