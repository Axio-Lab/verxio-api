"use client";

import { NodeToolbar, Position } from "@xyflow/react";
import { SettingsIcon, TrashIcon, Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface WorkflowNodeProps {
  children: ReactNode;
  showToolbar?: boolean;
  onDelete?: () => void;
  onSettings?: () => void;
  name?: string;
  description?: string;
  isDeleting?: boolean;
}

export const WorkflowNode = ({ 
    children, 
    showToolbar, 
    onDelete, 
    onSettings, 
    name, 
    description,
    isDeleting = false
}: WorkflowNodeProps) => {
    return (
        <>
        {showToolbar && (
            <NodeToolbar>
                <Button size="sm" variant="ghost" onClick={onSettings} disabled={isDeleting}>
                    <SettingsIcon className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete} disabled={isDeleting}>
                    {isDeleting ? (
                        <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                        <TrashIcon className="size-4" />
                    )}
                </Button>
            </NodeToolbar>
        )}
        {children}
        {
            name && (
                <NodeToolbar
                    position={Position.Bottom}
                    isVisible
                    className="max-w-[200px] text-center"
                >
                    <p className="text-xs font-medium">
                        {name}
                    </p>
                    {description && (
                        <p className="text-xs text-muted-foreground truncate">
                            {description}
                        </p>
                    )}
                </NodeToolbar>
            )
        }
        </>
    )
  
};