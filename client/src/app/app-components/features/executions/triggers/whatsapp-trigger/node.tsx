"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseTriggerNode } from "./base-trigger-node";
import { memo, useState } from "react";
import { WhatsAppTriggerDialog } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";

export const WhatsAppTriggerNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const nodeData = (props.data || {}) as { credentialId?: string };
  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (payload: { credentialId: string }) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === props.id
          ? {
              ...node,
              data: {
                ...node.data,
                credentialId: payload.credentialId,
                integrationId: undefined,
              },
              credentialId: payload.credentialId,
            }
          : node
      )
    );
  };

  return (
    <>
      <WhatsAppTriggerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={{ credentialId: nodeData.credentialId }}
      />
      <BaseTriggerNode
        {...props}
        icon="/logo/whatsapp.svg"
        name="WhatsApp"
        description="When a message is received."
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

WhatsAppTriggerNode.displayName = "WhatsAppTriggerNode";
