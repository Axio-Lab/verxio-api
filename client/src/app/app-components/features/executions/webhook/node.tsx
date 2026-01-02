"use client";

import type { NodeProps } from "@xyflow/react";
import { WebhookIcon } from "lucide-react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { WebhookDialog } from "./dialog";

type WebhookNodeData = {
    endpoint?: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    secret?: string;
    label?: string;
    [key: string]: unknown;
}

export const WebhookNode = memo((props: NodeProps) => {
    const { data } = props;
    const [dialogOpen, setDialogOpen] = useState(false);
    const nodeData = (data || {}) as WebhookNodeData;
    const nodeStatus = "initial";
    const description = nodeData?.endpoint 
        ? `${nodeData.method || "POST"} ${nodeData.endpoint}`
        : "Not configured";
    
    const handleOpenSettings = () => {
        setDialogOpen(true);
    }

    return (
        <>
            <WebhookDialog open={dialogOpen} onOpenChange={setDialogOpen} />
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

