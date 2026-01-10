"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { FirecrawlDialog, FirecrawlFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";

export const FirecrawlNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: FirecrawlFormValues) => {
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
      return "Configure to scrape, crawl, map, search, or use agent for deep research";
    }
    const actionLabels: Record<string, string> = {
      scrape: "Scrape a single web page",
      crawl: "Crawl a website and subpages",
      map: "Get sitemap of a website",
      search: "Search and scrape web results",
      agent: "Deep research agent - find data autonomously",
    };
    return actionLabels[nodeData.action] || "Firecrawl operation";
  };

  return (
    <>
      <FirecrawlDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/firecrawl.svg"
        name="Firecrawl"
        description={getDescription()}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

FirecrawlNode.displayName = "FirecrawlNode";
