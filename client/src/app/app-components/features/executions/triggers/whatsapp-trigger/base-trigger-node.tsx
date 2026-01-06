"use client";

import type { NodeProps } from "@xyflow/react";
import { Position } from "@xyflow/react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { memo, type ReactNode, useState } from "react";
import { BaseNode, BaseNodeContent } from "@/components/base-node";
import { BaseHandle } from "@/components/base-handle";
import { WorkflowNode } from "@/app/app-components/features/workflow/workflow-node";
import { cn } from "@/lib/utils";
import { NodeStatusIndicator, type NodeStatus } from "@/components/node-status-indicator";
import { NodeOutputDialog } from "../../node-output-dialog";

interface BaseTriggerNodeProps extends NodeProps {
  icon: LucideIcon | string;
  name: string;
  description?: string;
  children?: ReactNode;
  onSettings?: () => void;
  onDoubleClick?: () => void;
  status?: NodeStatus;
  output?: Record<string, unknown> | null;
}

export const BaseTriggerNode = memo(
  ({
    icon: Icon,
    name,
    description,
    children,
    selected,
    data,
    status = "initial",
    output = null,
    onSettings,
    onDoubleClick,
  }: BaseTriggerNodeProps) => {
    const isDeleting = data?.isDeleting === true;
    const [outputDialogOpen, setOutputDialogOpen] = useState(false);

    // Show info icon if node has executed (success or error status)
    const showInfoIcon = status === "success" || status === "error";

    const handleDelete = () => {
      if (data?.onDelete && typeof data.onDelete === "function") {
        data.onDelete();
      }
    };

    const shouldShowToolbar = selected || isDeleting;

    return (
      <>
        <NodeOutputDialog
          open={outputDialogOpen}
          onOpenChange={setOutputDialogOpen}
          output={output}
        />
        <WorkflowNode
          name={name}
          description={description}
          showToolbar={shouldShowToolbar}
          onSettings={onSettings}
          onDelete={handleDelete}
          isDeleting={isDeleting}
          showInfoIcon={showInfoIcon}
          onInfoClick={() => setOutputDialogOpen(true)}
        >
          <NodeStatusIndicator status={status} variant="border" className="rounded-md">
            <BaseNode onDoubleClick={onDoubleClick} status={status}>
              <BaseNodeContent>
                {typeof Icon === "string" ? (
                  <Image src={Icon} alt={name} width={16} height={16} />
                ) : (
                  <Icon className={cn("size-4")} />
                )}
                {children}
                <BaseHandle
                  id="source-1"
                  type="source"
                  position={Position.Right}
                  className="!border-green-500 !bg-green-500"
                />
              </BaseNodeContent>
            </BaseNode>
          </NodeStatusIndicator>
        </WorkflowNode>
      </>
    );
  }
);

BaseTriggerNode.displayName = "BaseTriggerNode";
