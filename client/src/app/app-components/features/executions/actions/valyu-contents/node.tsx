"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { ValyuContentsDialog, type ValyuContentsFormValues } from "./dialog";

export const ValyuContentsNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });

  const nodeData = props.data as any;

  const getDescription = () => {
    if (nodeData?.urls) {
      const urls = nodeData.urls as string;
      const lines = urls.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length > 0) {
        return `${lines.length} URL${lines.length > 1 ? "s" : ""}`;
      }
    }
    return "Extract content from URLs";
  };

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: ValyuContentsFormValues) => {
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
      <ValyuContentsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/valyu.svg"
        name={nodeData?.label || "Valyu Contents"}
        description={getDescription()}
        iconColor="!text-violet-600 dark:!text-violet-400"
        handleColor="!border-violet-500 !bg-violet-500"
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

ValyuContentsNode.displayName = "ValyuContentsNode";
