/**
 * Claude Agent Service
 *
 * Main service for interacting with Claude Agent SDK.
 * Provides the query wrapper with Verxio MCP tools and dynamic user connections.
 */

import {
  query,
  tool,
  createSdkMcpServer,
  type SDKMessage,
  type Query,
  type McpServerConfig,
  type SdkMcpToolDefinition,
} from "@anthropic-ai/claude-agent-sdk";
import { basePrismaClient } from "../../lib/prisma";
import { verxioTools, type ToolContext } from "./verxio-mcp-tools";
import { getVerxioSystemPrompt } from "./verxio-system-prompt";
import * as connectionService from "../connectionService";
import {
  createTrace,
  endTrace,
  logSpan,
  type TraceContext,
  type TraceMetadata,
} from "../opikService";

const prisma = basePrismaClient as any;

// ============================================
// Types
// ============================================

export interface AgentQueryOptions {
  prompt: string;
  userId: string;
  workflowId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  includeUserConnections?: boolean;
  model?: string;
  maxTurns?: number;
  abortController?: AbortController;
  /** Type of agent query for Opik tracing categorization */
  traceType?: TraceMetadata["traceType"];
}

export interface AgentStreamEvent {
  type: "message" | "tool_use" | "tool_result" | "thinking" | "result" | "error" | "status";
  data: any;
}

// ============================================
// Convert Verxio Tools to SDK Format
// ============================================

