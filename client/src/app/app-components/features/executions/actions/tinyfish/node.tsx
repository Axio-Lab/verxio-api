"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { TinyfishDialog, type TinyfishFormValues } from "./dialog";

export const TinyfishNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });

  const nodeData = props.data as any;

  const getDescription = () => {
    if (nodeData?.goal) {
      const goal = nodeData.goal as string;
      return goal.length > 60 ? goal.slice(0, 57) + "..." : goal;
    }
    if (nodeData?.url) {
      return nodeData.url as string;
    }
    return "AI-powered web automation";
  };

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: TinyfishFormValues) => {
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

  return (
    <>
      <TinyfishDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/tinyfish.svg"
        name={nodeData?.label || "TinyFish"}
        description={getDescription()}
        iconColor="!text-teal-600 dark:!text-teal-400"
        handleColor="!border-teal-500 !bg-teal-500"
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

TinyfishNode.displayName = "TinyfishNode";
