"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { ApifyDialog, ApifyFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";

export const ApifyNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: ApifyFormValues) => {
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
    if (!nodeData?.action) {
      return "Configure to browse actors, run scrapers, or retrieve results";
    }
    const actionLabels: Record<string, string> = {
      listActors: "Browse/search actors from Apify Store",
      getActorDetail: "Get actor details",
      runActor: "Run an actor (scraper)",
      getRunStatus: "Check run status",
      getDatasetItems: "Get dataset results",
    };
    return actionLabels[nodeData.action] || "Apify operation";
  };

  return (
    <>
      <ApifyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/apify.svg"
        name="Apify"
        description={getDescription()}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

ApifyNode.displayName = "ApifyNode";
