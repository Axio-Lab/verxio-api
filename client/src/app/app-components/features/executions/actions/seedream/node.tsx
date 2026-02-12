"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { SeedreamDialog, type SeedreamFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";

export const SeedreamNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({ nodeId: props.id });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: SeedreamFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === props.id ? { ...node, data: { ...node.data, ...values } } : node
      )
    );
  };

  const nodeData = props.data as Record<string, unknown>;
  const description =
    (nodeData?.prompt as string) || (nodeData?.mode as string)
      ? `Seedream ${nodeData?.mode || "image"} configured`
      : "Configure Seedream image generation";

  return (
    <>
      <SeedreamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData as Partial<SeedreamFormValues>}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/byteplus.svg"
        name="Seedream"
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

SeedreamNode.displayName = "SeedreamNode";
