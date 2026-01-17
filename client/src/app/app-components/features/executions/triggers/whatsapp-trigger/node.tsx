"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseTriggerNode } from "./base-trigger-node";
import { memo, useState } from "react";
import { WhatsAppTriggerDialog } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";

export const WhatsAppTriggerNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  return (
    <>
      <WhatsAppTriggerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
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
