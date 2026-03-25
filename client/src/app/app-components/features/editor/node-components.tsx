import { NodeTypes } from "@xyflow/react";
import { useState } from "react";
import { InitialNode } from "@/app/app-components/features/editor/initial-node";
import { ManualTriggerNode } from "@/app/app-components/features/executions/triggers/manual-trigger/node";
import { ManualInputNode } from "@/app/app-components/features/executions/triggers/manual-input/node";
import { HttpRequestNode } from "@/app/app-components/features/executions/actions/https-request/node";
import { WebhookNode } from "@/app/app-components/features/executions/webhook/node";
import { ComposioTriggerNode } from "@/app/app-components/features/executions/triggers/composio-trigger/node";
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
import { CodeBlockNode } from "@/app/app-components/features/executions/actions/code-block/node";
import { PlanNode } from "@/app/app-components/features/executions/actions/plan/node";
import { DesignNode } from "@/app/app-components/features/executions/actions/design/node";
import { DesignProNode } from "@/app/app-components/features/executions/actions/design-pro/node";
import { LoyaltyDealNode } from "@/app/app-components/features/executions/actions/loyalty-deal/node";
import { LoyaltyProgramNode } from "@/app/app-components/features/executions/actions/loyalty-program/node";
import { RemotionNode } from "@/app/app-components/features/executions/actions/remotion/node";
import { VeoNode } from "@/app/app-components/features/executions/actions/veo/node";
import { KlingText2VideoNode } from "@/app/app-components/features/executions/actions/kling-text2video/node";
import { KlingImage2VideoNode } from "@/app/app-components/features/executions/actions/kling-image2video/node";
import { KlingImageNode } from "@/app/app-components/features/executions/actions/kling-image/node";
import { KlingTtsNode } from "@/app/app-components/features/executions/actions/kling-tts/node";
import { KlingOmniVideoNode } from "@/app/app-components/features/executions/actions/kling-omni-video/node";
import { KlingOmniImageNode } from "@/app/app-components/features/executions/actions/kling-omni-image/node";
import { KlingVideoExtendNode } from "@/app/app-components/features/executions/actions/kling-video-extend/node";
import { KlingMultiImage2VideoNode } from "@/app/app-components/features/executions/actions/kling-multi-image2video/node";
import { KlingMotionControlNode } from "@/app/app-components/features/executions/actions/kling-motion-control/node";
import { KlingMultiImage2ImageNode } from "@/app/app-components/features/executions/actions/kling-multi-image2image/node";
import { OutputNode } from "@/app/app-components/features/executions/actions/output/node";
import { MarkdownNode } from "@/app/app-components/features/executions/actions/markdown/node";
import { SeedanceNode } from "@/app/app-components/features/executions/actions/seedance/node";
import { SeedreamNode } from "@/app/app-components/features/executions/actions/seedream/node";
import { ComposioActionNode } from "@/app/app-components/features/executions/actions/composio-action/node";
import { TinyfishNode } from "@/app/app-components/features/executions/actions/tinyfish/node";
import { ValyuSearchNode } from "@/app/app-components/features/executions/actions/valyu-search/node";
import { ValyuContentsNode } from "@/app/app-components/features/executions/actions/valyu-contents/node";
import { ValyuAnswerNode } from "@/app/app-components/features/executions/actions/valyu-answer/node";
import { ValyuDeepResearchNode } from "@/app/app-components/features/executions/actions/valyu-deep-research/node";
import { AgentTeamNode } from "@/app/app-components/features/executions/actions/agent-team/node";
import { AgentExecNode } from "@/app/app-components/features/executions/actions/agent-exec/node";

export const NodeComponents = {
  [NodeType.INITIAL]: InitialNode,
  [NodeType.MANUAL_TRIGGER]: ManualTriggerNode,
  [NodeType.MANUAL_INPUT]: ManualInputNode,
  [NodeType.TIMED_TRIGGER]: TimedTriggerNode,
  [NodeType.HTTP_REQUEST]: HttpRequestNode,
  [NodeType.WEBHOOK]: WebhookNode,
  [NodeType.COMPOSIO_TRIGGER]: ComposioTriggerNode,
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
  [NodeType.CODE_BLOCK]: CodeBlockNode,
  [NodeType.PLAN]: PlanNode,
  [NodeType.DESIGN]: DesignNode,
  [NodeType.DESIGN_PRO]: DesignProNode,
  [NodeType.LOYALTY_DEAL]: LoyaltyDealNode,
  [NodeType.LOYALTY_PROGRAM]: LoyaltyProgramNode,
  [NodeType.REMOTION]: RemotionNode,
  [NodeType.VEO]: VeoNode,
  [NodeType.KLING_TEXT2VIDEO]: KlingText2VideoNode,
  [NodeType.KLING_IMAGE2VIDEO]: KlingImage2VideoNode,
  [NodeType.KLING_IMAGE]: KlingImageNode,
  [NodeType.KLING_TTS]: KlingTtsNode,
  [NodeType.KLING_OMNI_VIDEO]: KlingOmniVideoNode,
  [NodeType.KLING_OMNI_IMAGE]: KlingOmniImageNode,
  [NodeType.KLING_VIDEO_EXTEND]: KlingVideoExtendNode,
  [NodeType.KLING_MULTI_IMAGE2VIDEO]: KlingMultiImage2VideoNode,
  [NodeType.KLING_MOTION_CONTROL]: KlingMotionControlNode,
  [NodeType.KLING_MULTI_IMAGE2IMAGE]: KlingMultiImage2ImageNode,
  [NodeType.OUTPUT]: OutputNode,
  [NodeType.MARKDOWN]: MarkdownNode,
  [NodeType.SEEDANCE]: SeedanceNode,
  [NodeType.SEEDREAM]: SeedreamNode,
  [NodeType.COMPOSIO_ACTION]: ComposioActionNode,
  [NodeType.TINYFISH]: TinyfishNode,
  [NodeType.VALYU_SEARCH]: ValyuSearchNode,
  [NodeType.VALYU_CONTENTS]: ValyuContentsNode,
  [NodeType.VALYU_ANSWER]: ValyuAnswerNode,
  [NodeType.VALYU_DEEP_RESEARCH]: ValyuDeepResearchNode,
  [NodeType.AGENT_TEAM]: AgentTeamNode,
  [NodeType.AGENT_EXEC]: AgentExecNode,
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