function createVerxioMcpTools(context: ToolContext): SdkMcpToolDefinition<any>[] {
  return verxioTools.map((verxioTool) => {
    return tool(
      verxioTool.name,
      verxioTool.description,
      verxioTool.inputSchema.shape,
      async (args: any, _extra: unknown) => {
        try {
          const result = await verxioTool.execute(args, context);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text" as const, text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      }
    );
  });
}

// ============================================
// Load User MCP Connections
// ============================================

async function loadUserMcpServers(userId: string): Promise<Record<string, McpServerConfig>> {
  try {
    const connections = await connectionService.getActiveMcpConnections(userId);
    const mcpServers: Record<string, McpServerConfig> = {};

    for (const conn of connections) {
      const config = conn.config as any;

      if (config.transport === "stdio" && config.command) {
        mcpServers[conn.name] = {
          type: "stdio",
          command: config.command,
          args: config.args || [],
          env: config.env || {},
        };
      } else if (config.transport === "sse" && config.serverUrl) {
        mcpServers[conn.name] = {
          type: "sse",
          url: config.serverUrl,
          headers: config.headers || {},
        };
      } else if (config.transport === "streamable-http" && config.serverUrl) {
        mcpServers[conn.name] = {
          type: "http",
          url: config.serverUrl,
          headers: config.headers || {},
        };
      }

      // Mark as used
      await connectionService.markConnectionUsed(conn.id);
    }

    return mcpServers;
  } catch (error) {
    console.error("Error loading user MCP servers:", error);
    return {};
  }
}

// ============================================
// Get User Context for System Prompt
// ============================================

async function getUserContext(userId: string, workflowId?: string) {
  // Get user's credentials
  const credentials = await prisma.credential.findMany({
    where: { userId },
    select: { type: true, name: true },
  });

  // Get user's active connections
  const connections = await prisma.userConnection.findMany({
    where: { userId, isActive: true },
    select: { name: true, type: true, description: true },
  });

  return {
    userId,
    workflowId,
    availableCredentials: credentials,
    userConnections: connections,
  };
}

// ============================================
// Main Agent Query Function
// ============================================

export async function* runAgentQuery(options: AgentQueryOptions): AsyncGenerator<AgentStreamEvent> {
  const {
    prompt,
    userId,
    workflowId,
    conversationHistory,
    includeUserConnections = true,
    model = "claude-sonnet-4-5-20250929",
    maxTurns = 10,
    abortController,
    traceType = "agent_query",
  } = options;

  // Create Opik trace for observability
  const traceContext = createTrace(traceType, {
    userId,
    workflowId,
    traceType,
    model,
    promptLength: prompt.length,
    hasConversationHistory: !!conversationHistory?.length,
  });

  // Create tool context
  const toolContext: ToolContext = { userId, workflowId };

  // Create Verxio MCP server with custom tools
  const verxioMcpServer = createSdkMcpServer({
    name: "verxio-workflow",
    version: "1.0.0",
    tools: createVerxioMcpTools(toolContext),
  });

  // Load user's MCP connections if enabled
  let userMcpServers: Record<string, McpServerConfig> = {};
  if (includeUserConnections) {
    userMcpServers = await loadUserMcpServers(userId);
  }

  // Get user context for system prompt
  const userContext = await getUserContext(userId, workflowId);

  // Build system prompt
  const systemPrompt = getVerxioSystemPrompt(userContext);

  // Build conversation context if exists
  let fullPrompt = prompt;
  if (conversationHistory && conversationHistory.length > 0) {
    const historyText = conversationHistory
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n\n");
    fullPrompt = `Previous conversation:\n${historyText}\n\nCurrent request: ${prompt}`;
  }

  let lastResult: any = null;
  let hasError = false;
  let errorMessage: string | undefined;

  try {
    // Start the query
    const result: Query = query({
      prompt: fullPrompt,
      options: {
        model,
        systemPrompt,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        mcpServers: {
          "verxio-workflow": verxioMcpServer,
          ...userMcpServers,
        },
        tools: { type: "preset", preset: "claude_code" },
        maxTurns,
        abortController,
        includePartialMessages: true,
      },
    });

    // Stream messages
    for await (const message of result) {
      // Capture result for tracing
      if (message.type === "result") {
        lastResult = message;
      }
      yield* processSDKMessage(message);
    }
  } catch (error: any) {
    hasError = true;
    errorMessage = error.message;
    yield {
      type: "error",
      data: { message: error.message, stack: error.stack },
    };
  } finally {
    // End the Opik trace with final metrics
    await endTrace(traceContext, {
      success: !hasError,
      output: lastResult,
      error: errorMessage,
      usage: lastResult?.usage
        ? {
            inputTokens: lastResult.usage.input_tokens,
            outputTokens: lastResult.usage.output_tokens,
          }
        : undefined,
      cost: lastResult?.total_cost_usd,
    });
  }
}

// ============================================
// Process SDK Messages into Stream Events
// ============================================

function* processSDKMessage(message: SDKMessage): Generator<AgentStreamEvent> {
  switch (message.type) {
    case "assistant":
      // Full assistant message
      const content = message.message.content;
      for (const block of content) {
        if (block.type === "text") {
          yield { type: "message", data: { text: block.text } };
        } else if (block.type === "tool_use") {
          yield {
            type: "tool_use",
            data: {
              id: block.id,
              name: block.name,
              input: block.input,
            },
          };
        } else if (block.type === "thinking") {
          yield { type: "thinking", data: { thinking: (block as any).thinking } };
        }
      }
      break;

    case "stream_event":
      // Partial/streaming message
      const event = message.event;
      if (event.type === "content_block_delta") {
        const delta = event.delta as any;
        if (delta.type === "text_delta") {
          yield { type: "message", data: { text: delta.text, partial: true } };
        } else if (delta.type === "thinking_delta") {
          yield { type: "thinking", data: { thinking: delta.thinking, partial: true } };
        }
      }
      break;

    case "result":
      // Query result
      yield {
        type: "result",
        data: {
          success: message.subtype === "success",
          result: message.subtype === "success" ? (message as any).result : null,
          error: message.subtype !== "success" ? message.subtype : null,
          usage: message.usage,
          cost: message.total_cost_usd,
          turns: message.num_turns,
        },
      };
      break;

    case "system":
      // System messages
      if (message.subtype === "init") {
        yield {
          type: "status",
          data: {
            status: "initialized",
            tools: message.tools,
            model: message.model,
            mcpServers: message.mcp_servers,
          },
        };
      } else if (message.subtype === "status") {
        yield {
          type: "status",
          data: { status: message.status },
        };
      }
      break;

    case "tool_progress":
      // Tool execution progress
      yield {
        type: "tool_result",
        data: {
          toolName: message.tool_name,
          toolUseId: message.tool_use_id,
          elapsed: message.elapsed_time_seconds,
          inProgress: true,
        },
      };
      break;

    case "user":
      // User message (usually synthetic from tool results)
      if (message.tool_use_result !== undefined) {
        yield {
          type: "tool_result",
          data: {
            result: message.tool_use_result,
            inProgress: false,
          },
        };
      }
      break;
  }
}

// ============================================
// Simple Query (Non-Streaming)
// ============================================

export async function simpleAgentQuery(options: AgentQueryOptions): Promise<{
  success: boolean;
  result?: string;
  error?: string;
  usage?: any;
  cost?: number;
}> {
  const events: AgentStreamEvent[] = [];
  let resultText = "";

  for await (const event of runAgentQuery(options)) {
    events.push(event);

    if (event.type === "message" && !event.data.partial) {
      resultText += event.data.text || "";
    }

    if (event.type === "result") {
      return {
        success: event.data.success,
        result: event.data.result || resultText,
        error: event.data.error,
        usage: event.data.usage,
        cost: event.data.cost,
      };
    }

    if (event.type === "error") {
      return {
        success: false,
        error: event.data.message,
      };
    }
  }

  return {
    success: true,
    result: resultText,
  };
}

// ============================================
// Workflow Generation Specific Query
// ============================================

export async function generateWorkflowWithAgent(
  userId: string,
  description: string,
  existingWorkflowId?: string
): Promise<{
  success: boolean;
  workflowId?: string;
  error?: string;
  actions: Array<{ tool: string; result: any }>;
}> {
  const prompt = existingWorkflowId
    ? `Update the workflow with ID "${existingWorkflowId}" based on this request: ${description}`
    : `Create a new workflow based on this request: ${description}`;

  const actions: Array<{ tool: string; result: any }> = [];
  let workflowId: string | undefined;

  try {
    for await (const event of runAgentQuery({
      prompt,
      userId,
      workflowId: existingWorkflowId,
      maxTurns: 20, // Allow more turns for complex workflows
      traceType: "workflow_generation",
    })) {
      if (event.type === "tool_result" && !event.data.inProgress) {
        const result = event.data.result;
        if (result && typeof result === "object") {
          const parsed = typeof result === "string" ? JSON.parse(result) : result;
          actions.push({ tool: "unknown", result: parsed });
        }
      }

      if (event.type === "error") {
        console.error("[AgentService] Error event:", event.data);
        return {
          success: false,
          error: event.data.message,
          actions,
        };
      }
    }
  } catch (error) {
    console.error("[AgentService] Exception in generateWorkflowWithAgent:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      actions,
    };
  }

  // If we're updating an existing workflow and no new workflow was created,
  // return the existing workflow ID
  const finalWorkflowId = workflowId || existingWorkflowId;

  return {
    success: true,
    workflowId: finalWorkflowId,
    actions,
  };
}

// ============================================
// Planning/Chat Query - Enhanced for Workflow Planning
// ============================================

const PLANNING_SYSTEM_CONTEXT = `
You are Verxio, an expert workflow planning assistant. You help users brainstorm, design and refine automation workflows through conversation.

## Available Nodes
- Triggers: Telegram, WhatsApp, Webhook, Timed, Manual, Google Forms, Airtable, Stripe
- AI: Claude, GPT, Gemini
- Communication: Email, Slack, Discord, Telegram, WhatsApp
- Google: Sheets, Docs, Slides, Drive, Calendar
- Data: HTTP, Airtable, Firecrawl
- Logic: Code blocks, Decider

## Response Guidelines
- Keep responses SHORT and focused (2-4 paragraphs max)
- Use bullet points for lists
- Ask one clarifying question at a time
- No emojis, no excessive formatting
- Be direct and practical
- Ask clarifying questions to understand the full scope before suggesting solutions
- Break complex automations into manageable steps
- Explain trade-offs between different approaches
- Consider edge cases and error scenarios
- Suggest credentials and integrations the user will need
- Provide specific examples when explaining concepts
- Reference actual node types and their configurations


## When User Wants to Build
When user says "build it", "create the workflow", "let's do it", "yes", "go ahead", or similar:

1. Provide a BRIEF summary (3-5 lines) of what will be created
2. List the nodes in order: Trigger -> Action1 -> Action2...
3. Note any required credentials
4. Then IMMEDIATELY use your tools to build the workflow

## CRITICAL: Building Workflows
When building a workflow, you MUST:
1. Use the CURRENT WORKFLOW ID provided in the context (do NOT call createWorkflow - the workflow already exists)
2. Call addNode with the workflow ID for each node you want to add
3. Call configureNode to set up each node's data (prompts, credentials, settings)
4. Call connectNodes to connect nodes in sequence
5. After all nodes are added and connected, confirm to the user what was created

Example sequence for adding a Telegram trigger and Gemini AI node:
- addNode(workflowId: "<current_workflow_id>", nodeType: "TELEGRAM_TRIGGER", name: "Telegram Trigger", data: {...})
- addNode(workflowId: "<current_workflow_id>", nodeType: "GEMINI", name: "AI Analysis", data: {...})
- connectNodes(fromNodeId: "<trigger_id>", toNodeId: "<gemini_id>")

## Important
- ALWAYS use the current workflow ID when adding nodes - do NOT create a new workflow
- If user hasn't described what they want yet, ask what they'd like to automate
- Focus on understanding their needs before proposing solutions
`;

export async function* chatWithAgent(options: {
  userId: string;
  workflowId: string;
  message: string;
  conversationHistory: Array<{ role: string; content: string }>;
  learningContext?: {
    similarWorkflows?: Array<{ description: string; nodes: string[] }>;
    userPreferences?: Record<string, unknown>;
  };
}): AsyncGenerator<AgentStreamEvent> {
  // Build enhanced prompt with planning context and learning insights
  let enhancedPrompt = `${PLANNING_SYSTEM_CONTEXT}\n\n**IMPORTANT: You are working on an EXISTING workflow. The workflow ID is: ${options.workflowId}**\nWhen adding nodes, you MUST use this exact workflow ID: "${options.workflowId}"\n\n`;

  // Add learning context if available
  if (options.learningContext?.similarWorkflows?.length) {
    const similarPatterns = options.learningContext.similarWorkflows
      .slice(0, 3)
      .map((w, i) => `${i + 1}. ${w.description} (used: ${w.nodes.join(", ")})`)
      .join("\n");
    enhancedPrompt += `[Context: Similar workflows you've built before:\n${similarPatterns}]\n\n`;
  }

  enhancedPrompt += `User message: ${options.message}`;

  for await (const event of runAgentQuery({
    prompt: enhancedPrompt,
    userId: options.userId,
    workflowId: options.workflowId,
    conversationHistory: options.conversationHistory,
    maxTurns: 15,
    traceType: "chat",
  })) {
    yield event;
  }
}

// ============================================
// Smart Prompt Generation with Agent
// ============================================

export async function generateSmartPrompt(options: {
  userId: string;
  workflowId: string;
  conversationHistory: Array<{ role: string; content: string }>;
}): Promise<{ prompt: string; summary: string; suggestedNodes: string[] }> {
  const analysisPrompt = `Analyze this planning conversation and generate a comprehensive workflow specification.

CONVERSATION:
${options.conversationHistory.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")}

Generate a response in this exact format:

WORKFLOW_PROMPT:
[Write a detailed, actionable prompt that can be used to generate this workflow. Include specific requirements, data flows, and expected behaviors.]

SUMMARY:
[1-2 sentence summary of what this workflow does]

SUGGESTED_NODES:
[Comma-separated list of node types needed, e.g., TELEGRAM_TRIGGER, GEMINI, GOOGLE_SHEETS]

REQUIRED_CREDENTIALS:
[Comma-separated list of credential types needed]

Do not include any other text outside these sections.`;

  const result = await simpleAgentQuery({
    prompt: analysisPrompt,
    userId: options.userId,
    workflowId: options.workflowId,
    maxTurns: 5,
    traceType: "smart_prompt",
  });

  const responseText = result.result || "";

  // Parse the structured response
  const promptMatch = responseText.match(/WORKFLOW_PROMPT:\s*([\s\S]*?)(?=SUMMARY:|$)/i);
  const summaryMatch = responseText.match(/SUMMARY:\s*([\s\S]*?)(?=SUGGESTED_NODES:|$)/i);
  const nodesMatch = responseText.match(
    /SUGGESTED_NODES:\s*([\s\S]*?)(?=REQUIRED_CREDENTIALS:|$)/i
  );

  const prompt = promptMatch?.[1]?.trim() || conversationToBasicPrompt(options.conversationHistory);
  const summary = summaryMatch?.[1]?.trim() || "Workflow based on planning conversation";
  const suggestedNodes =
    nodesMatch?.[1]
      ?.trim()
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean) || [];

  return { prompt, summary, suggestedNodes };
}

// Fallback basic prompt generation
function conversationToBasicPrompt(history: Array<{ role: string; content: string }>): string {
  const requirements = history
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  return `Create a workflow based on these requirements:\n${requirements}`;
}

// ============================================
// Code Generation Query
// ============================================

export interface CodeGenerationOptions {
  userId: string;
  requirement: string;
  context?: Record<string, any>;
  language?: string;
  exampleOutput?: any;
}

export interface CodeGenerationResult {
  success: boolean;
  code?: string;
  dependencies?: string[];
  explanation?: string;
  error?: string;
}

export async function generateCodeWithAgent(
  options: CodeGenerationOptions
): Promise<CodeGenerationResult> {
  const { userId, requirement, context = {}, language = "typescript", exampleOutput } = options;

  // Build available inputs documentation
  const availableInputs = Object.keys(context);
  const inputDocs =
    availableInputs.length > 0
      ? availableInputs
          .map((name) => {
            const value = context[name];
            const sampleValue = JSON.stringify(value, null, 2).substring(0, 200);
            return `- inputs.${name}: ${sampleValue}${sampleValue.length >= 200 ? "..." : ""}`;
          })
          .join("\n")
      : "No specific inputs available";

  // Language-specific instructions
  const langName =
    language === "python" ? "Python" : language === "javascript" ? "JavaScript" : "TypeScript";
  const funcSignature =
    language === "python"
      ? "def execute(inputs: dict) -> dict:"
      : "export default async function execute(inputs: Record<string, any>): Promise<Record<string, any>>";

  const codeGenPrompt = `Generate ${langName} code for a CODE_BLOCK node.

REQUIREMENT: ${requirement}

AVAILABLE INPUTS FROM PREVIOUS NODES:
${inputDocs}

${exampleOutput ? `EXAMPLE OUTPUT FROM PREVIOUS NODE:\n${JSON.stringify(exampleOutput, null, 2)}\n` : ""}

CRITICAL RULES FOR CODE_BLOCK:
1. Use ${langName} syntax
2. Function signature: ${funcSignature}
3. ALWAYS use 'inputs' parameter to access previous node data (NEVER use 'context')
4. Return a plain ${language === "python" ? "dict" : "object"} with results
5. Handle errors by ${language === "python" ? "raising exceptions" : "throwing them"}
6. Keep code simple and focused

Generate ONLY the code, no explanations. The code should be production-ready and complete.`;

  try {
    const result = await simpleAgentQuery({
      prompt: codeGenPrompt,
      userId,
      maxTurns: 5,
      traceType: "code_generation",
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to generate code",
      };
    }

    // Extract code from the result
    const responseText = result.result || "";

    // Extract code block from response
    let code = responseText;
    const codeBlockMatch = responseText.match(/```(?:typescript|ts)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      code = codeBlockMatch[1].trim();
    }

    // Extract dependencies if mentioned
    const dependencies: string[] = [];
    const depMatch = responseText.match(/dependencies?:\s*\[(.*?)\]/i);
    if (depMatch) {
      const deps = depMatch[1].split(",").map((d) => d.trim().replace(/["']/g, ""));
      dependencies.push(...deps.filter((d) => d.length > 0));
    }

    return {
      success: true,
      code,
      dependencies,
      explanation: `Generated code for: ${requirement}`,
    };
  } catch (error) {
    console.error("[AgentService] Code generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during code generation",
    };
  }
}
