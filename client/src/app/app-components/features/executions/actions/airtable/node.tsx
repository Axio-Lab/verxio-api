"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { AirtableDialog, AirtableFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";

export const AirtableNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });
  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: AirtableFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...values,
            },
          };
        }
        return node;
      })
    );
  };

  const nodeData = props.data as any;

  // Generate description based on configuration
  const getDescription = () => {
    if (!nodeData?.credentialId) {
      return "Configure to interact with Airtable bases and records";
    }
    if (!nodeData?.action) {
      return "Select an action to perform";
    }
    const actionLabels: Record<string, string> = {
      listBases: "List all bases",
      listTables: "List tables in a base",
      listFields: "List fields in a table",
      getRecords: "Get records from a table",
      getRecord: "Get a single record",
      createRecord: "Create a new record",
      updateRecord: "Update a record",
      deleteRecord: "Delete a record",
    };
    return actionLabels[nodeData.action] || "Airtable operation";
  };

  return (
    <>
      <AirtableDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/airtable.svg"
        name="Airtable"
        description={getDescription()}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

AirtableNode.displayName = "AirtableNode";
