"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseExecutionNode } from "../https-request/base-execution-node";
import { memo, useState } from "react";
import { ElevenLabsDialog, ElevenLabsFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { useReactFlow } from "@xyflow/react";

export const ElevenLabsNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { status: nodeStatus, output } = useNodeStatus({
    nodeId: props.id,
  });

  const handleOpenSettings = () => {
    setDialogOpen(true);
  };

  const handleSubmit = (values: ElevenLabsFormValues) => {
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
      return "Configure to generate speech, transcribe audio, or clone voices";
    }
    if (!nodeData?.action) {
      return "Select an action to perform";
    }
    const actionLabels: Record<string, string> = {
      textToSpeech: "Convert text to speech",
      speechToText: "Transcribe audio to text",
      cloneVoice: "Clone a voice from audio",
      listVoices: "List available voices",
      getVoice: "Get voice details",
    };
    return actionLabels[nodeData.action] || "ElevenLabs operation";
  };

  return (
    <>
      <ElevenLabsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        icon="/logo/elevenlabs.svg"
        name="ElevenLabs"
        description={getDescription()}
        status={nodeStatus}
        output={output}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

ElevenLabsNode.displayName = "ElevenLabsNode";
