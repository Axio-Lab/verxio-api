"use client";

import type { NodeProps } from "@xyflow/react";
import { GlobeIcon } from "lucide-react";
import { memo } from "react";
import { BaseExecutionNode } from "./base-execution-node";

type HTTPSRequestNodeData = {
    endpoint?: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";
    body?: string;
    label?: string;
    [key: string]: unknown;
}

export const HttpRequestNode = memo((props: NodeProps) => {
    const { data } = props;
    const nodeData = (data || {}) as HTTPSRequestNodeData;
    const description = nodeData?.endpoint 
        ? `${nodeData.method || "GET"} ${nodeData.endpoint}`
        : "Not configured";

    return (
        <BaseExecutionNode
            {...props}
            icon={GlobeIcon}
            name={"HTTP Request"}
            description={description}
            onSettings={() => {}}
            onDoubleClick={() => {}}
            iconColor="!text-green-600 dark:!text-green-400"
            handleColor="!border-green-500 !bg-green-500"
        />
    );
});

HttpRequestNode.displayName = "HttpRequestNode";