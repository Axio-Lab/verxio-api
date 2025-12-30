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

interface BaseTriggerNodeProps extends NodeProps {
    icon: LucideIcon | string;
    name: string;
    description?: string;
    children?: ReactNode;
    onSettings?: () => void;
    onDoubleClick?: () => void;
}

export const BaseTriggerNode = memo(
    ({
        icon: Icon,
        name,
        description,
        children,
        selected,
        // status?: NodeStatus,
        onSettings,
        onDoubleClick,
    }: BaseTriggerNodeProps) => {

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
                className="rounded-l-2xl relative group"
                >
                    <BaseNodeContent>
                        {typeof Icon === 'string' ? (
                            <Image src={Icon} alt={name} width={16} height={16} />
                        ) : (
                            <Icon className={cn("size-4", "!text-blue-600 dark:!text-blue-400")} />
                        )}
                        {children}
                        <BaseHandle
                            id="source-1"
                            type="source"
                            position={Position.Right}
                            className="!border-blue-500 !bg-blue-500" />
                    </BaseNodeContent>
                </BaseNode>
            </WorkflowNode>
        )
    }
)

BaseTriggerNode.displayName = "BaseTriggerNode";