"use client";

import type { NodeProps } from "@xyflow/react";
import { WebhookIcon } from "lucide-react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../triggers/manual-trigger/base-trigger-node";
import { WebhookDialog, WebhookFormValues } from "./dialog";
import { useReactFlow } from "@xyflow/react";
import { useNodeStatus } from "../hooks/use-node-status";

type WebhookNodeData = {
  variables?: string;
  secret?: string;
  label?: string;
  [key: string]: unknown;
};

export const WebhookNode = memo((props: NodeProps) => {
  const { data } = props;
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const nodeData = (data || {}) as WebhookNodeData;

  // Webhook description shows if it's configured
  const description = nodeData?.secret ? "Configured with secret" : "Trigger via HTTP POST";

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: WebhookFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...values,
              configured: true,
            },
          };
        }
        return node;
      })
    );
  };

  return (
    <>
      <WebhookDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
        nodeId={props.id}
      />
      <BaseTriggerNode
        {...props}
        icon={WebhookIcon}
        name="Webhook Trigger"
        description={description}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

WebhookNode.displayName = "WebhookNode";
