"use client";

import type { NodeProps } from "@xyflow/react";
import { WebhookIcon } from "lucide-react";
import { memo } from "react";
import { BaseExecutionNode } from "../https-request/base-execution-node";

type WebhookNodeData = {
    endpoint?: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    secret?: string;
    label?: string;
    [key: string]: unknown;
}

export const WebhookNode = memo((props: NodeProps) => {
    const { data } = props;
    const nodeData = (data || {}) as WebhookNodeData;
    const description = nodeData?.endpoint 
        ? `${nodeData.method || "POST"} ${nodeData.endpoint}`
        : "Not configured";

    return (
        <BaseExecutionNode
            {...props}
            icon={WebhookIcon}
            name="Webhook"
            description={description}
            onSettings={() => {}}
            onDoubleClick={() => {}}
            iconColor="!text-purple-600 dark:!text-purple-400"
            handleColor="!border-purple-500 !bg-purple-500"
        />
    );
});

WebhookNode.displayName = "WebhookNode";

