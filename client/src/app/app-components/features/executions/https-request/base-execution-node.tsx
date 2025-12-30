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

interface BaseExecutionNodeProps extends NodeProps {
    icon: LucideIcon | string;
    name: string;
    description?: string;
    children?: ReactNode;
    onSettings?: () => void;
    onDoubleClick?: () => void;
    iconColor?: string;
    handleColor?: string;
}

export const BaseExecutionNode = memo(
    ({
        icon: Icon,
        name,
        description,
        children,
        selected,
        // status?: NodeStatus,
        onSettings,
        onDoubleClick,
        iconColor = "!text-green-600 dark:!text-green-400",
        handleColor = "!border-green-500 !bg-green-500",
    }: BaseExecutionNodeProps) => {

        const handleDelete = () => {

        }

        return (
            <WorkflowNode
                name={name}
                description={description}
                showToolbar={selected}
                onSettings={onSettings}
                onDelete={handleDelete}
            >
                <BaseNode onClick={onDoubleClick}
                >
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
            </WorkflowNode>
        )
    }
)

BaseExecutionNode.displayName = "BaseExecutionNode";