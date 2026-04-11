/**
 * Planning Service
 *
 * Uses Claude Agent SDK for workflow planning conversations
 * with self-learning capabilities to improve suggestions over time.
 */

import {
  chatWithAgent,
  generateSmartPrompt,
  type AgentStreamEvent,
  type MediaAttachment,
} from "./agent/agentService";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { prisma as prismaClient } from "@/lib/prisma";
import {
  getLearningContext,
  recordWorkflowPattern,
  getWorkflowInsights,
} from "./workflowLearningService";
import { parseConversationHistory, serializeConversationHistory } from "@/lib/chatEncryption";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachments?: Array<{
    fileId?: string;
    fileName?: string;
    fileType?: string;
    mimeType?: string;
    url?: string;
    base64?: string;
    extractedText?: string;
  }>;
}

export interface WorkflowPlanData {
  conversationHistory: ConversationMessage[];
  status: "planning" | "ready" | "generating" | "completed";
  generatedPrompt?: string;
  workflowStructure?: {
    description: string;
    nodes: Array<{ type: string; purpose: string }>;
    credentials: Array<{ type: string; name: string; description: string }>;
  };
  approvedAt?: string;
}

/**
 * Get or create a WorkflowPlan for a workflow.
 * @param workflowId - The workflow ID
 * @param chatIntegrationId - When set, scopes the plan to this chat integration (each channel has its own conversation). Null/undefined = canvas/standalone.
 */
export const getOrCreateWorkflowPlan = async (
  workflowId: string,
  chatIntegrationId?: string | null
): Promise<{ id: string; conversationHistory: ConversationMessage[]; status: string }> => {
  const integrationId = chatIntegrationId ?? null;
  let plan = await prismaClient.workflowPlan.findFirst({
    where: { workflowId, chatIntegrationId: integrationId },
  });

  if (!plan) {
    plan = await prismaClient.workflowPlan.create({
      data: {
        workflowId,
        chatIntegrationId: integrationId,
        conversationHistory: serializeConversationHistory([]),
        status: "planning",
      },
    });
  }

  return {
    id: plan.id,
    conversationHistory: parseConversationHistory(
      plan.conversationHistory
    ) as ConversationMessage[],
    status: plan.status,
  };
};

/**
 * Get or create a per-sender ChatConversation for chat integrations.
 * This isolates conversation history per external user (telegram id, phone number, etc.)
 * so that User A's messages never leak into User B's context.
 */
export const getOrCreateChatConversation = async (
  chatIntegrationId: string,
  externalId: string
): Promise<{ id: string; conversationHistory: ConversationMessage[] }> => {
  let convo = await (prismaClient as any).chatConversation.findUnique({
    where: { chatIntegrationId_externalId: { chatIntegrationId, externalId } },
  });

  if (!convo) {
    convo = await (prismaClient as any).chatConversation.create({
      data: {
        chatIntegrationId,
        externalId,
        conversationHistory: serializeConversationHistory([]),
      },
    });
  }

  return {
    id: convo.id,
    conversationHistory: parseConversationHistory(
      convo.conversationHistory
    ) as ConversationMessage[],
  };
};

/**
 * Save per-sender conversation history back to ChatConversation.
 */
export const saveChatConversation = async (
  chatIntegrationId: string,
  externalId: string,
  history: ConversationMessage[]
): Promise<void> => {
  await (prismaClient as any).chatConversation.upsert({
    where: { chatIntegrationId_externalId: { chatIntegrationId, externalId } },
    update: {
      conversationHistory: serializeConversationHistory(history),
      lastMessageAt: new Date(),
    },
    create: {
      chatIntegrationId,
      externalId,
      conversationHistory: serializeConversationHistory(history),
    },
  });
};

/**
 * Clear per-sender conversation history.
 */
export const clearChatConversation = async (
  chatIntegrationId: string,
  externalId: string
): Promise<void> => {
  const convo = await (prismaClient as any).chatConversation.findUnique({
    where: { chatIntegrationId_externalId: { chatIntegrationId, externalId } },
  });
  if (!convo) return;
  await (prismaClient as any).chatConversation.update({
    where: { id: convo.id },
    data: {
      conversationHistory: serializeConversationHistory([]),
      lastMessageAt: new Date(),
    },
  });
};

/**
 * Get WorkflowPlan for a workflow.
 * @param workflowId - The workflow ID
 * @param chatIntegrationId - When set, fetches the plan scoped to this integration. Null/undefined = canvas/standalone.
 */
