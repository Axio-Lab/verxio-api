"use client";

import type { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "./base-execution-node";
import { AnthropicFormValues, AnthropicDialog } from "./dialog";
import { useReactFlow } from "@xyflow/react";
import { useNodeStatus } from "@/app/app-components/features/executions/hooks/use-node-status";
import { ANTHROPIC_MODEL_VALUES } from "./dialog";

type AnthropicNodeData = {
    variables?: string;
    model?: string;
    systemPrompt?: string;
    userPrompt?: string;
    label?: string;
    [key: string]: unknown;
};

export const AnthropicNode = memo((props: NodeProps) => {
    const { data } = props;
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();
    const nodeStatus = useNodeStatus({
        nodeId: props.id,
    });
    const nodeData = (data || {}) as AnthropicNodeData;
    
    const description = nodeData?.userPrompt
        ? `${nodeData.model || ANTHROPIC_MODEL_VALUES[0]}: ${nodeData.userPrompt.substring(0, 50)}...`
        : "Not configured";

    const handleOpenSettings = () => {
        setDialogOpen(true);
    };

    const handleSubmit = (values: AnthropicFormValues) => {
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
            <AnthropicDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
            />
            <BaseExecutionNode
                {...props}
                icon="/logo/anthropic.svg"
                name="Anthropic"
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

AnthropicNode.displayName = "AnthropicNode";
