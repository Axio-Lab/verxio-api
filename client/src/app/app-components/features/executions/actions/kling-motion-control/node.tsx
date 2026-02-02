"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { KlingMotionControlDialog, KlingMotionControlFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { Video } from "lucide-react";

export const KlingMotionControlNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({ nodeId: props.id });

  const handleOpenSettings = () => setDialogOpen(true);
  const handleSubmit = (values: KlingMotionControlFormValues) => {
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
      : (nodeData?.prompt as string) || "Configure Kling Motion Control";

  return (
    <>
      <KlingMotionControlDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData as Partial<KlingMotionControlFormValues>}
      />
      <BaseExecutionNode
        {...props}
        icon={Video}
        name="Kling Motion Control"
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

KlingMotionControlNode.displayName = "KlingMotionControlNode";
