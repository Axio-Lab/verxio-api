import { NodeTypes } from "@xyflow/react";
import { useState } from "react";
import { InitialNode } from "@/app/app-components/features/editor/initial-node";
import { ManualTriggerNode } from "@/app/app-components/features/executions/triggers/manual-trigger/node";
import { HttpRequestNode } from "@/app/app-components/features/executions/actions/https-request/node";
import { WebhookNode } from "@/app/app-components/features/executions/webhook/node";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { memo } from "react";
import { NodeType } from "./node-types";
import { NodeSelector } from "./node-selector";
import { GoogleFormTriggerNode } from "@/app/app-components/features/executions/triggers/google-form-trigger/node";
import { StripeTriggerNode } from "@/app/app-components/features/executions/triggers/stripe-trigger/node";
import { OpenAINode } from "@/app/app-components/features/executions/actions/open-ai/node";
import { AnthropicNode } from "@/app/app-components/features/executions/actions/anthropic/node";
import { GeminiNode } from "@/app/app-components/features/executions/actions/gemini/node";


export const NodeComponents = {
  [NodeType.INITIAL]: InitialNode,
  [NodeType.MANUAL_TRIGGER]: ManualTriggerNode,
  [NodeType.HTTP_REQUEST]: HttpRequestNode,
  [NodeType.WEBHOOK]: WebhookNode,
  [NodeType.GOOGLE_FORM_TRIGGER]: GoogleFormTriggerNode,
  [NodeType.STRIPE_TRIGGER]: StripeTriggerNode,
  [NodeType.OPENAI]: OpenAINode,
  [NodeType.ANTHROPIC]: AnthropicNode,
  [NodeType.GEMINI]: GeminiNode,
} as const satisfies NodeTypes;

export type RegisteredNodeType = keyof typeof NodeComponents;

export const AddNodeButton = memo(() => {
  const [selectorOpen, setSelectorOpen] = useState(false);

  return (
    <NodeSelector open={selectorOpen} onOpenChange={setSelectorOpen}>
      <Button 
        variant="outline" 
        size="icon"
      >
        <PlusIcon className="size-4" />
      </Button>
    </NodeSelector>
  );
});

AddNodeButton.displayName = "AddNodeButton";