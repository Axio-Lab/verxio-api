"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseTriggerNode } from "./base-trigger-node";
import { memo, useState } from "react";
import { GoogleFormTriggerDialog } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";


export const GoogleFormTriggerNode = memo((props: NodeProps) => {

    const [ dialogOpen, setDialogOpen ] = useState(false);
    const nodeStatus = useNodeStatus({
        nodeId: props.id,
    });
    const handleOpenSettings = () => {
        setDialogOpen(true);
    }

    return (
        <>
          <GoogleFormTriggerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
            <BaseTriggerNode
                {...props}
                icon="/logo/googleform.svg"
                name="Google Form"
                description="When a Form is submitted."
                status={nodeStatus}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );
  
});

GoogleFormTriggerNode.displayName = "GoogleFormTriggerNode";

