"use client";

import type { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "./base-execution-node";
import { WhatsAppFormValues, WhatsAppDialog } from "./dialog";
import { useReactFlow } from "@xyflow/react";
import { useNodeStatus } from "@/app/app-components/features/executions/hooks/use-node-status";

type WhatsAppNodeData = {
  variables?: string;
  phoneNumber?: string;
  message?: string;
  credentialId?: string;
};

export const WhatsAppNode = memo((props: NodeProps) => {
  const { data } = props;
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const nodeData = (data || {}) as WhatsAppNodeData;

  const description = nodeData?.message
    ? `${nodeData.phoneNumber || "No number"}: ${nodeData.message.substring(0, 50)}...`
    : "Not configured";

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: WhatsAppFormValues) => {
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
      <WhatsAppDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/whatsapp.svg"
        name="WhatsApp"
        description={description}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-green-600 dark:!text-green-400"
        handleColor="!border-green-500 !bg-green-500"
      />
    </>
  );
});

WhatsAppNode.displayName = "WhatsAppNode";
