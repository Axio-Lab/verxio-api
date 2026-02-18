"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { ComposioActionDialog } from "./dialog";

export const ComposioActionNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });

  const nodeData = props.data as any;

  const getDescription = () => {
    if (nodeData?.composioActionName) {
      return nodeData.composioActionName.replace(/_/g, " ").toLowerCase();
    }
    return "Execute any of 10,000+ actions from 800+ apps";
  };

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: {
    variables: string;
    composioActionName: string;
    composioParams: Record<string, unknown>;
    label: string;
  }) => {
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
      <ComposioActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/composio.svg"
        name={nodeData?.label || "Composio Action"}
        description={getDescription()}
        iconColor="!text-purple-600 dark:!text-purple-400"
        handleColor="!border-purple-500 !bg-purple-500"
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

ComposioActionNode.displayName = "ComposioActionNode";
