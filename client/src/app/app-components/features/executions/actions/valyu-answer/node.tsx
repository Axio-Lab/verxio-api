"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { ValyuAnswerDialog, type ValyuAnswerFormValues } from "./dialog";

export const ValyuAnswerNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });

  const nodeData = props.data as any;

  const getDescription = () => {
    if (nodeData?.query) {
      const query = nodeData.query as string;
      return query.length > 60 ? query.slice(0, 57) + "..." : query;
    }
    return "AI-powered answers with search";
  };

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: ValyuAnswerFormValues) => {
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
      <ValyuAnswerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/valyu.svg"
        name={nodeData?.label || "Valyu Answer"}
        description={getDescription()}
        iconColor="!text-violet-600 dark:!text-violet-400"
        handleColor="!border-violet-500 !bg-violet-500"
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

ValyuAnswerNode.displayName = "ValyuAnswerNode";
