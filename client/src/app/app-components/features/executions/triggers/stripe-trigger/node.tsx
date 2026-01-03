"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseTriggerNode } from "./base-trigger-node";
import { memo, useState } from "react";
import { StripeTriggerDialog } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";

type StripeTriggerNodeData = {
    secret?: string;
    [key: string]: unknown;
};

export const StripeTriggerNode = memo((props: NodeProps) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();
    const nodeStatus = useNodeStatus({
        nodeId: props.id,
    });
    const nodeData = (props.data || {}) as StripeTriggerNodeData;

    // Stripe description shows if it's configured (has secret) or not
    const description = nodeData?.secret
        ? "When Stripe event is captured"
        : "Not configured";

    const handleOpenSettings = () => {
        setDialogOpen(true);
    };

    const handleSubmit = (values: { secret?: string }) => {
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === props.id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            ...values,
                            // Set variables to "stripe" by default behind the scenes
                            variables: "stripe",
                        },
                    };
                }
                return node;
            })
        );
    };

    return (
        <>
            <StripeTriggerDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
                nodeId={props.id}
            />
            <BaseTriggerNode
                {...props}
                icon="/logo/stripe.svg"
                name="Stripe"
                description={description}
                status={nodeStatus}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );
});

StripeTriggerNode.displayName = "StripeTriggerNode";
