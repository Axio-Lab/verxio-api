"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { VeoDialog, VeoFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { Video } from "lucide-react";

export const VeoNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: VeoFormValues) => {
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

  const nodeData = props.data as any;

  // Generate description based on configuration
  const getDescription = () => {
    if (nodeData?.prompt) {
      // Truncate prompt if too long
      const prompt = nodeData.prompt as string;
      return prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt;
    }
    return "Configure Veo video generation";
  };

  return (
    <>
      <VeoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon={Video}
        name="Veo Video"
        description={getDescription()}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-blue-600 dark:!text-blue-400"
        handleColor="!border-blue-500 !bg-blue-500"
      />
    </>
  );
});

VeoNode.displayName = "VeoNode";
