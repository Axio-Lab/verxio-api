import { NodeExecutor } from "./types";
import { manualTriggerExecutor } from "./triggers/manual-trigger";
import { timedTriggerExecutor } from "./triggers/timed-trigger";
import { deciderExecutor } from "./triggers/decider";
import { httpTriggerExecutor } from "./triggers/http-trigger";
import { webhookTriggerExecutor } from "./triggers/webhook-trigger";
import { googleFormTriggerExecutor } from "./triggers/google-form-trigger";
import { airtableTriggerExecutor } from "./triggers/airtable-trigger";
import { stripeTriggerExecutor } from "./triggers/stripe-trigger";
import { openaiTriggerExecutor } from "./triggers/openai-trigger";
import { anthropicTriggerExecutor } from "./triggers/anthropic-trigger";
import { geminiTriggerExecutor } from "./triggers/gemini-trigger";
import { whatsappTriggerExecutor } from "./triggers/whatsapp-trigger";
import { whatsappExecutor } from "./triggers/whatsapp";
import { slackExecutor } from "./triggers/slack";
import { discordExecutor } from "./triggers/discord";
import { telegramTriggerExecutor } from "./triggers/telegram-trigger";
import { telegramExecutor } from "./triggers/telegram";
import { composioTriggerExecutor } from "./triggers/composio-trigger";
import { googleDriveExecutor } from "./actions/google-drive";
import { googleCalendarExecutor } from "./actions/google-calendar";
import { googleSheetsExecutor } from "./actions/google-sheets";
import { googleDocsExecutor } from "./actions/google-docs";
import { googleMeetExecutor } from "./actions/google-meet";
import { googleSlidesExecutor } from "./actions/google-slides";
import { gmailExecutor } from "./actions/gmail";
import { airtableExecutor } from "./actions/airtable";
import { codeBlockExecutor } from "./actions/code-block";
import { composioActionExecutor } from "./actions/composio-action";
import { tinyfishExecutor } from "./actions/tinyfish";
import { designExecutor } from "./actions/design";
import { designProExecutor } from "./actions/designPro";
import { loyaltyDealExecutor } from "./actions/loyalty-deal";
import { loyaltyProgramExecutor } from "./actions/loyalty-program";
import { remotionExecutor } from "./actions/remotion";
import { veoExecutor } from "./actions/veo";
import { klingText2VideoExecutor } from "./actions/kling-text2video";
import { klingImage2VideoExecutor } from "./actions/kling-image2video";
import { klingImageExecutor } from "./actions/kling-image";
import { klingTtsExecutor } from "./actions/kling-tts";
import { klingOmniVideoExecutor } from "./actions/kling-omni-video";
import { klingOmniImageExecutor } from "./actions/kling-omni-image";
import { klingVideoExtendExecutor } from "./actions/kling-video-extend";
import { klingMultiImage2VideoExecutor } from "./actions/kling-multi-image2video";
import { klingMotionControlExecutor } from "./actions/kling-motion-control";
import { klingMultiImage2ImageExecutor } from "./actions/kling-multi-image2image";
import { outputExecutor } from "./actions/output";
import { markdownExecutor } from "./actions/markdown";
import { seedanceExecutor } from "./actions/seedance";
import { seedreamExecutor } from "./actions/seedream";
import { manualInputExecutor } from "./triggers/manual-input";
import { NodeType, type NodeTypeValue } from "@/lib/node-types";