export const getWorkflowPlan = async (
  workflowId: string,
  chatIntegrationId?: string | null
): Promise<WorkflowPlanData | null> => {
  const plan = await prismaClient.workflowPlan.findFirst({
    where: { workflowId, chatIntegrationId: chatIntegrationId ?? null },
  });

  if (!plan) {
    return null;
  }

  return {
    conversationHistory: parseConversationHistory(
      plan.conversationHistory
    ) as ConversationMessage[],
    status: plan.status as WorkflowPlanData["status"],
    generatedPrompt: plan.generatedPrompt || undefined,
    workflowStructure:
      (plan.workflowStructure
        ? (plan.workflowStructure as unknown as WorkflowPlanData["workflowStructure"])
        : undefined) || undefined,
    approvedAt: plan.approvedAt?.toISOString(),
  };
};

/**
 * Send a planning message to Claude Agent and get response
 * Includes learning context for improved suggestions
 */
// Tools that modify the workflow
const WORKFLOW_MODIFYING_TOOLS = [
  "createWorkflow",
  "addNode",
  "configureNode",
  "connectNodes",
  "deleteNode",
  "deleteConnection",
];

export const sendPlanningMessage = async (options: {
  workflowId: string;
  userId: string;
  message: string;
  chatIntegrationId?: string | null;
  externalId?: string | null;
  attachments?: Array<{
    fileId?: string;
    fileName?: string;
    fileType?: string;
    mimeType?: string;
    url?: string;
    base64?: string;
    extractedText?: string;
  }>;
  model?: string;
  isGeneralChat?: boolean;
}): Promise<{
  response: string;
  conversationHistory: ConversationMessage[];
  workflowModified: boolean;
  toolsUsed: string[];
}> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  // Per-sender isolation: when externalId is provided (chat integration context),
  // use ChatConversation instead of WorkflowPlan for conversation history.
  let conversationHistory: ConversationMessage[];
  let useChatConversation = false;
  if (options.chatIntegrationId && options.externalId) {
    const convo = await getOrCreateChatConversation(options.chatIntegrationId, options.externalId);
    conversationHistory = convo.conversationHistory;
    useChatConversation = true;
  } else {
    const plan = await getOrCreateWorkflowPlan(options.workflowId, options.chatIntegrationId);
    conversationHistory = plan.conversationHistory;
  }

  // Get learning context for personalized suggestions
  const learningContext = await getLearningContext(options.userId, options.message);

  // Build media attachments for the agent
  const mediaAttachments: MediaAttachment[] = (options.attachments || []).map((att) => {
    const mime = att.mimeType || att.fileType || "";
    return {
      type: (mime.startsWith("image/") ? "image" : "file") as "image" | "file" | "document",
      url: att.url,
      base64: att.base64,
      mimeType: mime || undefined,
      fileName: att.fileName,
      extractedText: att.extractedText,
    };
  });

  // Collect response text from agent and track tool usage
  let assistantResponse = "";
  const toolsUsed: string[] = [];
  let workflowModified = false;

  for await (const event of chatWithAgent({
    userId: options.userId,
    workflowId: options.workflowId,
    message: options.message,
    conversationHistory,
    learningContext,
    attachments: mediaAttachments.length > 0 ? mediaAttachments : undefined,
    isGeneralChat: options.isGeneralChat,
  })) {
    if (event.type === "message" && event.data.text && !event.data.partial) {
      assistantResponse += event.data.text;
    }

    if (event.type === "result" && event.data.result) {
      assistantResponse = event.data.result;
    }

    // Track tool usage
    if (event.type === "tool_use" && event.data.name) {
      toolsUsed.push(event.data.name);
      if (WORKFLOW_MODIFYING_TOOLS.includes(event.data.name)) {
        workflowModified = true;
      }
    }
  }

  // Update conversation history
  const updatedHistory: ConversationMessage[] = [
    ...conversationHistory,
    {
      role: "user",
      content: options.message,
      timestamp: new Date().toISOString(),
      attachments: options.attachments,
    },
    {
      role: "assistant",
      content: assistantResponse,
      timestamp: new Date().toISOString(),
    },
  ];

  // Save updated conversation history to the appropriate store
  if (useChatConversation && options.chatIntegrationId && options.externalId) {
    await saveChatConversation(options.chatIntegrationId, options.externalId, updatedHistory);
  } else {
    const planRecord = await prismaClient.workflowPlan.findFirst({
      where: {
        workflowId: options.workflowId,
        chatIntegrationId: options.chatIntegrationId ?? null,
      },
    });
    if (planRecord) {
      await prismaClient.workflowPlan.update({
        where: { id: planRecord.id },
        data: {
          conversationHistory: serializeConversationHistory(updatedHistory),
          updatedAt: new Date(),
        },
      });
    }
  }

  return {
    response: assistantResponse,
    conversationHistory: updatedHistory,
    workflowModified,
    toolsUsed,
  };
};

