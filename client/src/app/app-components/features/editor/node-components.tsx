import { NodeTypes } from "@xyflow/react";
import { useState } from "react";
import { InitialNode } from "@/app/app-components/features/editor/initial-node";
import { ManualTriggerNode } from "@/app/app-components/features/executions/triggers/manual-trigger/node";
import { ManualInputNode } from "@/app/app-components/features/executions/triggers/manual-input/node";
import { HttpRequestNode } from "@/app/app-components/features/executions/actions/https-request/node";
import { WebhookNode } from "@/app/app-components/features/executions/webhook/node";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { memo } from "react";
import { NodeType } from "./node-types";
import { NodeSelector } from "./node-selector";
import { GoogleFormTriggerNode } from "@/app/app-components/features/executions/triggers/google-form-trigger/node";
import { AirtableTriggerNode } from "@/app/app-components/features/executions/triggers/airtable-trigger/node";
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
import { GoogleSlidesNode } from "@/app/app-components/features/executions/actions/google-slides/node";
import { GmailNode } from "@/app/app-components/features/executions/actions/gmail/node";
import { AirtableNode } from "@/app/app-components/features/executions/actions/airtable/node";
import { ElevenLabsNode } from "@/app/app-components/features/executions/actions/elevenlabs/node";
import { FirecrawlNode } from "@/app/app-components/features/executions/actions/firecrawl/node";
import { ApifyNode } from "@/app/app-components/features/executions/actions/apify/node";
import { CodeBlockNode } from "@/app/app-components/features/executions/actions/code-block/node";
import { PlanNode } from "@/app/app-components/features/executions/actions/plan/node";
import { DesignNode } from "@/app/app-components/features/executions/actions/design/node";
import { DesignProNode } from "@/app/app-components/features/executions/actions/design-pro/node";
import { LoyaltyDealNode } from "@/app/app-components/features/executions/actions/loyalty-deal/node";
import { LoyaltyProgramNode } from "@/app/app-components/features/executions/actions/loyalty-program/node";
import { RemotionNode } from "@/app/app-components/features/executions/actions/remotion/node";
import { VeoNode } from "@/app/app-components/features/executions/actions/veo/node";
import { OutputNode } from "@/app/app-components/features/executions/actions/output/node";

export const NodeComponents = {
  [NodeType.INITIAL]: InitialNode,
  [NodeType.MANUAL_TRIGGER]: ManualTriggerNode,
  [NodeType.MANUAL_INPUT]: ManualInputNode,
  [NodeType.TIMED_TRIGGER]: TimedTriggerNode,
  [NodeType.HTTP_REQUEST]: HttpRequestNode,
  [NodeType.WEBHOOK]: WebhookNode,
  [NodeType.GOOGLE_FORM_TRIGGER]: GoogleFormTriggerNode,
  [NodeType.AIRTABLE_TRIGGER]: AirtableTriggerNode,
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
  [NodeType.GOOGLE_SLIDES]: GoogleSlidesNode,
  [NodeType.GMAIL]: GmailNode,
  [NodeType.AIRTABLE]: AirtableNode,
  [NodeType.ELEVENLABS]: ElevenLabsNode,
  [NodeType.FIRECRAWL]: FirecrawlNode,
  [NodeType.APIFY]: ApifyNode,
  [NodeType.CODE_BLOCK]: CodeBlockNode,
  [NodeType.PLAN]: PlanNode,
  [NodeType.DESIGN]: DesignNode,
  [NodeType.DESIGN_PRO]: DesignProNode,
  [NodeType.LOYALTY_DEAL]: LoyaltyDealNode,
  [NodeType.LOYALTY_PROGRAM]: LoyaltyProgramNode,
  [NodeType.REMOTION]: RemotionNode,
  [NodeType.VEO]: VeoNode,
  [NodeType.OUTPUT]: OutputNode,
} as const satisfies NodeTypes;

export type RegisteredNodeType = keyof typeof NodeComponents;

interface AddNodeButtonProps {
  workflowId?: string;
}

export const AddNodeButton = memo(({ workflowId }: AddNodeButtonProps) => {
  const [selectorOpen, setSelectorOpen] = useState(false);

  return (
    <NodeSelector open={selectorOpen} onOpenChange={setSelectorOpen} workflowId={workflowId}>
      <Button data-tour-target="add-node-button" variant="outline" size="icon">
        <PlusIcon className="size-4" />
      </Button>
    </NodeSelector>
  );
});

AddNodeButton.displayName = "AddNodeButton";
