"use client";

import type { NodeProps } from "@xyflow/react";
import { PlusIcon } from "lucide-react";
import { memo } from "react";
import { PlaceholderNode } from "@/components/placeholder-node";
import { WorkflowNode } from "./workflow/workflow-node";

export const InitialNode = memo((props: NodeProps) => {

  return (
    <WorkflowNode showToolbar={false}>
    <PlaceholderNode
    {...props}
    >
        <div className="cursor-pointer flex items-center justify-center">
            <PlusIcon className="size-4" />
        </div>

    </PlaceholderNode>
    </WorkflowNode>
  );
});