/**
 * Send a planning message with streaming support
 * Includes learning context for improved suggestions
 */
export async function* sendPlanningMessageStreaming(options: {
  workflowId: string;
  userId: string;
  message: string;
  chatIntegrationId?: string | null;
  externalId?: string | null;
  attachments?: Array<{
    fileId?: string;
    fileName?: string;
    fileType?: string;
    mimeType?: string;
    url?: string;
    base64?: string;
    extractedText?: string;
  }>;
  model?: string;
  isGeneralChat?: boolean;
}): AsyncGenerator<AgentStreamEvent> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  let conversationHistory: ConversationMessage[];
  let useChatConversation = false;
  if (options.chatIntegrationId && options.externalId) {
    const convo = await getOrCreateChatConversation(options.chatIntegrationId, options.externalId);
    conversationHistory = convo.conversationHistory;
    useChatConversation = true;
  } else {
    const plan = await getOrCreateWorkflowPlan(options.workflowId, options.chatIntegrationId);
    conversationHistory = plan.conversationHistory;
  }

  // Get learning context for personalized suggestions
  const learningContext = await getLearningContext(options.userId, options.message);

  // Build media attachments for the agent
  const streamMediaAttachments: MediaAttachment[] = (options.attachments || []).map((att) => {
    const mime = att.mimeType || att.fileType || "";
    return {
      type: (mime.startsWith("image/") ? "image" : "file") as "image" | "file" | "document",
      url: att.url,
      base64: att.base64,
      mimeType: mime || undefined,
      fileName: att.fileName,
      extractedText: att.extractedText,
    };
  });

  let assistantResponse = "";

  // Stream events from agent
  for await (const event of chatWithAgent({
    userId: options.userId,
    workflowId: options.workflowId,
    message: options.message,
    conversationHistory,
    learningContext,
    attachments: streamMediaAttachments.length > 0 ? streamMediaAttachments : undefined,
    isGeneralChat: options.isGeneralChat,
  })) {
    // Collect response for history
    if (event.type === "message" && event.data.text && !event.data.partial) {
      assistantResponse += event.data.text;
    } else if (event.type === "result" && event.data.result) {
      assistantResponse = event.data.result;
    }

    // Yield event to caller
    yield event;
  }

  // Update conversation history after streaming completes
  const updatedHistory: ConversationMessage[] = [
    ...conversationHistory,
    {
      role: "user",
      content: options.message,
      timestamp: new Date().toISOString(),
      attachments: options.attachments,
    },
    {
      role: "assistant",
      content: assistantResponse,
      timestamp: new Date().toISOString(),
    },
  ];

  if (useChatConversation && options.chatIntegrationId && options.externalId) {
    await saveChatConversation(options.chatIntegrationId, options.externalId, updatedHistory);
  } else {
    const planRecord = await prismaClient.workflowPlan.findFirst({
      where: {
        workflowId: options.workflowId,
        chatIntegrationId: options.chatIntegrationId ?? null,
      },
    });
    if (planRecord) {
      await prismaClient.workflowPlan.update({
        where: { id: planRecord.id },
        data: {
          conversationHistory: serializeConversationHistory(updatedHistory),
          updatedAt: new Date(),
        },
      });
    }
  }
}

/**
 * Generate final workflow prompt from conversation history
 * Uses AI to analyze conversation and create an optimized prompt
 */
export const generateWorkflowPrompt = async (
  workflowId: string,
  userId: string
): Promise<{
  generatedPrompt: string;
  summary?: string;
  suggestedNodes?: string[];
}> => {
  const plan = await getWorkflowPlan(workflowId);
  if (!plan) {
    throw new Error("Workflow plan not found");
  }

  // Use smart prompt generation with the agent
  const { prompt, summary, suggestedNodes } = await generateSmartPrompt({
    userId,
    workflowId,
    conversationHistory: plan.conversationHistory,
  });

  // Save generated prompt with workflow structure (canvas plan: chatIntegrationId null)
  const planRecord = await prismaClient.workflowPlan.findFirst({
    where: { workflowId, chatIntegrationId: null },
  });
  if (planRecord) {
    await prismaClient.workflowPlan.update({
      where: { id: planRecord.id },
      data: {
        generatedPrompt: prompt,
        workflowStructure: {
          description: summary,
          nodes: suggestedNodes.map((type) => ({ type, purpose: "" })),
          credentials: [],
        } as any,
        status: "ready",
      },
    });
  }

  return {
    generatedPrompt: prompt,
    summary,
    suggestedNodes,
  };
};

