"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { KlingImage2VideoDialog, KlingImage2VideoFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { Video } from "lucide-react";

export const KlingImage2VideoNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({ nodeId: props.id });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: KlingImage2VideoFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === props.id ? { ...node, data: { ...node.data, ...values } } : node
      )
    );
  };

  const nodeData = props.data as Record<string, unknown>;
  const description =
    (nodeData?.prompt as string) || (nodeData?.image as string)
      ? "Kling Image-to-Video configured"
      : "Configure Kling Image-to-Video";

  return (
    <>
      <KlingImage2VideoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData as Partial<KlingImage2VideoFormValues>}
      />
      <BaseExecutionNode
        {...props}
        icon={Video}
        name="Kling Image-to-Video"
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

KlingImage2VideoNode.displayName = "KlingImage2VideoNode";
