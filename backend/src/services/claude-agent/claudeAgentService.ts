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
import { createTrace, endTrace, type TraceMetadata } from "../opikService";

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

  // Build system prompt (now async to load guide content)
  const systemPrompt = await getVerxioSystemPrompt(userContext);

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
- Media: DESIGN (image generation), DESIGN_PRO (advanced image editing), ElevenLabs (text-to-speech), REMOTION (AI-powered video generation)

## Autonomous Image Generation

When users request images, slides, or visuals:
1. **Analyze Content:** If user provides content (e.g., blog post, script), analyze it to determine optimal number of images/slides OR follow explicit count (e.g., "5 slides")
2. **Choose Node Type:** 
   - Use **DESIGN** for standard quality output (default, faster, lower cost)
   - Use **DESIGN_PRO** when user requests: high quality, high resolution (1K/2K/4K), professional output, or advanced features
3. **JSON Prompt Format:** All DESIGN/DESIGN_PRO node prompts must be JSON strings with comprehensive specifications (see guides/image-generation-guide.txt). Never use plain string prompts.
4. **Multi-Image Pattern:** For presentations, slides, campaigns, or multiple images, use createMultipleDesignNodesTool with nodeType parameter ("DESIGN" or "DESIGN_PRO") to create multiple nodes connected in sequence
5. **Maintain Consistency:** When creating multiple images (e.g., presentation slides), keep the same structure and styling parameters across all images, only varying content-specific fields
6. **Post-Generation Actions:** After images are generated, consider actions like adding to Google Slides, packaging for download, or organizing in specific structure based on user intent

**DESIGN Node Details:**
- Prompt field MUST be JSON string (use JSON.stringify() when creating)
- Reference guides/image-generation-guide.txt for proper JSON structure
- Reference guides/social-media-design-guide.txt for ready-made prompts for flyers, Instagram, ads, landing pages, and business branding
- Aspect ratio: "16:9" for presentations, "1:1" for social posts, "9:16" for stories
- Template: "presentation_slide" for slides, "instagram_post" for Instagram, other templates as appropriate
- Output variables: design1, design2, etc. for sequential outputs
- Model: "gemini-2.5-flash-image" (default, standard quality)

**DESIGN_PRO Node Details:**
- Use DESIGN_PRO when user requests: high quality, high resolution (1K/2K/4K), professional output, or advanced features
- Model: "gemini-3-pro-image-preview" (default, recommended for Pro)
- Image size options: "1K" (default/standard), "2K" (high quality), "4K" (ultra high quality)
- Set imageSize to "2K" or "4K" when user requests high quality output
- For presentations requiring high quality, use DESIGN_PRO with imageSize: "2K" or "4K"
- Modes: generate (text-to-image, default), edit (edit existing image), editWithReferences (with up to 14 reference images)
- Reference images: Can be from previous nodes ({{design1.imageUrl}}), URLs, or base64
- Google Search: Enable for grounding and fact verification

**Brand Consistency (CRITICAL for Business Branding):**
- When creating multiple assets for the same brand (flyers, social posts, ads, etc.), ALWAYS establish brand foundation first
- Use the Brand Foundation Prompt from social-media-design-guide.txt to lock in visual consistency
- Maintain consistent colors, typography, and visual style across all branded assets
- Reference the established brand identity when creating any subsequent branded content

**REMOTION Node Details:**
- Use REMOTION for AI-powered video generation using Remotion framework
- Users provide a text description of the video they want to create
- Supports multiple video formats: 16:9 (landscape), 9:16 (portrait), 1:1 (square), 4:3, 21:9 (ultrawide)
- Can add background audio (optional) with volume control
- Can add multiple assets (images, videos, audio) with scene descriptions
- Claude automatically generates Remotion code based on the description
- Video parameters (duration, fps, dimensions) are auto-detected from the prompt
- Output Structure:
  - The node outputs a variable (default: "remotion") containing an object with videoUrl (string) and success (boolean)
  - Also outputs videoUrl directly for convenience
  - To access in subsequent nodes: Use inputs.[variableName].videoUrl or inputs.videoUrl
  - Example: If variable name is "remotion", access via inputs.remotion.videoUrl or inputs.videoUrl

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

## CRITICAL: Building/Updating Workflows
When building or updating a workflow from the plan node, you MUST:
1. **ALWAYS use the EXISTING WORKFLOW ID** provided in the context - the workflow already exists on the canvas
2. **NEVER call createWorkflow** - this will create a duplicate workflow and break the canvas
3. **REPLACE existing nodes** - If the workflow already has nodes, you should:
   - First, delete existing nodes using deleteNode (if needed to replace them)
   - Then add new nodes using addNode with the existing workflowId
   - This ensures the new workflow replaces the old one on the canvas
4. Call addNode with the workflow ID for each node you want to add
5. Call configureNode to set up each node's data (prompts, credentials, settings, model - model is REQUIRED for AI nodes)
6. Call connectNodes to connect nodes in sequence
7. After all nodes are added and connected, confirm to the user what was created/updated

Example sequence for replacing/adding nodes:
- getWorkflow(workflowId: "<current_workflow_id>") - Check existing nodes
- deleteNode(nodeId: "<old_node_id>") - Delete old nodes if replacing
- addNode(workflowId: "<current_workflow_id>", nodeType: "TELEGRAM_TRIGGER", name: "Telegram Trigger", data: {...})
- addNode(workflowId: "<current_workflow_id>", nodeType: "GEMINI", name: "AI Analysis", data: {model: "gemini-2.5-flash", ...})
- configureNode(nodeId: "<gemini_id>", config: {model: "gemini-2.5-flash", userPrompt: "...", credentialId: "..."})
- connectNodes(fromNodeId: "<trigger_id>", toNodeId: "<gemini_id>")

