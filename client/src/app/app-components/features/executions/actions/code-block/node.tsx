"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { CodeBlockDialog, CodeBlockFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { Code2 } from "lucide-react";

export const CodeBlockNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: CodeBlockFormValues) => {
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

  const nodeData = props.data as any;

  // Generate description based on configuration
  const getDescription = () => {
    if (!nodeData?.label && !nodeData?.code) {
      return "Configure to add custom code logic";
    }
    if (nodeData?.label) {
      return nodeData.label as string;
    }
    return "Custom code block";
  };

  return (
    <>
      <CodeBlockDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon={Code2}
        name="Custom Code"
        description={getDescription()}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-purple-600 dark:!text-purple-400"
        handleColor="!border-purple-500 !bg-purple-500"
      />
    </>
  );
});

CodeBlockNode.displayName = "CodeBlockNode";
