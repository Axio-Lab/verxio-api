"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { GoogleMeetDialog, GoogleMeetFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";

export const GoogleMeetNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: GoogleMeetFormValues) => {
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

  return (
    <>
      <GoogleMeetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/googlemeet.svg"
        name="Google Meet"
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

GoogleMeetNode.displayName = "GoogleMeetNode";
