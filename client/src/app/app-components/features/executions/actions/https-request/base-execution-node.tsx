"use client";

import type { NodeProps } from "@xyflow/react";
import { Position } from "@xyflow/react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { memo, type ReactNode } from "react";
import { BaseNode, BaseNodeContent } from "@/components/base-node";
import { BaseHandle } from "@/components/base-handle";
import { WorkflowNode } from "@/app/app-components/features/workflow/workflow-node";
import { cn } from "@/lib/utils";
import { NodeStatusIndicator, type NodeStatus } from "@/components/node-status-indicator";

interface BaseExecutionNodeProps extends NodeProps {
    icon: LucideIcon | string;
    name: string;
    description?: string;
    children?: ReactNode;
    onSettings?: () => void;
    onDoubleClick?: () => void;
    iconColor?: string;
    handleColor?: string;
    status?: NodeStatus;
}

export const BaseExecutionNode = memo(
    ({
        icon: Icon,
        name,
        description,
        children,
        selected,
        data,
        status = "initial",
        onSettings,
        onDoubleClick,
        iconColor = "!text-green-600 dark:!text-green-400",
        handleColor = "!border-green-500 !bg-green-500",
    }: BaseExecutionNodeProps) => {

        const isDeleting = data?.isDeleting === true;

        const handleDelete = () => {
            if (data?.onDelete && typeof data.onDelete === 'function') {
                // Call delete handler immediately
                data.onDelete();
            }
        }

        // Always show toolbar if deleting, or if selected
        const shouldShowToolbar = selected || isDeleting;

        return (
            <WorkflowNode
                name={name}
                description={description}
                showToolbar={shouldShowToolbar}
                onSettings={onSettings}
                onDelete={handleDelete}
                isDeleting={isDeleting}
            >
                <NodeStatusIndicator 
                    status={status}
                    variant="border" 
                    className="rounded-md"
                >
                    <BaseNode onDoubleClick={onDoubleClick} status={status}>
                        <BaseNodeContent>
                            {typeof Icon === 'string' ? (
                                <Image src={Icon} alt={name} width={16} height={16} />
                            ) : (
                                <Icon className={cn("size-4", iconColor)} />
                            )}
                            {children}
                            <BaseHandle
                                id="target-1"
                                type="target"
                                position={Position.Left}
                                className={handleColor} />

                            <BaseHandle
                                id="source-1"
                                type="source"
                                position={Position.Right}
                                className={handleColor} />
                        </BaseNodeContent>
                    </BaseNode>
                </NodeStatusIndicator>
            </WorkflowNode>
        )
    }
)

BaseExecutionNode.displayName = "BaseExecutionNode";