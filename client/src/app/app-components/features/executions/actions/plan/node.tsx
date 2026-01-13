"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { PlanDialog, PlanFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { Sparkles } from "lucide-react";

export const PlanNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: PlanFormValues) => {
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
    if (!nodeData?.label) {
      return "Configure to plan workflow with AI";
    }
    return nodeData.label as string;
  };

  return (
    <>
      <PlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon={Sparkles}
        name="Plan Workflow"
        description={getDescription()}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-yellow-600 dark:!text-yellow-400"
        handleColor="!border-yellow-500 !bg-yellow-500"
      />
    </>
  );
});

PlanNode.displayName = "PlanNode";
