"use client";

import type { NodeProps } from "@xyflow/react";
import { ClockIcon } from "lucide-react";
import { BaseTriggerNode } from "../manual-trigger/base-trigger-node";
import { memo, useState } from "react";
import { TimedTriggerDialog, TimedTriggerFormValues } from "./dialog";
import { useNodeStatus } from "@/app/app-components/features/executions/hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";

export const TimedTriggerNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: TimedTriggerFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return {
            ...node,
            data: {
              ...node.data,
              scheduleType: values.scheduleType,
              intervalHours: values.intervalHours,
              intervalMinutes: values.intervalMinutes,
              cronExpression: values.cronExpression,
              timezone: values.timezone,
              enabled: values.enabled,
            },
          };
        }
        return node;
      })
    );
  };

  const nodeData = props.data as any;

  return (
    <>
      <TimedTriggerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseTriggerNode
        {...props}
        icon={ClockIcon}
        name="Timed Trigger"
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

TimedTriggerNode.displayName = "TimedTriggerNode";
