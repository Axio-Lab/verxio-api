"use client";

import type { NodeProps } from "@xyflow/react";
import { MousePointerIcon } from "lucide-react";
import { BaseTriggerNode } from "./base-trigger-node";
import { memo, useState } from "react";
import { ManualTriggerDialog } from "./dialog";


export const ManualTriggerNode = memo((props: NodeProps) => {

    const [ dialogOpen, setDialogOpen ] = useState(false);
    const nodeStatus = "initial";
    const handleOpenSettings = () => {
        setDialogOpen(true);
    }

    return (
        <>
          <ManualTriggerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
            <BaseTriggerNode
                {...props}
                icon={MousePointerIcon}
                name="Manual Trigger"
                status={nodeStatus}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );
  
});

ManualTriggerNode.displayName = "ManualTriggerNode";

