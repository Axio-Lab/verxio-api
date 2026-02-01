"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { KlingText2VideoDialog, KlingText2VideoFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";
import { Video } from "lucide-react";

export const KlingText2VideoNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({ nodeId: props.id });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: KlingText2VideoFormValues) => {
    const cameraControlType = values.camera_control_type || undefined;
    const cameraControlConfig =
      cameraControlType === "simple"
        ? {
            horizontal: values.camera_control_horizontal ?? 0,
            vertical: values.camera_control_vertical ?? 0,
            pan: values.camera_control_pan ?? 0,
            tilt: values.camera_control_tilt ?? 0,
            roll: values.camera_control_roll ?? 0,
            zoom: values.camera_control_zoom ?? 0,
          }
        : undefined;
    const cameraControl =
      cameraControlType && cameraControlType !== "none"
        ? {
            type: cameraControlType,
            ...(cameraControlType === "simple" ? { config: cameraControlConfig } : {}),
          }
        : undefined;
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === props.id
          ? {
              ...node,
              data: {
                ...node.data,
                ...values,
                ...(cameraControl ? { camera_control: cameraControl } : {}),
              },
            }
          : node
      )
    );
  };

  const nodeData = props.data as Record<string, unknown>;
  const description =
    (nodeData?.prompt as string)?.length > 50
      ? `${(nodeData.prompt as string).slice(0, 50)}...`
      : (nodeData?.prompt as string) || "Configure Kling Text-to-Video";

  return (
    <>
      <KlingText2VideoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData as Partial<KlingText2VideoFormValues>}
      />
      <BaseExecutionNode
        {...props}
        icon={Video}
        name="Kling Text-to-Video"
        description={description}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
        iconColor="!text-amber-600 dark:!text-amber-400"
        handleColor="!border-amber-500 !bg-amber-500"
      />
    </>
  );
});

KlingText2VideoNode.displayName = "KlingText2VideoNode";
