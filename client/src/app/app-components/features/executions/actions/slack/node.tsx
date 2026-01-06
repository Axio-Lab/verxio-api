"use client";

import type { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "./base-execution-node";
import { SlackFormValues, SlackDialog } from "./dialog";
import { useReactFlow } from "@xyflow/react";
import { useNodeStatus } from "@/app/app-components/features/executions/hooks/use-node-status";

type SlackNodeData = {
  variables?: string;
  webhookUrl?: string;
  message?: string;
};

export const SlackNode = memo((props: NodeProps) => {
  const { data } = props;
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const nodeData = (data || {}) as SlackNodeData;

  const description = nodeData?.message
    ? `Send ${nodeData.message.slice(0, 50)}...`
    : "Not configured";

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: SlackFormValues) => {
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
      <SlackDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/slack.svg"
        name="Slack"
        description={description}
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

SlackNode.displayName = "SlackNode";
