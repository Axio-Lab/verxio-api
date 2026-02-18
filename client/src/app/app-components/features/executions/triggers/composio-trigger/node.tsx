"use client";

import type { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { BaseTriggerNode } from "../manual-trigger/base-trigger-node";
import { useNodeStatus } from "../../hooks/use-node-status";
import { ComposioTriggerDialog } from "./dialog";

export const ComposioTriggerNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });

  const nodeData = (props.data || {}) as Record<string, any>;
  const triggerSlug = nodeData.composioTriggerSlug as string | undefined;
  const syncStatus = nodeData.composioTriggerStatus as string | undefined;
  const enabled = nodeData.enabled !== false;

  const description = triggerSlug
    ? `${triggerSlug}${syncStatus ? ` (${syncStatus})` : ""}`
    : enabled
      ? "Configure Composio event trigger"
      : "Disabled";

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: {
    variables: string;
    composioTriggerSlug: string;
    triggerConfig: Record<string, unknown>;
    connectedAccountId?: string;
    enabled: boolean;
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
              composioTriggerStatus: "provisioning",
              composioTriggerError: undefined,
            },
          };
        }
        return node;
      })
    );
  };

  return (
    <>
      <ComposioTriggerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseTriggerNode
        {...props}
        icon="/logo/composio.svg"
        name={nodeData.label || "Composio Trigger"}
        description={description}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

ComposioTriggerNode.displayName = "ComposioTriggerNode";
