"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { DesignProDialog, DesignProFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { Palette } from "lucide-react";

export const DesignProNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: DesignProFormValues) => {
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
    const mode = nodeData?.mode || "generate";
    if (nodeData?.prompt) {
      const prompt = nodeData.prompt as string;
      const truncated = prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt;
      return `[${mode}] ${truncated}`;
    }
    return `Configure ${mode} mode`;
  };

  return (
    <>
      <DesignProDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={{
          variables: nodeData?.variables,
          mode: nodeData?.mode,
          model: nodeData?.model,
          template: nodeData?.template,
          aspectRatio: nodeData?.aspectRatio,
          imageSize: nodeData?.imageSize,
          prompt: nodeData?.prompt,
          sourceImage: nodeData?.sourceImage,
          sourceImageMimeType: nodeData?.sourceImageMimeType,
          referenceImages: nodeData?.referenceImages,
          useGoogleSearch: nodeData?.useGoogleSearch,
        }}
      />
      <BaseExecutionNode
        {...props}
        icon={Palette}
        name={nodeData?.label || "Nano Banana Pro"}
        description={getDescription()}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-pink-600 dark:!text-pink-400"
        handleColor="!border-pink-500 !bg-pink-500"
      />
    </>
  );
});

DesignProNode.displayName = "DesignProNode";
