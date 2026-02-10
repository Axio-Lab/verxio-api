/**
 * Central registry of all node status channels
 * Add new channels here to automatically include them in subscriptions
 */
import { httpRequestChannel } from "./http-request";
import { manualTriggerChannel } from "./manual-trigger";
import { timedTriggerChannel } from "./timed-trigger";
import { deciderChannel } from "./decider";
import { webhookChannel } from "./webhook";
import { googleFormTriggerChannel } from "./google-form-trigger";
import { airtableTriggerChannel } from "./airtable-trigger";
import { stripeTriggerChannel } from "./stripe-trigger";
import { whatsappTriggerChannel } from "./whatsapp-trigger";
import { openaiChannel } from "./openai";
import { anthropicChannel } from "./anthropic";
import { geminiChannel } from "./gemini";
import { whatsappChannel } from "./whatsapp";
import { slackChannel } from "./slack";
import { discordChannel } from "./discord";
import { telegramTriggerChannel } from "./telegram-trigger";
import { telegramChannel } from "./telegram";
import { googleDriveChannel } from "./google-drive";
import { googleCalendarChannel } from "./google-calendar";
import { googleSheetsChannel } from "./google-sheets";
import { googleDocsChannel } from "./google-docs";
import { googleMeetChannel } from "./google-meet";
import { googleSlidesChannel } from "./google-slides";
import { gmailChannel } from "./gmail";
import { airtableChannel } from "./airtable";
import { elevenlabsChannel } from "./elevenlabs";
import { firecrawlChannel } from "./firecrawl";
import { apifyChannel } from "./apify";
import { codeBlockChannel } from "./code-block";
import { manualInputChannel } from "./manual-input";
import { designChannel } from "./design";
import { designProChannel } from "./designPro";
import { remotionChannel } from "./remotion";
import { veoChannel } from "./veo";
import { klingChannel } from "./kling";
import { outputChannel } from "./output";
import { markdownChannel } from "./markdown";

export const nodeStatusChannels = {
  httpRequest: httpRequestChannel,
  manualTrigger: manualTriggerChannel,
  manualInput: manualInputChannel,
  timedTrigger: timedTriggerChannel,
  decider: deciderChannel,
  webhook: webhookChannel,
  googleFormTrigger: googleFormTriggerChannel,
  airtableTrigger: airtableTriggerChannel,
  stripeTrigger: stripeTriggerChannel,
  whatsappTrigger: whatsappTriggerChannel,
  openai: openaiChannel,
  anthropic: anthropicChannel,
  gemini: geminiChannel,
  whatsapp: whatsappChannel,
  slack: slackChannel,
  discord: discordChannel,
  telegramTrigger: telegramTriggerChannel,
  telegram: telegramChannel,
  googleDrive: googleDriveChannel,
  googleCalendar: googleCalendarChannel,
  googleSheets: googleSheetsChannel,
  googleDocs: googleDocsChannel,
  googleMeet: googleMeetChannel,
  googleSlides: googleSlidesChannel,
  gmail: gmailChannel,
  airtable: airtableChannel,
  elevenlabs: elevenlabsChannel,
  firecrawl: firecrawlChannel,
  apify: apifyChannel,
  codeBlock: codeBlockChannel,
  design: designChannel,
  designPro: designProChannel,
  remotion: remotionChannel,
  veo: veoChannel,
  kling: klingChannel,
  output: outputChannel,
  markdown: markdownChannel,
} as const;

export type NodeStatusChannelKey = keyof typeof nodeStatusChannels;

// Channel name mapping for client-side filtering
export const channelNameMap: Record<NodeStatusChannelKey, string> = {
  httpRequest: "http-request-execution",
  manualTrigger: "manual-trigger-execution",
  manualInput: "manual-input-execution",
  timedTrigger: "timed-trigger-execution",
  decider: "decider-execution",
  webhook: "webhook-execution",
  googleFormTrigger: "google-form-trigger-execution",
  airtableTrigger: "airtable-trigger-execution",
  stripeTrigger: "stripe-trigger-execution",
  whatsappTrigger: "whatsapp-trigger-execution",
  openai: "openai-execution",
  anthropic: "anthropic-execution",
  gemini: "gemini-execution",
  whatsapp: "whatsapp-execution",
  slack: "slack-execution",
  discord: "discord-execution",
  telegramTrigger: "telegram-trigger-execution",
  telegram: "telegram-execution",
  googleDrive: "google-drive-execution",
  googleCalendar: "google-calendar-execution",
  googleSheets: "google-sheets-execution",
  googleDocs: "google-docs-execution",
  googleMeet: "google-meet-execution",
  googleSlides: "google-slides-execution",
  gmail: "gmail-execution",
  airtable: "airtable-execution",
  elevenlabs: "elevenlabs-execution",
  firecrawl: "firecrawl-execution",
  apify: "apify-execution",
  codeBlock: "code-block-execution",
  design: "design-execution",
  designPro: "design-pro-execution",
  remotion: "remotion-execution",
  veo: "veo-execution",
  kling: "kling-execution",
  output: "output-execution",
  markdown: "markdown-execution",
};
