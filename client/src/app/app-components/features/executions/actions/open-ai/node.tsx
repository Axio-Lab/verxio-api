"use client";

import type { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "./base-execution-node";
import { OpenAIFormValues, OpenAIDialog } from "./dialog";
import { useReactFlow } from "@xyflow/react";
import { useNodeStatus } from "@/app/app-components/features/executions/hooks/use-node-status";
import { OPENAI_MODEL_VALUES } from "./dialog";

type OpenAINodeData = {
    variables?: string;
    model?: string;
    systemPrompt?: string;
    userPrompt?: string;
};

export const OpenAINode = memo((props: NodeProps) => {
    const { data } = props;
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();
    const nodeStatus = useNodeStatus({
        nodeId: props.id,
    });
    const nodeData = (data || {}) as OpenAINodeData;
    
    const description = nodeData?.userPrompt
        ? `${nodeData.model || OPENAI_MODEL_VALUES[0]}: ${nodeData.userPrompt.substring(0, 50)}...`
        : "Not configured";

    const handleOpenSettings = () => {
        setDialogOpen(true);
    };

    const handleSubmit = (values: OpenAIFormValues) => {
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
            <OpenAIDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
            />
            <BaseExecutionNode
                {...props}
                icon="/logo/openai.svg"
                name="OpenAI"
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

OpenAINode.displayName = "OpenAINode";
