"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { LoyaltyProgramDialog, LoyaltyProgramFormValues, LOYALTY_PROGRAM_ACTIONS } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { Award } from "lucide-react";

export const LoyaltyProgramNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: LoyaltyProgramFormValues) => {
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
    if (nodeData?.action) {
      const action = LOYALTY_PROGRAM_ACTIONS.find((a) => a.value === nodeData.action);
      return action?.label || nodeData.action;
    }
    return "Configure loyalty program action";
  };

  return (
    <>
      <LoyaltyProgramDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon={Award}
        name="Loyalty Program"
        description={getDescription()}
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

LoyaltyProgramNode.displayName = "LoyaltyProgramNode";
