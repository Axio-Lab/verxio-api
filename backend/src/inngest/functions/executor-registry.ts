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
import { googleDriveExecutor } from "./actions/google-drive";
import { googleCalendarExecutor } from "./actions/google-calendar";
import { googleSheetsExecutor } from "./actions/google-sheets";
import { googleDocsExecutor } from "./actions/google-docs";
import { googleMeetExecutor } from "./actions/google-meet";
import { googleSlidesExecutor } from "./actions/google-slides";
import { gmailExecutor } from "./actions/gmail";
import { airtableExecutor } from "./actions/airtable";
import { NodeType, type NodeTypeValue } from "@/lib/node-types";

// Registry of executors for each node type
// Note: We cast specific executors to base NodeExecutor type to allow different generic types
export const executorRegistry: Record<NodeTypeValue, NodeExecutor> = {
  [NodeType.MANUAL_TRIGGER]: manualTriggerExecutor,
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
  [NodeType.TELEGRAM]: telegramExecutor as NodeExecutor,
  [NodeType.GOOGLE_DRIVE]: googleDriveExecutor as NodeExecutor,
  [NodeType.GOOGLE_CALENDAR]: googleCalendarExecutor as NodeExecutor,
  [NodeType.GOOGLE_SHEETS]: googleSheetsExecutor as NodeExecutor,
  [NodeType.GOOGLE_DOCS]: googleDocsExecutor as NodeExecutor,
  [NodeType.GOOGLE_MEET]: googleMeetExecutor as NodeExecutor,
  [NodeType.GOOGLE_SLIDES]: googleSlidesExecutor as NodeExecutor,
  [NodeType.GMAIL]: gmailExecutor as NodeExecutor,
  [NodeType.AIRTABLE]: airtableExecutor as NodeExecutor,
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
