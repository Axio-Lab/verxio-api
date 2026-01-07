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
import { WhatsAppTriggerNode } from "@/app/app-components/features/executions/triggers/whatsapp-trigger/node";
import { TelegramTriggerNode } from "@/app/app-components/features/executions/triggers/telegram-trigger/node";
import { OpenAINode } from "@/app/app-components/features/executions/actions/open-ai/node";
import { AnthropicNode } from "@/app/app-components/features/executions/actions/anthropic/node";
import { GeminiNode } from "@/app/app-components/features/executions/actions/gemini/node";
import { WhatsAppNode } from "@/app/app-components/features/executions/actions/whatsapp/node";
import { TelegramNode } from "@/app/app-components/features/executions/actions/telegram/node";
import { SlackNode } from "@/app/app-components/features/executions/actions/slack/node";
import { DiscordNode } from "@/app/app-components/features/executions/actions/discord/node";
import { TimedTriggerNode } from "@/app/app-components/features/executions/triggers/timed-trigger/node";
import { DeciderNode } from "@/app/app-components/features/executions/actions/decider/node";
import { GoogleDriveNode } from "@/app/app-components/features/executions/actions/google-drive/node";
import { GoogleCalendarNode } from "@/app/app-components/features/executions/actions/google-calendar/node";
import { GoogleSheetsNode } from "@/app/app-components/features/executions/actions/google-sheets/node";
import { GoogleDocsNode } from "@/app/app-components/features/executions/actions/google-docs/node";
import { GoogleMeetNode } from "@/app/app-components/features/executions/actions/google-meet/node";

export const NodeComponents = {
  [NodeType.INITIAL]: InitialNode,
  [NodeType.MANUAL_TRIGGER]: ManualTriggerNode,
  [NodeType.TIMED_TRIGGER]: TimedTriggerNode,
  [NodeType.HTTP_REQUEST]: HttpRequestNode,
  [NodeType.WEBHOOK]: WebhookNode,
  [NodeType.GOOGLE_FORM_TRIGGER]: GoogleFormTriggerNode,
  [NodeType.STRIPE_TRIGGER]: StripeTriggerNode,
  [NodeType.WHATSAPP_TRIGGER]: WhatsAppTriggerNode,
  [NodeType.TELEGRAM_TRIGGER]: TelegramTriggerNode,
  [NodeType.OPENAI]: OpenAINode,
  [NodeType.ANTHROPIC]: AnthropicNode,
  [NodeType.GEMINI]: GeminiNode,
  [NodeType.WHATSAPP]: WhatsAppNode,
  [NodeType.TELEGRAM]: TelegramNode,
  [NodeType.SLACK]: SlackNode,
  [NodeType.DISCORD]: DiscordNode,
  [NodeType.DECIDER]: DeciderNode,
  [NodeType.GOOGLE_DRIVE]: GoogleDriveNode,
  [NodeType.GOOGLE_CALENDAR]: GoogleCalendarNode,
  [NodeType.GOOGLE_SHEETS]: GoogleSheetsNode,
  [NodeType.GOOGLE_DOCS]: GoogleDocsNode,
  [NodeType.GOOGLE_MEET]: GoogleMeetNode,
} as const satisfies NodeTypes;

export type RegisteredNodeType = keyof typeof NodeComponents;

export const AddNodeButton = memo(() => {
  const [selectorOpen, setSelectorOpen] = useState(false);

  return (
    <NodeSelector open={selectorOpen} onOpenChange={setSelectorOpen}>
      <Button variant="outline" size="icon">
        <PlusIcon className="size-4" />
      </Button>
    </NodeSelector>
  );
});

AddNodeButton.displayName = "AddNodeButton";