// Registry of executors for each node type
// Note: We cast specific executors to base NodeExecutor type to allow different generic types
export const executorRegistry: Record<NodeTypeValue, NodeExecutor> = {
  [NodeType.MANUAL_TRIGGER]: manualTriggerExecutor,
  [NodeType.MANUAL_INPUT]: manualInputExecutor,
  [NodeType.TIMED_TRIGGER]: timedTriggerExecutor,
  [NodeType.DECIDER]: deciderExecutor,
  [NodeType.GOOGLE_FORM_TRIGGER]: googleFormTriggerExecutor as NodeExecutor,
  [NodeType.AIRTABLE_TRIGGER]: airtableTriggerExecutor as NodeExecutor,
  [NodeType.STRIPE_TRIGGER]: stripeTriggerExecutor as NodeExecutor,
  [NodeType.WHATSAPP_TRIGGER]: whatsappTriggerExecutor as NodeExecutor,
  [NodeType.INITIAL]: async () => ({}),
  [NodeType.HTTP_REQUEST]: httpTriggerExecutor as NodeExecutor,
  [NodeType.WEBHOOK]: webhookTriggerExecutor as NodeExecutor,
  [NodeType.OPENAI]: openaiTriggerExecutor as NodeExecutor,
  [NodeType.ANTHROPIC]: anthropicTriggerExecutor as NodeExecutor,
  [NodeType.GEMINI]: geminiTriggerExecutor as NodeExecutor,
  [NodeType.WHATSAPP]: whatsappExecutor as NodeExecutor,
  [NodeType.SLACK]: slackExecutor as NodeExecutor,
  [NodeType.DISCORD]: discordExecutor as NodeExecutor,
  [NodeType.TELEGRAM_TRIGGER]: telegramTriggerExecutor as NodeExecutor,
  [NodeType.COMPOSIO_TRIGGER]: composioTriggerExecutor as NodeExecutor,
  [NodeType.TELEGRAM]: telegramExecutor as NodeExecutor,
  [NodeType.GOOGLE_DRIVE]: googleDriveExecutor as NodeExecutor,
  [NodeType.GOOGLE_CALENDAR]: googleCalendarExecutor as NodeExecutor,
  [NodeType.GOOGLE_SHEETS]: googleSheetsExecutor as NodeExecutor,
  [NodeType.GOOGLE_DOCS]: googleDocsExecutor as NodeExecutor,
  [NodeType.GOOGLE_MEET]: googleMeetExecutor as NodeExecutor,
  [NodeType.GOOGLE_SLIDES]: googleSlidesExecutor as NodeExecutor,
  [NodeType.GMAIL]: gmailExecutor as NodeExecutor,
  [NodeType.AIRTABLE]: airtableExecutor as NodeExecutor,
  [NodeType.CODE_BLOCK]: codeBlockExecutor as NodeExecutor,
  // PLAN is a special node type for planning - it doesn't execute in workflows
  [NodeType.PLAN]: (async () => ({ result: "PLAN nodes are not executed" })) as NodeExecutor,
  // DESIGN node for AI image generation using Gemini
  [NodeType.DESIGN]: designExecutor as NodeExecutor,
  // DESIGN_PRO node for advanced image editing with chat and reference images
  [NodeType.DESIGN_PRO]: designProExecutor as NodeExecutor,
  // LOYALTY_DEAL node for managing loyalty deals
  [NodeType.LOYALTY_DEAL]: loyaltyDealExecutor as NodeExecutor,
  // LOYALTY_PROGRAM node for managing loyalty programs
  [NodeType.LOYALTY_PROGRAM]: loyaltyProgramExecutor as NodeExecutor,
  // REMOTION node for AI-powered video generation
  [NodeType.REMOTION]: remotionExecutor as NodeExecutor,
  // VEO node for Veo 3.1 video generation
  [NodeType.VEO]: veoExecutor as NodeExecutor,
  [NodeType.KLING_TEXT2VIDEO]: klingText2VideoExecutor as NodeExecutor,
  [NodeType.KLING_IMAGE2VIDEO]: klingImage2VideoExecutor as NodeExecutor,
  [NodeType.KLING_IMAGE]: klingImageExecutor as NodeExecutor,
  [NodeType.KLING_TTS]: klingTtsExecutor as NodeExecutor,
  [NodeType.KLING_OMNI_VIDEO]: klingOmniVideoExecutor as NodeExecutor,
  [NodeType.KLING_OMNI_IMAGE]: klingOmniImageExecutor as NodeExecutor,
  [NodeType.KLING_VIDEO_EXTEND]: klingVideoExtendExecutor as NodeExecutor,
  [NodeType.KLING_MULTI_IMAGE2VIDEO]: klingMultiImage2VideoExecutor as NodeExecutor,
  [NodeType.KLING_MOTION_CONTROL]: klingMotionControlExecutor as NodeExecutor,
  [NodeType.KLING_MULTI_IMAGE2IMAGE]: klingMultiImage2ImageExecutor as NodeExecutor,
  // OUTPUT node for displaying and downloading workflow outputs
  [NodeType.OUTPUT]: outputExecutor as NodeExecutor,
  // MARKDOWN node for displaying text/markdown from previous nodes and downloading as .md
  [NodeType.MARKDOWN]: markdownExecutor as NodeExecutor,
  // SEEDANCE node for BytePlus Seedance video generation
  [NodeType.SEEDANCE]: seedanceExecutor as NodeExecutor,
  // SEEDREAM node for BytePlus Seedream image generation
  [NodeType.SEEDREAM]: seedreamExecutor as NodeExecutor,
  // COMPOSIO_ACTION node for executing any of 10,000+ Composio actions
  [NodeType.COMPOSIO_ACTION]: composioActionExecutor as NodeExecutor,
  // TINYFISH node for AI-powered web automation
  [NodeType.TINYFISH]: tinyfishExecutor as NodeExecutor,
};

/**
 * Get the executor function for a given node type
 * @param nodeType - The type of node to get executor for
 * @returns The executor function for that node type
 */

export function getExecutor(nodeType: string): NodeExecutor {
  const executor = executorRegistry[nodeType as NodeTypeValue];
  if (!executor) {
    throw new Error(`No executor found for node type: ${nodeType}`);
  }
  return executor;
}
