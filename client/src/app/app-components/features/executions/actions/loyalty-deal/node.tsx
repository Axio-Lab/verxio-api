"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { LoyaltyDealDialog, LoyaltyDealFormValues, LOYALTY_DEAL_ACTIONS } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { Ticket } from "lucide-react";

export const LoyaltyDealNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: LoyaltyDealFormValues) => {
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
      const action = LOYALTY_DEAL_ACTIONS.find((a) => a.value === nodeData.action);
      return action?.label || nodeData.action;
    }
    return "Configure loyalty deal action";
  };

  return (
    <>
      <LoyaltyDealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon={Ticket}
        name="Loyalty Deal"
        description={getDescription()}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-orange-600 dark:!text-orange-400"
        handleColor="!border-orange-500 !bg-orange-500"
      />
    </>
  );
});

LoyaltyDealNode.displayName = "LoyaltyDealNode";
