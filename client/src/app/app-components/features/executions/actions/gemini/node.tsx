"use client";

import type { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "./base-execution-node";
import { GeminiFormValues, GeminiDialog } from "./dialog";
import { useReactFlow } from "@xyflow/react";
import { useNodeStatus } from "@/app/app-components/features/executions/hooks/use-node-status";
import { GEMINI_MODEL_VALUES } from "./dialog";

type GeminiNodeData = {
    variableName?: string;
    model?: string;
    systemPrompt?: string;
    userPrompt?: string;
};

export const GeminiNode = memo((props: NodeProps) => {
    const { data } = props;
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();
    const nodeStatus = useNodeStatus({
        nodeId: props.id,
    });
    const nodeData = (data || {}) as GeminiNodeData;
    
    const description = nodeData?.userPrompt
        ? `${nodeData.model || GEMINI_MODEL_VALUES[0]}: ${nodeData.userPrompt.substring(0, 50)}...`
        : "Not configured";

    const handleOpenSettings = () => {
        setDialogOpen(true);
    };

    const handleSubmit = (values: GeminiFormValues) => {
        setNodes((nodes) => nodes.map((node) => {
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
        }));
    };

    return (
        <>
            <GeminiDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
            />
            <BaseExecutionNode
                {...props}
                icon="/logo/gemini.svg"
                name="Gemini"
                description={description}
                status={nodeStatus}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
                iconColor="!text-green-600 dark:!text-green-400"
                handleColor="!border-green-500 !bg-green-500"
            />
        </>
    );
});

GeminiNode.displayName = "GeminiNode";
