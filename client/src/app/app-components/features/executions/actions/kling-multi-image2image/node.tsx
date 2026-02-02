"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { KlingMultiImage2ImageDialog, KlingMultiImage2ImageFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { Palette } from "lucide-react";

export const KlingMultiImage2ImageNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({ nodeId: props.id });

  const handleOpenSettings = () => setDialogOpen(true);
  const handleSubmit = (values: KlingMultiImage2ImageFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === props.id ? { ...node, data: { ...node.data, ...values } } : node
      )
    );
  };

  const nodeData = props.data as Record<string, unknown>;
  const description =
    (nodeData?.prompt as string)?.length > 50
      ? `${(nodeData.prompt as string).slice(0, 50)}...`
      : (nodeData?.prompt as string) || "Configure Kling Multi-Image to Image";

  return (
    <>
      <KlingMultiImage2ImageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData as Partial<KlingMultiImage2ImageFormValues>}
      />
      <BaseExecutionNode
        {...props}
        icon={Palette}
        name="Kling Multi-Image to Image"
        description={description}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-amber-600 dark:!text-amber-400"
        handleColor="!border-amber-500 !bg-amber-500"
      />
    </>
  );
});

KlingMultiImage2ImageNode.displayName = "KlingMultiImage2ImageNode";
