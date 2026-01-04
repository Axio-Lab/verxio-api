"use client";

import type { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "./base-execution-node";
import { DiscordFormValues, DiscordDialog } from "./dialog";
import { useReactFlow } from "@xyflow/react";
import { useNodeStatus } from "@/app/app-components/features/executions/hooks/use-node-status";

type DiscordNodeData = {
  variables?: string;
  webhookUrl?: string;
  username?: string;
  message?: string;
};

export const DiscordNode = memo((props: NodeProps) => {
  const { data } = props;
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const nodeStatus = useNodeStatus({
    nodeId: props.id,
  });
  const nodeData = (data || {}) as DiscordNodeData;

  const description = nodeData?.message
    ? `Send ${nodeData.message.slice(0, 50)}...`
    : "Not configured";

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: DiscordFormValues) => {
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
      <DiscordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/discord.svg"
        name="Discord"
        description={description}
        status={nodeStatus}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-indigo-600 dark:!text-indigo-400"
        handleColor="!border-indigo-500 !bg-indigo-500"
      />
    </>
  );
});

DiscordNode.displayName = "DiscordNode";
