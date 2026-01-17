"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseTriggerNode } from "./base-trigger-node";
import { memo, useState } from "react";
import { AirtableTriggerDialog } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";

export const AirtableTriggerNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const nodeData = props.data as any;

  return (
    <>
      <AirtableTriggerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        nodeId={props.id}
        defaultValues={{
          credentialId: nodeData?.credentialId,
          baseId: nodeData?.baseId,
          tableId: nodeData?.tableId,
          webhookId: nodeData?.webhookId,
          expirationTime: nodeData?.expirationTime,
        }}
      />
      <BaseTriggerNode
        {...props}
        icon="/logo/airtable.svg"
        name="Airtable Form Trigger"
        description="Triggers when a record is created"
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

AirtableTriggerNode.displayName = "AirtableTriggerNode";
