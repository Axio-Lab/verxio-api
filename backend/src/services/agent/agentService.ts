/**
 * Agent Service
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
import { getComposioMcpUrl } from "../composio/composioService";
import { checkFeatureAccess } from "../subscriptionCheck";
import { SUBSCRIPTION_FEATURES } from "../../config/subscription-features";
import { consumePremiumQuota } from "../subscriptionService";
import { QUOTA_COST } from "../../config/rate-limits";

const prisma = basePrismaClient as any;

// ============================================
// Types
// ============================================

export interface MediaAttachment {
  type: "image" | "file" | "document";
  url?: string;
  base64?: string;
  mimeType?: string;
  fileName?: string;
  extractedText?: string;
}

export interface AgentQueryOptions {
  prompt: string;
  userId: string;
  workflowId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  includeUserConnections?: boolean;
  model?: string;
  maxTurns?: number;
  abortController?: AbortController;
  /** Media attachments from the user (images, audio, video, documents) */
  attachments?: MediaAttachment[];
  /** Type of agent query for Opik tracing categorization */
  traceType?: TraceMetadata["traceType"];
  /** Agent personality for soul.md injection */
  agentPersonality?: AgentPersonality;
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

  // Get user's skills (include id for integration skill filtering)
  const skills = await prisma.userSkill.findMany({
    where: { userId },
    select: { id: true, name: true, description: true, content: true },
  });

  return {
    userId,
    workflowId,
    availableCredentials: credentials,
    userConnections: connections,
    userSkills: skills,
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
    model = process.env.AGENT_CLAUDE_MODEL,
    maxTurns = 10,
    abortController,
    attachments,
    traceType = "agent_query",
    agentPersonality,
  } = options;

  // Create Opik trace for observability (with input so Opik captures prompt + context)
  const traceInput: Record<string, unknown> = {
    prompt: prompt.length > 8000 ? `${prompt.slice(0, 8000)}... [truncated]` : prompt,
    model,
    maxTurns,
    conversationHistoryLength: conversationHistory?.length ?? 0,
    ...(workflowId && { workflowId }),
  };
  const traceContext = createTrace(
    traceType,
    {
      userId,
      workflowId,
      traceType,
      model,
      promptLength: prompt.length,
      hasConversationHistory: !!conversationHistory?.length,
    },
    traceInput
  );

  // Create tool context (include soul evolution info and skill scope when personality is set)
  const toolContext: ToolContext = {
    userId,
    workflowId,
    integrationId: agentPersonality?.integrationId,
    evolvePersonality: agentPersonality?.evolvePersonality,
    skillScope: agentPersonality?.skillScope,
    allowedSkillIds: agentPersonality?.allowedSkillIds,
  };

  // Create Verxio MCP server with custom tools
  const verxioMcpServer = createSdkMcpServer({
    name: "verxio-workflow",
    version: "1.0.0",
    tools: createVerxioMcpTools(toolContext),
  });

  // Check if user has Composio access (premium feature)
  let hasComposioAccess = false;
  try {
    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.COMPOSIO_ACTION_NODE);
    hasComposioAccess = true;
  } catch {
    // Free user, skip Composio
  }

  // Load user's MCP connections, Composio, and user context in parallel
  let userMcpServers: Record<string, McpServerConfig> = {};
  let composioMcpConfig: McpServerConfig | undefined;
  let userContext: Awaited<ReturnType<typeof getUserContext>>;
  if (includeUserConnections) {
    const [mcpServers, context, composioUrl] = await Promise.all([
      loadUserMcpServers(userId),
      getUserContext(userId, workflowId),
      hasComposioAccess
        ? getComposioMcpUrl(userId).catch((err) => {
            console.error("[Composio] Failed to load MCP URL:", err);
            return null;
          })
        : Promise.resolve(null),
    ]);
    userMcpServers = mcpServers;
    userContext = context;
    if (composioUrl) {
      composioMcpConfig = { type: "http", url: composioUrl };
    }
  } else {
    const [context, composioUrl] = await Promise.all([
      getUserContext(userId, workflowId),
      hasComposioAccess
        ? getComposioMcpUrl(userId).catch((err) => {
            console.error("[Composio] Failed to load MCP URL:", err);
            return null;
          })
        : Promise.resolve(null),
    ]);
    userContext = context;
    if (composioUrl) {
      composioMcpConfig = { type: "http", url: composioUrl };
    }
  }

  // Filter skills based on integration config (when from chat integration)
  if (agentPersonality?.skillScope !== undefined) {
    const allSkills = userContext.userSkills as Array<{
      id: string;
      name: string;
      description?: string | null;
      content: string;
    }>;
    let filteredSkills: typeof allSkills;
    if (agentPersonality.skillScope === "NO_SKILLS") {
      filteredSkills = [];
    } else if (
      agentPersonality.skillScope === "SELECTED_SKILLS" &&
      agentPersonality.allowedSkillIds?.length
    ) {
      filteredSkills = allSkills.filter((s) => agentPersonality.allowedSkillIds!.includes(s.id));
    } else {
      filteredSkills = allSkills; // ALL_SKILLS or no restriction
    }
    userContext = { ...userContext, userSkills: filteredSkills };
  }

  // Build system prompt (now async to load guide content)
  const systemPrompt = await getVerxioSystemPrompt(userContext);

  // Enrich prompt with media attachment info when present
  let enrichedPrompt = prompt;
  if (attachments && attachments.length > 0) {
    const mediaDescriptions: string[] = [];
    for (const att of attachments) {
      const label = att.fileName || att.type;
      if (att.extractedText) {
        mediaDescriptions.push(`[${label} content]\n${att.extractedText}`);
      } else if (att.url) {
        const mime = att.mimeType || "";
        if (mime.startsWith("image/")) {
          mediaDescriptions.push(`[User shared an image: ${label}]\nURL: ${att.url}`);
        } else if (mime.startsWith("audio/")) {
          mediaDescriptions.push(`[User shared an audio file: ${label}]\nURL: ${att.url}\nNote: use browseWebsite or a transcription tool to process this audio if needed.`);
        } else if (mime.startsWith("video/")) {
          mediaDescriptions.push(`[User shared a video file: ${label}]\nURL: ${att.url}\nNote: use browseWebsite or a media processing tool to handle this video if needed.`);
        } else {
          mediaDescriptions.push(`[User shared a file: ${label}]\nURL: ${att.url}`);
        }
      } else if (att.base64 && att.mimeType?.startsWith("image/")) {
        mediaDescriptions.push(`[User shared an image: ${label}] (base64 data provided, ${att.mimeType})`);
      } else {
        mediaDescriptions.push(`[User shared a file: ${label}]`);
      }
    }
    enrichedPrompt = `${prompt}\n\n--- User Attachments ---\n${mediaDescriptions.join("\n\n")}`;
  }

  // Build conversation context if exists
  let fullPrompt = enrichedPrompt;
  if (conversationHistory && conversationHistory.length > 0) {
    const historyText = conversationHistory
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n\n");
    fullPrompt = `Previous conversation:\n${historyText}\n\nCurrent request: ${enrichedPrompt}`;
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
          ...(composioMcpConfig ? { composio: composioMcpConfig } : {}),
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
    // End the Opik trace and log one span with agent input + output in one go
    await endTrace(
      traceContext,
      {
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
      },
      traceInput
    );
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
- Data: HTTP, Airtable
- Logic: Code blocks, Decider
- Media: DESIGN (image generation), DESIGN_PRO (advanced image editing), SEEDREAM (BytePlus image generation), REMOTION (AI-powered video generation), VEO (Google Veo video), SEEDANCE (BytePlus video generation), Kling nodes (video/image/TTS)
- Composio: 10,000+ actions across 800+ apps (GitHub, Notion, Linear, Jira, HubSpot, Salesforce, ElevenLabs, Firecrawl, and more)

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

## Workflow vs Single-Node: Choose Based on User Intent (CRITICAL)
Read the conversation to decide whether the user needs a **workflow** (multi-step automation) or a **single action** (one node, then return the result in chat).

**When to BUILD A WORKFLOW:**
- User wants multi-step automation (e.g. "research X, create content with X, send the result to Y")
- User wants something repeatable or triggered by events (e.g. "when I get a form response, do A then B")
- User explicitly asks to "create a workflow", "automate", "build a bot"

**When to RUN A SINGLE NODE and RETURN THE RESULT:**
- User asks for a one-off action and expects an answer in the chat (e.g. "check my calendar for the day", "book a meeting with X", "list my events", "do X")
- One node can fulfill the request (e.g. GOOGLE_CALENDAR list events, GOOGLE_MEET create link, DESIGN generate one image)
- User says "do it", "help me do X", "can you book/check/list/create X" and expects confirmation or data back

**Single-node path: use the right standard node first.**
- You have access to **all existing node types** (same as for workflows) plus **Composio** for 10,000+ actions across 800+ apps. For a single task, **prefer Composio for common app operations** (email, calendar, project management, CRM, TTS, web scraping, etc.) and **native nodes for media generation** (DESIGN/DESIGN_PRO for images, VEO/REMOTION/SEEDANCE for video, KLING for video/image/TTS, SEEDREAM for images). Use listNodeTypes or the Available Nodes list above to pick the right one.
- **Use CODE_BLOCK or other custom/special nodes only when needed** (e.g. custom logic, one-off script, or no standard node matches the task). Do not default to a custom node when a standard node exists for the task.

**Single-node steps (executeSingleNodeAndWait):**
0. **Before adding or running:** Tell the user what you'll do (which node, how you'll set it up, that you'll run it and return the result). Give them a chance to request changes (e.g. "use next week", "use work calendar") or say "go ahead." Like the plan node—user can review before execution. **If the user has already said "yes", "yes add it", "go ahead", "do it", "yeah", "create it", "use the same email", or similar, that is approval—proceed in this turn; do not ask "Should I proceed?" again.**
0b. **CRITICAL — When user has approved, you MUST call the tools in the SAME turn.** If the user said "yes", "yeah", "go ahead", "create it", "proceed", "use the same email", or any clear approval, your very next response MUST include the actual tool calls (addNode, configureNode, executeSingleNodeAndWait). Do NOT send a message that only says "Proceeding now..." or "I'll create it now" without invoking the tools—that is not executing; the user would have to say "go ahead" again. Approval = execute immediately in the same turn; never reply with "Proceeding now" and then wait for another message.
1. Ensure the workflow has the right node: use getWorkflow to check; if not, use addNode then configureNode. **Fill all required fields** (credentialId, model for AI, action for calendar, etc.); tell the user if anything is required and missing. Nodes are saved to the workflow when you add/configure. Choose the **standard node type** that matches the task (calendar → GOOGLE_CALENDAR, image → DESIGN, etc.).
2. Optionally pass one-off params via nodeOverrides (e.g. timeMin/timeMax for "today", or a prompt for this run only).
3. Call executeSingleNodeAndWait(workflowId, nodeId, nodeOverrides).
4. In your **very next reply**, summarize the tool's output in **human language** and send that to the user (e.g. "You have 3 events today: ...", "Meeting booked with X at ...", "Here’s what I found: ..."). Do not dump raw JSON; turn the result into a short, readable summary.

**If the single-node execution fails (success: false),** tell the user in plain language what went wrong (e.g. "I couldn’t read your calendar because ...") and suggest fixing credentials or trying again.

## Plan Mode: Plan First, Build Only After Approval (CRITICAL)
The goal of plan mode is to **deeply plan with the user**. You must NEVER zoom off and build a workflow until the user has seen and approved a plan.

**1. Always present a plan for review first**
- When the user wants a workflow (e.g. "build a Telegram bot", "create the workflow", "I want to automate X"), respond with a **clear, reviewable plan**:
  - **Summary**: 2–4 sentences of what the workflow will do
  - **Nodes in order**: Trigger → Node1 → Node2 → … (with brief purpose for each)
  - **Required credentials**: What the user must connect (e.g. Telegram, Anthropic)
  - **Trade-offs or alternatives**: If relevant (e.g. "We could use Webhook instead of Telegram if you prefer")
- Invite the user to **review and suggest changes**: e.g. "Review this plan and tell me what you’d like to change, or say **yes, build it** when you’re ready."
- Do NOT call addNode, configureNode, connectNodes, deleteNode, or createWorkflow in this same turn. Only output the plan.

**2. Build only after explicit approval**
- Use your workflow-modifying tools (addNode, configureNode, connectNodes, deleteNode) **only when**:
  - You have already shown a plan in this conversation, AND
  - The user has explicitly approved it (e.g. "yes build it", "looks good, go ahead", "approved", "build it as planned", "yes", "go ahead").
- If the user says "build it" or "create the workflow" but you have **not** yet shown a plan in this thread, do **not** build yet: first output the plan, then ask them to confirm or request changes.
- If the user requests changes to the plan, update the plan in your reply and again ask for review/approval before building.
- **Do not ask for confirmation twice in workflow (multi-node) mode.** If you already showed a plan and the user replied with a clear yes (e.g. "yes", "yes build it", "go ahead", "approved", "looks good", "do it"), treat that as approval and **build in this turn**. Do not respond with "Should I proceed?" or "Say 'yes, build it' to continue"—they already approved; call addNode/configureNode/connectNodes now.

**3. Deep planning with the user**
- Prefer one clarifying question at a time when the request is vague.
- Offer alternatives when there are multiple valid designs (e.g. different triggers or node types).
- If the user asks to "build it" or says "yes" / "go ahead" and you have already presented a plan and they haven’t asked for changes, treat that as approval and **build in the same turn**—do not ask again for confirmation.

## Saving nodes and filling all fields (CRITICAL)
- **addNode, configureNode, and connectNodes persist to the workflow**—the same way as when building a workflow. Every node you add or configure is saved to the user's workflow and appears on the canvas.
- **You have full access to all node types and must fill all required fields** for each node (e.g. credentialId for Google/Telegram nodes, model for AI nodes, action for GOOGLE_CALENDAR, calendarId if needed). Use getWorkflow and listNodeTypes; use getCredentials to find valid credential IDs. **For action-based nodes (e.g. GOOGLE_CALENDAR, GOOGLE_SHEETS), call getNodeSchema(nodeType) to get the exact action names and fields** (e.g. GOOGLE_CALENDAR uses action "listEvents" not "list"). If something is required and missing (e.g. no Google credential), **tell the user clearly**: "I need X to do this. You can [connect one in Settings / use your existing 'Y' credential]. Should I use Y, or will you add one?"
- **For GOOGLE_CALENDAR createEvent:** You must **always ask the user where the meeting will be held** before creating the event. Their answer tells you whether to create a Meet link: "Where will the meeting be held — in-person at a physical location, online (Google Meet), or both?" If in-person → set location (address/place). If online/virtual → set addMeetLink: true (no location). If both → set location and addMeetLink: true. Do not create the event until you know this; it determines whether the event gets a Meet link.
- **Tell the user what you're doing before you start execution.** Like the plan node, give the user a chance to review and make changes before you run anything. For example: "I'll add a Google Calendar node to list your events for this week, use your Google account, then run it and show you the results. If you want a different date range or calendar, say so now—otherwise say **go ahead** and I'll run it." Do not call addNode/configureNode/executeSingleNodeAndWait without first stating your plan in that turn or a previous turn and giving the user a moment to respond (unless they already said "go ahead" or "do it" and you just described the plan).
- **Do not ask for confirmation twice.** If you offered a follow-up (e.g. "Would you like to add a Meet link?") and the user replied with a clear yes—e.g. "yes", "yeah", "yes add it", "go ahead", "do it", "please do", "sure", "add it"—treat that as approval and **call the tools (addNode/configureNode/executeSingleNodeAndWait) in that same turn**. Do not send a reply that only says "Proceeding now..." or "I'll create it" without making the tool calls; that forces the user to say "go ahead" again. Approval = execute in the same response.
- For **workflow builds**, the plan (summary, nodes, credentials) is this "tell the user what you're doing"; only build after they approve. For **single-node execution**, briefly state what node you'll add, how you'll configure it, and that you'll run it and return the result—then run only after they confirm or say go ahead, or if the conversation already implied approval.

## CRITICAL: Building/Updating Workflows
When building or updating a workflow from the plan node, you MUST:
1. **ALWAYS use the EXISTING WORKFLOW ID** provided in the context - the workflow already exists on the canvas
2. **NEVER call createWorkflow** - this will create a duplicate workflow and break the canvas
3. **REPLACE existing nodes** - If the workflow already has nodes, you should:
   - First, delete existing nodes using deleteNode (if needed to replace them)
   - Then add new nodes using addNode with the existing workflowId
   - This ensures the new workflow replaces the old one on the canvas
4. Call addNode with the workflow ID for each node you want to add
5. Call configureNode to set up each node's data (prompts, credentials, settings, model - model is REQUIRED for AI nodes). Fill all required fields; tell the user if anything is missing.
6. Call connectNodes to connect nodes in sequence
7. After all nodes are added and connected, confirm to the user what was created/updated (nodes are saved to the workflow)

Example sequence for replacing/adding nodes:
- getWorkflow(workflowId: "<current_workflow_id>") - Check existing nodes
- deleteNode(nodeId: "<old_node_id>") - Delete old nodes if replacing
- addNode(workflowId: "<current_workflow_id>", nodeType: "TELEGRAM_TRIGGER", name: "Telegram Trigger", data: {...})
- addNode(workflowId: "<current_workflow_id>", nodeType: "GEMINI", name: "AI Analysis", data: {model: "gemini-2.5-flash", ...})
- configureNode(nodeId: "<gemini_id>", config: {model: "gemini-2.5-flash", userPrompt: "...", credentialId: "..."})
- connectNodes(fromNodeId: "<trigger_id>", toNodeId: "<gemini_id>")

## Important
- **Plan first, build after approval**: Always show a reviewable plan before using any workflow-modifying tools; only build when the user explicitly approves.
- **Tell the user what you're doing before execution** (single-node or workflow): like the plan node, give them a chance to review and request changes before you run. Nodes you add/configure are saved to the workflow.
- **Fill all required fields** for each node; tell the user clearly if something is required and missing (e.g. credentials, calendar ID).
- ALWAYS use the current workflow ID when adding nodes - do NOT create a new workflow
- When generating a new workflow, REPLACE existing nodes to avoid duplicates on canvas
- Model field is REQUIRED for all AI nodes (ANTHROPIC, OPENAI, GEMINI) - must be explicitly set
- If user hasn't described what they want yet, ask what they'd like to automate
- Focus on understanding their needs before proposing solutions
`;

export interface AgentPersonality {
  name: string;
  soulMd: string;
  evolvePersonality: boolean;
  integrationId?: string;
  /** Skill access for chat integration: scope and allowed skill IDs when SELECTED_SKILLS */
  skillScope?: "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS";
  allowedSkillIds?: string[];
}

export async function* chatWithAgent(options: {
  userId: string;
  workflowId: string;
  message: string;
  conversationHistory: Array<{ role: string; content: string }>;
  learningContext?: {
    similarWorkflows?: Array<{ description: string; nodes: string[] }>;
    userPreferences?: Record<string, unknown>;
  };
  agentPersonality?: AgentPersonality;
  attachments?: MediaAttachment[];
}): AsyncGenerator<AgentStreamEvent> {
  // Build soul/personality preamble if available
  let soulPreamble = "";
  if (options.agentPersonality?.soulMd) {
    const { name, soulMd, evolvePersonality } = options.agentPersonality;
    soulPreamble = `## Your Identity
Your name is **${name}**. You are the user's personal workflow and automation assistant.
When asked "who are you", respond with your name and personality — you are ${name}, powered by Verxio.

## Your Personality (soul.md)
${soulMd}

${
  evolvePersonality
    ? `## Personality Evolution
You may refine your personality over time. If you notice patterns in how the user prefers to interact, you can propose an update to your soul by calling the updateSoulMd tool. Only do this when you have clear evidence of user preferences, not speculatively.\n`
    : ""
}
---

`;
  }

  // Build enhanced prompt with planning context and learning insights
  let enhancedPrompt = `${soulPreamble}${PLANNING_SYSTEM_CONTEXT}\n\n**CRITICAL: You are working on an EXISTING workflow that is already on the canvas. The workflow ID is: ${options.workflowId}**\n\n**IMPORTANT RULES:**\n1. NEVER call createWorkflow - the workflow already exists\n2. ALWAYS use workflowId: "${options.workflowId}" when adding/updating nodes\n3. When generating a new workflow, REPLACE existing nodes (delete old ones if needed, then add new ones)\n4. This ensures the new workflow replaces the old one on the canvas instead of creating duplicates\n\n`;

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
    attachments: options.attachments,
    maxTurns: 15,
    traceType: "chat",
    agentPersonality: options.agentPersonality,
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
