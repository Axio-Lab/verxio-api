"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { StrapiDialog, type StrapiFormValues } from "./dialog";

export const StrapiNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });

  const nodeData = props.data as any;

  const getDescription = () => {
    const action = nodeData?.action || "create";
    if (nodeData?.pageTitle) {
      const title = nodeData.pageTitle as string;
      return `${action}: ${title.length > 40 ? title.slice(0, 37) + "..." : title}`;
    }
    return `Landing page (${action})`;
  };

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: StrapiFormValues) => {
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
      <StrapiDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/strapi.svg"
        name={nodeData?.label || "Strapi"}
        description={getDescription()}
        iconColor="!text-indigo-600 dark:!text-indigo-400"
        handleColor="!border-indigo-500 !bg-indigo-500"
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

StrapiNode.displayName = "StrapiNode";
