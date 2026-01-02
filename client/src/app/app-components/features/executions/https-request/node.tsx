"use client";

import type { NodeProps, Node } from "@xyflow/react";
import { GlobeIcon } from "lucide-react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "./base-execution-node";
import { HttpRequestFormValues, HttpRequestDialog } from "./dialog";
import { useReactFlow } from "@xyflow/react";
import { useNodeStatus } from "../hooks/use-node-status";

type HTTPSRequestNodeData = {
    variables?: string;
    endpoint?: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";
    body?: string;
    label?: string;
}

type HTTPSRequestNodeType = Node<HTTPSRequestNodeData>;

export const HttpRequestNode = memo((props: NodeProps<HTTPSRequestNodeType>) => {
    const { data } = props;
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();
    const nodeStatus = useNodeStatus({
        nodeId: props.id,
    });
    const nodeData = data;
    const description = nodeData?.endpoint
        ? `${nodeData.method || "GET"}: ${nodeData.endpoint}`
        : "Not configured";

    const handleOpenSettings = () => {
        setDialogOpen(true);
    }
    const handleSubmit = (values: HttpRequestFormValues) => {
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
            <HttpRequestDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
            />
            <BaseExecutionNode
                {...props}
                icon={GlobeIcon}
                name={"HTTP Request"}
                description={description}
                onSettings={handleOpenSettings}
                status={nodeStatus}
                onDoubleClick={handleOpenSettings}
                iconColor="!text-green-600 dark:!text-green-400"
                handleColor="!border-green-500 !bg-green-500"
            />
        </>
    );
});

HttpRequestNode.displayName = "HttpRequestNode";