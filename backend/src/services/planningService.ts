import Anthropic from "@anthropic-ai/sdk";
import { prisma as prismaClient } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getWorkflowSchema } from "./workflowSchemaService";
import Handlebars from "handlebars";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

// Register Handlebars helpers
Handlebars.registerHelper("json", (context) => {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

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
        conversationHistory: [],
        status: "planning",
      },
    });
  }

  return {
    id: plan.id,
    conversationHistory:
      (Array.isArray(plan.conversationHistory)
        ? (plan.conversationHistory as unknown as ConversationMessage[])
        : []) || [],
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
    conversationHistory:
      (Array.isArray(plan.conversationHistory)
        ? (plan.conversationHistory as unknown as ConversationMessage[])
        : []) || [],
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
 * Send a planning message to Claude and get response
 */
export const sendPlanningMessage = async (options: {
  workflowId: string;
  message: string;
  attachments?: Array<{
    fileId: string;
    fileName: string;
    fileType: string;
    url?: string;
    extractedText?: string;
  }>;
  model?: string;
}): Promise<{ response: string; conversationHistory: ConversationMessage[] }> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  // Get or create plan
  const plan = await getOrCreateWorkflowPlan(options.workflowId);
  const conversationHistory = plan.conversationHistory;

  // Get workflow schema for context
  const workflowSchema = getWorkflowSchema();

  // Add user message to conversation
  const userMessage: ConversationMessage = {
    role: "user",
    content: options.message,
    timestamp: new Date().toISOString(),
    attachments: options.attachments,
  };

  const updatedHistory = [...conversationHistory, userMessage];

  // Build system prompt with workflow schema
  const systemPrompt = `You are an expert workflow automation consultant helping users plan and design workflows that completely and efficiently automate non-technical tasks.

Your role:
- **Business Consultant**: Understand user needs and translate them into workflow solutions
- **Workflow Architect**: Design efficient, user-friendly workflows using available nodes
- **Technical Advisor**: Explain how workflows will work and what's needed

WORKFLOW SCHEMA (Your complete knowledge base):
${JSON.stringify(workflowSchema, null, 2)}

KEY PRINCIPLES:
1. **Focus on non-technical task automation**: Help users automate business tasks without requiring technical knowledge
2. **Use available nodes**: Reference the workflow schema to suggest appropriate nodes and patterns
3. **Explain clearly**: Describe how the workflow will work in simple terms
4. **Identify requirements**: Help identify what credentials, data, and setup are needed
5. **Suggest improvements**: Propose optimizations and best practices
6. **Be collaborative**: Ask clarifying questions and iterate on the plan

CONVERSATION STYLE:
- Be friendly and helpful
- Ask clarifying questions when needed
- Explain workflow structure clearly
- Reference specific nodes from the schema when suggesting solutions
- Provide examples of how nodes work together
- Help break down complex tasks into workflow steps

When the user and you both agree the plan is ready, indicate that the workflow can be generated.`;

  // Build messages array for Claude
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  // Add conversation history (convert to Claude format)
  for (const msg of conversationHistory) {
    if (msg.role === "user") {
      let content = msg.content;
      if (msg.attachments && msg.attachments.length > 0) {
        content += `\n\n[Attachments: ${msg.attachments.map((a) => a.fileName).join(", ")}]`;
        // Add extracted text if available
        for (const att of msg.attachments) {
          if (att.extractedText) {
            content += `\n\n${att.fileName} content:\n${att.extractedText}`;
          }
        }
      }
      messages.push({ role: "user", content });
    } else {
      messages.push({ role: "assistant", content: msg.content });
    }
  }

  // Add current user message
  let currentUserContent = options.message;
  if (options.attachments && options.attachments.length > 0) {
    currentUserContent += `\n\n[Attachments: ${options.attachments.map((a) => a.fileName).join(", ")}]`;
    for (const att of options.attachments) {
      if (att.extractedText) {
        currentUserContent += `\n\n${att.fileName} content:\n${att.extractedText}`;
      }
    }
  }
  messages.push({ role: "user", content: currentUserContent });

  // Call Claude
  const selectedModel = options.model || "claude-sonnet-4-5-20250929";
  const response = await anthropic.messages.create({
    model: selectedModel,
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages as any,
  });

  let assistantResponse = "";
  if (response.content[0].type === "text") {
    assistantResponse = response.content[0].text;
  }

  // Add assistant response to conversation
  const assistantMessage: ConversationMessage = {
    role: "assistant",
    content: assistantResponse,
    timestamp: new Date().toISOString(),
  };

  const finalHistory = [...updatedHistory, assistantMessage];

  // Update WorkflowPlan in database
  await prismaClient.workflowPlan.update({
    where: { workflowId: options.workflowId },
    data: {
      conversationHistory: finalHistory as any,
    },
  });

  return {
    response: assistantResponse,
    conversationHistory: finalHistory,
  };
};

/**
 * Generate comprehensive workflow prompt from conversation history
 */
