/**
 * Planning Service
 *
 * Uses Claude Agent SDK for workflow planning conversations
 * with self-learning capabilities to improve suggestions over time.
 */

import { chatWithAgent, generateSmartPrompt, type AgentStreamEvent } from "./agent/agentService";
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
    fileId: string;
    fileName: string;
    fileType: string;
    url?: string;
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
 * Get or create a WorkflowPlan for a workflow
 */
export const getOrCreateWorkflowPlan = async (
  workflowId: string
): Promise<{ id: string; conversationHistory: ConversationMessage[]; status: string }> => {
  let plan = await prismaClient.workflowPlan.findUnique({
    where: { workflowId },
  });

  if (!plan) {
    plan = await prismaClient.workflowPlan.create({
      data: {
        workflowId,
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
 * Get WorkflowPlan for a workflow
 */
export const getWorkflowPlan = async (workflowId: string): Promise<WorkflowPlanData | null> => {
  const plan = await prismaClient.workflowPlan.findUnique({
    where: { workflowId },
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
  attachments?: Array<{
    fileId: string;
    fileName: string;
    fileType: string;
    url?: string;
    extractedText?: string;
  }>;
  model?: string;
}): Promise<{
  response: string;
  conversationHistory: ConversationMessage[];
  workflowModified: boolean;
  toolsUsed: string[];
}> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  // Get or create plan
  const plan = await getOrCreateWorkflowPlan(options.workflowId);
  const conversationHistory = plan.conversationHistory;

  // Get learning context for personalized suggestions
  const learningContext = await getLearningContext(options.userId, options.message);

  // Add user message with attachments
  let userMessage = options.message;
  if (options.attachments && options.attachments.length > 0) {
    userMessage += `\n\n[Attachments: ${options.attachments.map((a) => a.fileName).join(", ")}]`;
    for (const att of options.attachments) {
      if (att.extractedText) {
        userMessage += `\n\n${att.fileName} content:\n${att.extractedText}`;
      }
    }
  }

  // Collect response text from agent and track tool usage
  let assistantResponse = "";
  const toolsUsed: string[] = [];
  let workflowModified = false;

  for await (const event of chatWithAgent({
    userId: options.userId,
    workflowId: options.workflowId,
    message: userMessage,
    conversationHistory,
    learningContext,
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

  // Save updated conversation history
  await prismaClient.workflowPlan.update({
    where: { workflowId: options.workflowId },
    data: {
      conversationHistory: serializeConversationHistory(updatedHistory),
      updatedAt: new Date(),
    },
  });

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
  attachments?: Array<{
    fileId: string;
    fileName: string;
    fileType: string;
    url?: string;
    extractedText?: string;
  }>;
  model?: string;
}): AsyncGenerator<AgentStreamEvent> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  // Get or create plan
  const plan = await getOrCreateWorkflowPlan(options.workflowId);
  const conversationHistory = plan.conversationHistory;

  // Get learning context for personalized suggestions
  const learningContext = await getLearningContext(options.userId, options.message);

  // Add user message with attachments
  let userMessage = options.message;
  if (options.attachments && options.attachments.length > 0) {
    userMessage += `\n\n[Attachments: ${options.attachments.map((a) => a.fileName).join(", ")}]`;
    for (const att of options.attachments) {
      if (att.extractedText) {
        userMessage += `\n\n${att.fileName} content:\n${att.extractedText}`;
      }
    }
  }

  let assistantResponse = "";

  // Stream events from agent
  for await (const event of chatWithAgent({
    userId: options.userId,
    workflowId: options.workflowId,
    message: userMessage,
    conversationHistory,
    learningContext,
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

  await prismaClient.workflowPlan.update({
    where: { workflowId: options.workflowId },
    data: {
      conversationHistory: serializeConversationHistory(updatedHistory),
      updatedAt: new Date(),
    },
  });
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

  // Save generated prompt with workflow structure
  await prismaClient.workflowPlan.update({
    where: { workflowId },
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

  // Update plan status
  await prismaClient.workflowPlan.update({
    where: { workflowId },
    data: { status: "completed" },
  });
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
  await prismaClient.workflowPlan.update({
    where: { workflowId },
    data: {
      status: "ready",
      approvedAt: new Date(),
    },
  });
};

/**
 * Update workflow plan status
 */
export const updateWorkflowPlanStatus = async (
  workflowId: string,
  status: "planning" | "ready" | "generating" | "completed"
): Promise<void> => {
  await prismaClient.workflowPlan.update({
    where: { workflowId },
    data: { status },
  });
};

/**
 * Clear workflow plan conversation history
 */
export const clearPlanningConversation = async (workflowId: string): Promise<void> => {
  await prismaClient.workflowPlan.update({
    where: { workflowId },
    data: {
      conversationHistory: serializeConversationHistory([]),
      status: "planning",
    },
  });
};
