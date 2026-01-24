"use client";

import type { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../anthropic/base-execution-node";
import { RemotionFormValues, RemotionDialog } from "./dialog";
import { useReactFlow } from "@xyflow/react";
import { useNodeStatus } from "@/app/app-components/features/executions/hooks/use-node-status";

type RemotionNodeData = {
  variables?: string;
  prompt?: string;
  videoFormat?: string;
  backgroundAudio?: string;
  backgroundAudioFilename?: string;
  backgroundAudioVolume?: number;
  assets?: Array<{
    file: string;
    filename: string;
    type: "image" | "video" | "audio";
    sceneDescription?: string;
    startTime?: number;
    position?: { x?: number; y?: number };
    size?: { width?: number; height?: number };
  }>;
  [key: string]: unknown;
};

export const RemotionNode = memo((props: NodeProps) => {
  const { data } = props;
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const nodeData = (data || {}) as RemotionNodeData;

  const description = nodeData?.prompt
    ? `${nodeData.prompt.substring(0, 50)}...`
    : "Not configured";

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: RemotionFormValues) => {
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
      <RemotionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/remotion.svg"
        name="Remotion"
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

RemotionNode.displayName = "RemotionNode";
