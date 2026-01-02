"use client";

import type { NodeProps } from "@xyflow/react";
import { WebhookIcon } from "lucide-react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { WebhookDialog, WebhookFormValues } from "./dialog";
import { useReactFlow } from "@xyflow/react";
import { useNodeStatus } from "../hooks/use-node-status";

type WebhookNodeData = {
    variables?: string;
    secret?: string;
    label?: string;
    [key: string]: unknown;
}

export const WebhookNode = memo((props: NodeProps) => {
    const { data } = props;
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();
    const nodeStatus = useNodeStatus({
        nodeId: props.id,
    });
    const nodeData = (data || {}) as WebhookNodeData;
    
    // Webhook description shows if it's configured (has secret) or not
    const description = nodeData?.secret
        ? "Webhook configured"
        : "Not configured";
    
    const handleOpenSettings = () => {
        setDialogOpen(true);
    }

    const handleSubmit = (values: WebhookFormValues) => {
        setNodes((nodes) => nodes.map((node) => {
            if (node.id === props.id) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        ...values,
                    }
                };
            }
            return node;
        }));
        // Note: Change detection will pick up this update automatically via the interval check
        // The save button will become active once changes are detected
    };

    return (
        <>
            <WebhookDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
                nodeId={props.id}
            />
            <BaseExecutionNode
                {...props}
                icon={WebhookIcon}
                name="Webhook"
                description={description}
                status={nodeStatus}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
                iconColor="!text-purple-600 dark:!text-purple-400"
                handleColor="!border-purple-500 !bg-purple-500"
            />
        </>
    );
});

WebhookNode.displayName = "WebhookNode";