export const generatePromptFromConversation = async (options: {
  workflowId: string;
  model?: string;
}): Promise<{
  prompt: string;
  workflowStructure: {
    description: string;
    nodes: Array<{ type: string; purpose: string }>;
    credentials: Array<{ type: string; name: string; description: string }>;
  };
  credentials: Array<{ type: string; name: string; description: string }>;
}> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const plan = await getWorkflowPlan(options.workflowId);
  if (!plan || !plan.conversationHistory || plan.conversationHistory.length === 0) {
    throw new Error("No conversation history found for workflow plan");
  }

  const workflowSchema = getWorkflowSchema();

  // Build conversation summary
  const conversationSummary = plan.conversationHistory
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n\n");

  const systemPrompt = `You are an expert workflow automation architect. Your task is to generate a comprehensive, detailed prompt that will be used to generate a workflow blueprint.

Based on the planning conversation, create a prompt that:
1. Clearly describes the user's requirements
2. Includes context from the conversation
3. References the workflow schema for node selection
4. Specifies the workflow structure
5. Lists required credentials
6. Provides enough detail for accurate workflow generation

WORKFLOW SCHEMA:
${JSON.stringify(workflowSchema, null, 2)}

Return a JSON object with this structure:
{
  "prompt": "Comprehensive prompt for workflow generation",
  "workflowStructure": {
    "description": "Description of the workflow",
    "nodes": [{"type": "NODE_TYPE", "purpose": "What this node does"}],
    "credentials": [{"type": "credential_type", "name": "credential_name", "description": "Why this credential is needed"}]
  },
  "credentials": [{"type": "credential_type", "name": "credential_name", "description": "Why this credential is needed"}]
}`;

  const userPrompt = `Based on this planning conversation, generate a comprehensive workflow generation prompt:

${conversationSummary}

Generate a detailed prompt that captures all requirements and context from this conversation.`;

  const selectedModel = options.model || "claude-sonnet-4-5-20250929";
  const response = await anthropic.messages.create({
    model: selectedModel,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  let responseText = "";
  if (response.content[0].type === "text") {
    responseText = response.content[0].text;
  }

  // Extract JSON from response (may be wrapped in markdown)
  let jsonText = responseText;
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  } else {
    const codeMatch = responseText.match(/```\s*([\s\S]*?)\s*```/);
    if (codeMatch) {
      jsonText = codeMatch[1];
    }
  }

  try {
    const parsed = JSON.parse(jsonText.trim());
    const prompt = parsed.prompt || responseText;
    const workflowStructure = parsed.workflowStructure || {
      description: "",
      nodes: [],
      credentials: [],
    };
    const credentials = parsed.credentials || [];

    // Update WorkflowPlan with generated prompt
    await prismaClient.workflowPlan.update({
      where: { workflowId: options.workflowId },
      data: {
        generatedPrompt: prompt,
        workflowStructure: workflowStructure as any,
        status: "ready",
      },
    });

    return {
      prompt,
      workflowStructure,
      credentials,
    };
  } catch (error) {
    // If JSON parsing fails, use the full response as prompt
    const prompt = responseText;
    await prismaClient.workflowPlan.update({
      where: { workflowId: options.workflowId },
      data: {
        generatedPrompt: prompt,
        workflowStructure: Prisma.JsonNull as any,
        status: "ready",
      },
    });

    return {
      prompt,
      workflowStructure: {
        description: "",
        nodes: [],
        credentials: [],
      },
      credentials: [],
    };
  }
};

/**
 * Clear conversation history for a workflow plan
 */
export const clearConversation = async (workflowId: string): Promise<void> => {
  await prismaClient.workflowPlan.update({
    where: { workflowId },
    data: {
      conversationHistory: [] as any,
      status: "planning",
      generatedPrompt: null,
      workflowStructure: Prisma.JsonNull as any,
      approvedAt: null,
    },
  });
};

/**
 * Process uploaded files and extract text content
 * For images: Use Claude Vision API
 * For PDFs: Extract text (would need pdf-parse library)
 * For text files: Read directly
 */
export const processUploadedFiles = async (
  files: Array<{
    fileId: string;
    fileName: string;
    fileType: string;
    url?: string;
    buffer?: Buffer;
  }>
): Promise<
  Array<{
    fileId: string;
    fileName: string;
    fileType: string;
    url?: string;
    extractedText?: string;
  }>
> => {
  const processedFiles = [];

  for (const file of files) {
    let extractedText: string | undefined;

    // Handle images with Claude Vision API
    if (file.fileType.startsWith("image/")) {
      try {
        // For images, we'll use Claude Vision API
        // Note: This requires base64 encoding of the image
        // For now, we'll just note that text extraction is available
        extractedText = "[Image content - can be analyzed with Claude Vision API]";
      } catch (error) {
        console.error(`Error processing image ${file.fileName}:`, error);
      }
    }
    // Handle PDFs (would need pdf-parse or similar)
    else if (file.fileType === "application/pdf") {
      // TODO: Implement PDF text extraction
      // Would need: npm install pdf-parse
      extractedText = "[PDF content - text extraction not yet implemented]";
    }
    // Handle text files
    else if (
      file.fileType.startsWith("text/") ||
      file.fileType === "application/json" ||
      file.fileType === "application/yaml"
    ) {
      // If we have buffer, convert to string
      if (file.buffer) {
        extractedText = file.buffer.toString("utf-8");
      }
    }

    processedFiles.push({
      fileId: file.fileId,
      fileName: file.fileName,
      fileType: file.fileType,
      url: file.url,
      extractedText,
    });
  }

  return processedFiles;
};
