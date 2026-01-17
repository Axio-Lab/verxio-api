"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseTriggerNode } from "../manual-trigger/base-trigger-node";
import { memo, useState } from "react";
import { TelegramTriggerDialog } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";

export const TelegramTriggerNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (credentialId: string) => {
    // Save the credentialId to node data
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return {
            ...node,
            data: {
              ...node.data,
              credentialId,
              configured: true,
            },
          };
        }
        return node;
      })
    );
  };

  const nodeData = props.data as any;

  return (
    <>
      <TelegramTriggerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={{
          credentialId: nodeData?.credentialId,
        }}
      />
      <BaseTriggerNode
        {...props}
        icon="/logo/telegram.svg"
        name="Telegram"
        description="Trigger when a message is received."
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

TelegramTriggerNode.displayName = "TelegramTriggerNode";
