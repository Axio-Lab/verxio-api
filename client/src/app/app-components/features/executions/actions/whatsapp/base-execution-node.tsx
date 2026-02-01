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
import { useExecuteNode } from "../../hooks/use-execute-node";

interface BaseExecutionNodeProps extends NodeProps {
  icon: LucideIcon | string;
  name: string;
  description?: string;
  children?: ReactNode;
  onSettings?: () => void;
  onDoubleClick?: () => void;
  onPlay?: () => void;
  showPlayButton?: boolean;
  isExecuting?: boolean;
  playDisabled?: boolean;
  iconColor?: string;
  handleColor?: string;
  status?: NodeStatus;
  output?: Record<string, unknown> | null;
}

export const BaseExecutionNode = memo(
  ({
    icon: Icon,
    name,
    description,
    children,
    id,
    selected,
    data,
    status = "initial",
    output = null,
    onSettings,
    onDoubleClick,
    onPlay,
    showPlayButton = true,
    isExecuting = false,
    playDisabled = false,
    iconColor = "!text-green-600 dark:!text-green-400",
    handleColor = "!border-green-500 !bg-green-500",
  }: BaseExecutionNodeProps) => {
    const isDeleting = data?.isDeleting === true;
    const [outputDialogOpen, setOutputDialogOpen] = useState(false);
    const {
      executeNode,
      isExecuting: internalIsExecuting,
      canExecute,
    } = useExecuteNode({
      nodeId: id,
      nodeData: (data as Record<string, unknown>) ?? null,
    });

    // Show info icon if node has executed (success or error status)
    const showInfoIcon = status === "success" || status === "error";

    const handleDelete = () => {
      if (data?.onDelete && typeof data.onDelete === "function") {
        data.onDelete();
      }
    };

    const shouldShowToolbar = selected || isDeleting;
    const resolvedOnPlay = onPlay || executeNode;
    const resolvedIsExecuting = isExecuting || internalIsExecuting;
    const resolvedPlayDisabled = playDisabled || (!onPlay && !canExecute);

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
          onPlay={resolvedOnPlay}
          showPlayButton={showPlayButton}
          isExecuting={resolvedIsExecuting}
          playDisabled={resolvedPlayDisabled}
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
                  <Icon className={cn("size-4", iconColor)} />
                )}
                {children}
                <BaseHandle
                  id="target-1"
                  type="target"
                  position={Position.Left}
                  className={handleColor}
                />

                <BaseHandle
                  id="source-1"
                  type="source"
                  position={Position.Right}
                  className={handleColor}
                />
              </BaseNodeContent>
            </BaseNode>
          </NodeStatusIndicator>
        </WorkflowNode>
      </>
    );
  }
);

BaseExecutionNode.displayName = "BaseExecutionNode";
