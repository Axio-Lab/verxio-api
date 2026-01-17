"use client";

import type { NodeProps } from "@xyflow/react";
import { Position } from "@xyflow/react";
import { GitBranchIcon } from "lucide-react";
import { memo, useState } from "react";
import { DeciderDialog, DeciderFormValues } from "./dialog";
import { useNodeStatus } from "@/app/app-components/features/executions/hooks/use-node-status";
import { BaseNode, BaseNodeContent } from "@/components/base-node";
import { BaseHandle } from "@/components/base-handle";
import { WorkflowNode } from "@/app/app-components/features/workflow/workflow-node";
import { cn } from "@/lib/utils";
import { NodeStatusIndicator } from "@/components/node-status-indicator";
import { NodeOutputDialog } from "../../node-output-dialog";
import { useReactFlow } from "@xyflow/react";

export const DeciderNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: DeciderFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return {
            ...node,
            data: {
              ...node.data,
              condition: values.condition,
              variablesName: values.variablesName,
            },
          };
        }
        return node;
      })
    );
  };

  const isDeleting = props.data?.isDeleting === true;
  const [outputDialogOpen, setOutputDialogOpen] = useState(false);

  // Show info icon if node has executed (success or error status)
  const showInfoIcon = nodeStatus === "success" || nodeStatus === "error";

  const handleDelete = () => {
    if (props.data?.onDelete && typeof props.data.onDelete === "function") {
      props.data.onDelete();
    }
  };

  // Always show toolbar if deleting, or if selected
  const shouldShowToolbar = props.selected || isDeleting;

  const nodeData = props.data as any;

  return (
    <>
      <DeciderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <NodeOutputDialog
        open={outputDialogOpen}
        onOpenChange={setOutputDialogOpen}
        output={output}
      />
      <WorkflowNode
        name="Decider"
        description="Evaluate a condition"
        showToolbar={shouldShowToolbar}
        onSettings={handleOpenSettings}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        showInfoIcon={showInfoIcon}
        onInfoClick={() => setOutputDialogOpen(true)}
      >
        <NodeStatusIndicator status={nodeStatus} variant="border" className="rounded-md">
          <BaseNode onDoubleClick={handleOpenSettings} status={nodeStatus}>
            <BaseNodeContent className="relative min-h-[60px]">
              <div className="flex items-center justify-center min-h-[40px]">
                <GitBranchIcon className={cn("size-4", "!text-purple-600 dark:!text-purple-400")} />
              </div>

              {/* Input handle (left side) */}
              <BaseHandle
                id="input"
                type="target"
                position={Position.Left}
                className="!border-purple-500 !bg-purple-500"
              />

              {/* Output handle - True (top right, green) */}
              <BaseHandle
                id="true"
                type="source"
                position={Position.Right}
                className="!border-green-500 !bg-green-500"
                style={{ top: "25%", right: "-6px" }}
              />

              {/* Output handle - False (bottom right, red) */}
              <BaseHandle
                id="false"
                type="source"
                position={Position.Right}
                className="!border-red-500 !bg-red-500"
                style={{ top: "75%", right: "-6px" }}
              />
            </BaseNodeContent>
          </BaseNode>
        </NodeStatusIndicator>
      </WorkflowNode>
    </>
  );
});

DeciderNode.displayName = "DeciderNode";