## Important
- ALWAYS use the current workflow ID when adding nodes - do NOT create a new workflow
- When generating a new workflow, REPLACE existing nodes to avoid duplicates on canvas
- Model field is REQUIRED for all AI nodes (ANTHROPIC, OPENAI, GEMINI) - must be explicitly set
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
  let enhancedPrompt = `${PLANNING_SYSTEM_CONTEXT}\n\n**CRITICAL: You are working on an EXISTING workflow that is already on the canvas. The workflow ID is: ${options.workflowId}**\n\n**IMPORTANT RULES:**\n1. NEVER call createWorkflow - the workflow already exists\n2. ALWAYS use workflowId: "${options.workflowId}" when adding/updating nodes\n3. When generating a new workflow, REPLACE existing nodes (delete old ones if needed, then add new ones)\n4. This ensures the new workflow replaces the old one on the canvas instead of creating duplicates\n\n`;

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
    language === "python"
      ? "Python"
      : language === "javascript"
        ? "JavaScript"
        : language === "rust"
          ? "Rust"
          : language === "anchor"
            ? "Anchor (Solana program, Rust-based)"
            : "TypeScript";
  const funcSignature =
    language === "python"
      ? "def execute(inputs: dict) -> dict:"
      : language === "rust"
        ? "Use a main() or #[no_mangle] pub extern fn execute-style entry; read inputs from env/json as needed."
        : language === "anchor"
          ? "Use Anchor program with instruction handlers and accounts; integrate with workflow inputs as needed."
          : "export default async function execute(inputs: Record<string, any>): Promise<Record<string, any>>";

  const codeGenPrompt = `Generate ${langName} code for a CODE_BLOCK node.

REQUIREMENT: ${requirement}

AVAILABLE INPUTS FROM PREVIOUS NODES:
${inputDocs}

${exampleOutput ? `EXAMPLE OUTPUT FROM PREVIOUS NODE:\n${JSON.stringify(exampleOutput, null, 2)}\n` : ""}

CRITICAL RULES FOR CODE_BLOCK:
1. Use ${langName} syntax
2. ${funcSignature}
3. ALWAYS use 'inputs' or equivalent to access previous node data (NEVER use 'context')
4. Return a plain ${language === "python" ? "dict" : "object"} with results (or JSON-serializable output)
5. Handle errors appropriately
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

    // Extract code block from response (support typescript, rust, anchor, python, etc.)
    let code = responseText;
    const codeBlockMatch = responseText.match(
      /```(?:typescript|ts|rust|anchor|python|py)?\s*([\s\S]*?)```/
    );
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

/** Template categories – must match client TEMPLATE_CATEGORIES in export-workflow-template-dialog */
export const TEMPLATE_CATEGORIES = [
  "Automation",
  "Marketing",
  "DevOps",
  "Data & Analytics",
  "Integrations",
  "Notifications",
  "Developer Tools",
  "Other",
] as const;

export interface TemplateMetadataResult {
  success: boolean;
  name?: string;
  shortDescription?: string;
  howItWorks?: string;
  requirements?: string;
  category?: string;
  error?: string;
}

/**
 * Generate template metadata (name, shortDescription, howItWorks, requirements, category) from a workflow
 * using the Verxio agent. The agent uses getWorkflow to read the workflow and produces
 * descriptive, keyword-rich metadata suitable for a workflow template.
 */
export async function generateTemplateMetadataForWorkflow(
  userId: string,
  workflowId: string
): Promise<TemplateMetadataResult> {
  const categoriesList = TEMPLATE_CATEGORIES.join(", ");
  const prompt = `Use getWorkflow("${workflowId}") to load the current workflow. Based on its nodes, connections, and purpose, produce template metadata for exporting this workflow as a template.

Return ONLY a valid JSON object with exactly these keys (no markdown, no code fence):
- "name": A descriptive, keyword-rich title for the template (e.g. "Send Slack alert when Stripe payment succeeds")
- "shortDescription": One or two sentences summarizing what the workflow does
- "howItWorks": A clear, multi-line explanation of how it works, step by step. Include required API keys or credentials in this section if relevant.
- "requirements": Multi-line text like howItWorks. List any required API keys, credentials, or external setup (e.g. "Stripe webhook secret", "Slack bot token", setup steps). Use "None" if nothing is required.
- "category": MUST be exactly one of: ${categoriesList}. Pick the single best match for this workflow.

Output nothing else except this JSON object.`;

  try {
    const result = await simpleAgentQuery({
      prompt,
      userId,
      workflowId,
      maxTurns: 10,
      traceType: "template_metadata",
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to generate template metadata",
      };
    }

    const text = (result.result || "").trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    const parsed = JSON.parse(jsonStr) as Record<string, string>;

    // Normalize category to a valid TEMPLATE_CATEGORIES value if present
    let category = parsed.category ?? "";
    if (
      category &&
      !TEMPLATE_CATEGORIES.includes(category as (typeof TEMPLATE_CATEGORIES)[number])
    ) {
      // Pick closest match or "Other"
      const match = TEMPLATE_CATEGORIES.find((c) =>
        c.toLowerCase().includes(String(category).toLowerCase())
      );
      category = match ?? "Other";
    }

    return {
      success: true,
      name: parsed.name ?? "",
      shortDescription: parsed.shortDescription ?? "",
      howItWorks: parsed.howItWorks ?? "",
      requirements: parsed.requirements ?? undefined,
      category: category || undefined,
    };
  } catch (error) {
    console.error("[AgentService] Template metadata generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error generating template metadata",
    };
  }
}