/**
 * Record successful workflow generation for learning
 */
export const recordSuccessfulGeneration = async (
  workflowId: string,
  userId: string,
  description: string
): Promise<void> => {
  const plan = await getWorkflowPlan(workflowId);
  const conversationSummary = plan?.conversationHistory
    .slice(-2)
    .map((m) => m.content)
    .join(" | ");

  await recordWorkflowPattern({
    userId,
    workflowId,
    description,
    conversationSummary,
  });

  // Update plan status (canvas plan: chatIntegrationId null)
  const planRecord = await prismaClient.workflowPlan.findFirst({
    where: { workflowId, chatIntegrationId: null },
  });
  if (planRecord) {
    await prismaClient.workflowPlan.update({
      where: { id: planRecord.id },
      data: { status: "completed" },
    });
  }
};

/**
 * Get user's workflow insights
 */
export const getUserInsights = async (userId: string) => {
  return getWorkflowInsights(userId);
};

/**
 * Mark workflow plan as approved and ready for generation
 */
export const approveWorkflowPlan = async (workflowId: string): Promise<void> => {
  const planRecord = await prismaClient.workflowPlan.findFirst({
    where: { workflowId, chatIntegrationId: null },
  });
  if (planRecord) {
    await prismaClient.workflowPlan.update({
      where: { id: planRecord.id },
      data: {
        status: "ready",
        approvedAt: new Date(),
      },
    });
  }
};

/**
 * Update workflow plan status
 */
export const updateWorkflowPlanStatus = async (
  workflowId: string,
  status: "planning" | "ready" | "generating" | "completed",
  chatIntegrationId?: string | null
): Promise<void> => {
  const planRecord = await prismaClient.workflowPlan.findFirst({
    where: { workflowId, chatIntegrationId: chatIntegrationId ?? null },
  });
  if (planRecord) {
    await prismaClient.workflowPlan.update({
      where: { id: planRecord.id },
      data: { status },
    });
  }
};

/**
 * Clear workflow plan conversation history.
 * @param chatIntegrationId - When set, clears the plan for this chat integration. Null = canvas/standalone.
 */
export const clearPlanningConversation = async (
  workflowId: string,
  chatIntegrationId?: string | null
): Promise<void> => {
  const planRecord = await prismaClient.workflowPlan.findFirst({
    where: { workflowId, chatIntegrationId: chatIntegrationId ?? null },
  });
  if (!planRecord) return;
  await prismaClient.workflowPlan.update({
    where: { id: planRecord.id },
    data: {
      conversationHistory: serializeConversationHistory([]),
      status: "planning",
    },
  });
};

const DEFAULT_PLAN_SOUL_MODEL = "claude-sonnet-4-20250514";

/**
 * Generate a soul.md-style persona document for the planning assistant (used by POST /planning/generate-soul).
 */
export async function generatePlanSoulMd(input: {
  name: string;
  description: string;
  tone: string;
  coreTruths?: string;
  boundaries?: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  const modelId = process.env.AGENT_CLAUDE_MODEL?.trim() || DEFAULT_PLAN_SOUL_MODEL;
  const anthropic = createAnthropic({ apiKey });
  const userParts = [
    `Assistant display name: ${input.name}`,
    `Role and context: ${input.description}`,
    `Tone: ${input.tone}`,
  ];
  if (input.coreTruths?.trim()) {
    userParts.push(`Core truths to always honor:\n${input.coreTruths.trim()}`);
  }
  if (input.boundaries?.trim()) {
    userParts.push(`Boundaries (never cross):\n${input.boundaries.trim()}`);
  }
  const { text } = await generateText({
    model: anthropic(modelId),
    system:
      'You write a concise Markdown document ("soul.md") that defines how an AI assistant should behave when helping the user plan and build workflows. Use clear sections with ## headings. Be specific and actionable. Output only the Markdown body — no preamble or fenced code blocks.',
    prompt: userParts.join("\n\n"),
  });
  const out = (text || "").trim();
  if (!out) {
    throw new Error("Model returned an empty soul document");
  }
  return out;
}
