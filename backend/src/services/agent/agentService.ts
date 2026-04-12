/**
 * Agent Service
 *
 * Core orchestration layer for Verxio's agent operations platform.
 * Wraps the Claude Agent SDK with Verxio MCP tools, user connections,
 * subagent delegation, and production-hardened defaults for business
 * and vertical-industry use cases.
 */

import {
  query,
  tool,
  createSdkMcpServer,
  type SDKMessage,
  type Query,
  type McpServerConfig,
  type SdkMcpToolDefinition,
  type AgentDefinition,
} from "@anthropic-ai/claude-agent-sdk";
import { basePrismaClient } from "../../lib/prisma";
import { getVerxioToolsForContext, type ToolContext } from "./verxio-mcp-tools";
import { getVerxioSystemPrompt } from "./verxio-system-prompt";
import * as connectionService from "../connectionService";
import { getComposioMcpUrl, listConnectedAccounts } from "../composio/composioService";
import { checkFeatureAccess } from "../subscriptionCheck";
import { SUBSCRIPTION_FEATURES } from "../../config/subscription-features";

const prisma = basePrismaClient as any;

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_BUDGET_USD = 2.0;
const TEXT_GEN_MAX_BUDGET_USD = 0.5;

const AGENT_BUILTIN_TOOLS = [
  "Read",
  "Glob",
  "Grep",
  "Edit",
  "Bash",
  "WebSearch",
  "WebFetch",
  "Agent",
];

function getModel(override?: string): string {
  return override || process.env.AGENT_CLAUDE_MODEL || DEFAULT_MODEL;
}

function stderrHandler(data: string): void {
  if (data.trim()) {
    console.error("[AgentSDK]", data.trimEnd());
  }
}

function getBuiltinSubagents(mcpServerNames: string[]): Record<string, AgentDefinition> {
  return {
    "ops-researcher": {
      description:
        "Research specialist for business operations, industry data, APIs, integrations, and documentation. " +
        "Use when you need to look up how an external API works, research industry-specific solutions, " +
        "find documentation, or gather information about services and integrations.",
      prompt:
        "You are a research specialist on Verxio, an agent operations platform built for businesses " +
        "and vertical industries. Your role is to gather accurate, detailed, and actionable information " +
        "about APIs, services, integrations, industry practices, compliance requirements, and documentation " +
        "that users need for their operations. Always cite sources. Tailor your findings to the user's " +
        "specific industry context when possible (e.g. healthcare, real estate, logistics, finance, " +
        "hospitality, retail, education).",
      tools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
      mcpServers: mcpServerNames,
      model: "sonnet",
      maxTurns: 8,
    },
    "content-writer": {
      description:
        "Content creation specialist for producing documents, reports, emails, marketing copy, SOPs, " +
        "proposals, and any written deliverable. Use when a task requires writing, drafting, or " +
        "producing structured text output.",
      prompt:
        "You are a professional content writer on Verxio. You produce high-quality business documents, " +
        "reports, emails, marketing copy, SOPs, proposals, and written deliverables. Write in a direct, " +
        "professional tone. Structure output clearly. Adapt your style to the user's industry context. " +
        "When you need facts or data, delegate research to the ops-researcher agent. Focus on producing " +
        "polished, ready-to-use output.",
      tools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
      mcpServers: mcpServerNames,
      model: "sonnet",
      maxTurns: 8,
    },
    "data-analyst": {
      description:
        "Data analysis and processing specialist. Use when a task requires analyzing data, " +
        "generating insights, comparing options, building spreadsheets, or producing analytical output.",
      prompt:
        "You are a data analyst on Verxio. You analyze data, extract insights, compare alternatives, " +
        "build structured datasets, and produce analytical summaries. Be precise with numbers and sources. " +
        "When you need to fetch data or research, use WebSearch/WebFetch or delegate to the ops-researcher. " +
        "Present findings with clear structure: key takeaways first, then supporting detail.",
      tools: ["Read", "Glob", "Grep", "Bash", "WebSearch", "WebFetch"],
      mcpServers: mcpServerNames,
      model: "sonnet",
      maxTurns: 8,
    },
    "task-executor": {
      description:
        "Action-oriented executor for carrying out concrete operations: creating documents via Composio, " +
        "sending communications, running integrations, executing code, and completing well-defined tasks.",
      prompt:
        "You are a task executor on Verxio. You carry out concrete operations: creating documents, " +
        "sending emails, updating spreadsheets, running API calls, and executing integrations via " +
        "Composio and MCP tools. Execute precisely what is asked. Report what was done and any outputs " +
        "(URLs, IDs, confirmation details). If a prerequisite is missing (credentials, connections), " +
        "report it clearly rather than guessing.",
      tools: AGENT_BUILTIN_TOOLS,
      mcpServers: mcpServerNames,
      model: "sonnet",
      maxTurns: 10,
    },
  };
}

async function buildSubagents(
  mcpServerNames: string[],
  userId?: string
): Promise<Record<string, AgentDefinition>> {
  const agents = getBuiltinSubagents(mcpServerNames);

  if (!userId) return agents;

  try {
    const { getActiveSubagents, loadSubagentWithSkills } = await import("../customSubagentService");
    const customAgents = await getActiveSubagents(userId);

    for (const custom of customAgents) {
      const loaded = await loadSubagentWithSkills(userId, custom.id);
      if (!loaded) continue;

      const skillPromptSection = loaded.skillContent ? `\n\n## Skills\n${loaded.skillContent}` : "";

      agents[loaded.slug] = {
        description: loaded.description,
        prompt: `${loaded.prompt}${skillPromptSection}`,
        tools:
          loaded.tools.length > 0
            ? loaded.tools
            : ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
        mcpServers: mcpServerNames,
        model: loaded.model || "sonnet",
        maxTurns: loaded.maxTurns || 8,
      };
    }
  } catch (err) {
    console.error("[AgentService] Failed to load custom subagents:", err);
  }

  return agents;
}

// ============================================
// Simple Text Generation (no MCP, no tools)
// ============================================
// Single-turn query for lightweight LLM text generation (JSON extraction,
// classification, formatting) without tool access.

export async function generateTextWithSystemPrompt(options: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
}): Promise<{ text: string }> {
  const model = getModel(options.model);

  try {
    const result = query({
      prompt: options.userPrompt,
      options: {
        model,
        systemPrompt: options.systemPrompt,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        tools: [],
        maxTurns: 1,
        maxBudgetUsd: TEXT_GEN_MAX_BUDGET_USD,
        effort: "low",
        persistSession: false,
        stderr: stderrHandler,
      },
    });

    let text = "";
    for await (const message of result) {
      if (message.type === "assistant" && message.message?.content) {
        for (const block of message.message.content) {
          if (block.type === "text") text += block.text;
        }
      }
      if (message.type === "result") {
        const r = message as any;
        if (r.subtype === "success" && typeof r.result === "string") {
          text = r.result;
        } else if (r.subtype !== "success") {
          console.error("[AgentService] Text generation ended with:", r.subtype);
        }
        break;
      }
    }
    return { text };
  } catch (error) {
    console.error("[AgentService] generateTextWithSystemPrompt failed:", error);
    return { text: "" };
  }
}

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
  /** When true, workflow-graph-mutation tools are omitted (dashboard / coworker chat). */
  isGeneralChat?: boolean;
}

export interface AgentStreamEvent {
  type: "message" | "tool_use" | "tool_result" | "thinking" | "result" | "error" | "status";
  data: any;
}

// ============================================
// Convert Verxio Tools to SDK Format
// ============================================

function createVerxioMcpTools(context: ToolContext): SdkMcpToolDefinition<any>[] {
  return getVerxioToolsForContext(context).map((verxioTool) => {
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
  // Get user's credentials, connections, skills, and Composio accounts in parallel
  const [credentials, connections, skills, composioAccounts] = await Promise.all([
    prisma.credential.findMany({
      where: { userId },
      select: { type: true, name: true },
    }),
    prisma.userConnection.findMany({
      where: { userId, isActive: true },
      select: { name: true, type: true, description: true },
    }),
    prisma.userSkill.findMany({
      where: { userId },
      select: { id: true, name: true, description: true, content: true },
    }),
    listConnectedAccounts(userId).catch(() => []),
  ]);

  return {
    userId,
    workflowId,
    availableCredentials: credentials,
    userConnections: connections,
    userSkills: skills,
    composioConnectedApps: composioAccounts,
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
    model: modelOverride,
    maxTurns = 10,
    abortController,
    attachments,
    isGeneralChat,
  } = options;

  const model = getModel(modelOverride);

  try {
    const toolContext: ToolContext = {
      userId,
      workflowId,
      isGeneralChat,
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

    const composioPromise = hasComposioAccess
      ? getComposioMcpUrl(userId).catch((err) => {
          console.error("[Composio] Failed to load MCP URL:", err);
          return null;
        })
      : Promise.resolve(null);

    if (includeUserConnections) {
      const [mcpServers, context, composioUrl] = await Promise.all([
        loadUserMcpServers(userId),
        getUserContext(userId, workflowId),
        composioPromise,
      ]);
      userMcpServers = mcpServers;
      userContext = context;
      if (composioUrl) {
        composioMcpConfig = { type: "http", url: composioUrl };
      }
    } else {
      const [context, composioUrl] = await Promise.all([
        getUserContext(userId, workflowId),
        composioPromise,
      ]);
      userContext = context;
      if (composioUrl) {
        composioMcpConfig = { type: "http", url: composioUrl };
      }
    }

    // Build system prompt
    const systemPrompt = await getVerxioSystemPrompt(userContext);

    const { wrapUntrustedContent } = await import("./promptInjectionDefense");

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
            mediaDescriptions.push(
              `[User shared an audio file: ${label}]\nURL: ${att.url}\nNote: use browseWebsite or a transcription tool to process this audio if needed.`
            );
          } else if (mime.startsWith("video/")) {
            mediaDescriptions.push(
              `[User shared a video file: ${label}]\nURL: ${att.url}\nNote: use browseWebsite or a media processing tool to handle this video if needed.`
            );
          } else {
            mediaDescriptions.push(`[User shared a file: ${label}]\nURL: ${att.url}`);
          }
        } else if (att.base64 && att.mimeType?.startsWith("image/")) {
          mediaDescriptions.push(
            `[User shared an image: ${label}] (base64 data provided, ${att.mimeType})`
          );
        } else {
          mediaDescriptions.push(`[User shared a file: ${label}]`);
        }
      }
      enrichedPrompt = `${prompt}\n\n${wrapUntrustedContent("User Attachments", mediaDescriptions.join("\n\n"))}`;
    }

    // Build conversation context; wrap all user content to resist prompt injection
    let fullPrompt = enrichedPrompt;
    if (conversationHistory && conversationHistory.length > 0) {
      const historyText = conversationHistory
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n\n");
      fullPrompt = `${wrapUntrustedContent("Previous conversation", historyText)}\n\n${wrapUntrustedContent("Current request", enrichedPrompt)}`;
    } else {
      fullPrompt = wrapUntrustedContent("Current request", enrichedPrompt);
    }

    // Collect all MCP server names for subagent access
    const mcpServers: Record<string, any> = {
      "verxio-workflow": verxioMcpServer,
      ...(composioMcpConfig ? { composio: composioMcpConfig } : {}),
      ...userMcpServers,
    };
    const mcpServerNames = Object.keys(mcpServers);

    // Build allowedTools: auto-approve built-in tools + all MCP server tools via wildcards
    const allowedTools = [
      ...AGENT_BUILTIN_TOOLS,
      ...mcpServerNames.map((name) => `mcp__${name}__*`),
    ];

    const result: Query = query({
      prompt: fullPrompt,
      options: {
        model,
        systemPrompt,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        mcpServers,
        tools: AGENT_BUILTIN_TOOLS,
        allowedTools,
        agents: await buildSubagents(mcpServerNames, userId),
        maxTurns,
        maxBudgetUsd: DEFAULT_MAX_BUDGET_USD,
        effort: "high",
        persistSession: false,
        abortController,
        includePartialMessages: true,
        stderr: stderrHandler,
      },
    });

    for await (const message of result) {
      yield* processSDKMessage(message);
    }
  } catch (error: any) {
    console.error("[AgentService] runAgentQuery failed:", error);
    yield {
      type: "error",
      data: { message: error.message, stack: error.stack },
    };
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
// Planning/Chat Query - Workflow Session Context
// ============================================

const WORKFLOW_SESSION_CONTEXT = `
You are Verxio, an autonomous AI operations assistant with FULL access to every feature on the platform.

## Core Principles
1. **Act, don't ask.** When the user's intent is clear, execute immediately. Do not ask for confirmation unless the action is destructive (deleting resources) or ambiguous.
2. **Chain actions.** If a task requires multiple steps (e.g. "create a support agent with a knowledge base"), complete all steps in sequence without pausing between them.
3. **Report results.** After executing, provide a clear summary of what was done, including relevant IDs, names, and links.
4. **Be autonomous.** You have tools for everything: workflows, support agents, knowledge bases, credentials, connections, organizations, templates, analytics, goals, skills, subagents, memory, watches, Composio integrations, and web browsing. Use them proactively.

## Available Capabilities
- Workflow management: create, edit nodes, connect, run, delete, rename, list
- Support agents: create, configure, update, delete, manage channels
- Knowledge bases: create, add documents, search, delete
- Credentials: create, update, delete, check
- Connections: create MCP/DB/docs connections, test, delete
- Organization: create orgs, invite members, share resources
- Templates: browse marketplace, import as workflows
- Analytics: view execution metrics, generate AI insights
- Goals: create, decompose, pause, resume, delete, report
- Skills & subagents: full CRUD
- Web browsing, Composio actions, memory, watches

All node types, research/TinyFish/Composio rules, plan mode, single-node execution, workflow-building instructions, task management, and goal orchestration are in your system prompt. Follow them.
`;

export async function* chatWithAgent(options: {
  userId: string;
  workflowId?: string;
  message: string;
  conversationHistory: Array<{ role: string; content: string }>;
  learningContext?: {
    similarWorkflows?: Array<{ description: string; nodes: string[] }>;
    userPreferences?: Record<string, unknown>;
  };
  attachments?: MediaAttachment[];
  /** When true the agent operates as a general-purpose assistant (dashboard chat / coworker).
   *  Workflow graph tools (create/edit/run/delete) are NOT available in this mode.
   *  When false (default), the agent is constrained to a specific workflow on the canvas (plan dialog). */
  isGeneralChat?: boolean;
}): AsyncGenerator<AgentStreamEvent> {
  let enhancedPrompt: string;

  if (options.isGeneralChat) {
    enhancedPrompt = `${WORKFLOW_SESSION_CONTEXT}\n\n**General-chat mode.** You are the user's autonomous AI ops assistant. You can manage goals, credentials, connections, support agents, knowledge bases, Composio integrations, skills, subagents, memory, watches, analytics, organizations, and browse the web.\n\n**IMPORTANT:** You do NOT have access to workflow-building or workflow-execution tools in this channel. If the user asks you to create, edit, or run a workflow/automation, tell them to open (or create) a workflow on the **Workflows** page and use the **Plan** dialog or node editor there.\n\n`;
  } else {
    enhancedPrompt = `${WORKFLOW_SESSION_CONTEXT}\n\n**CRITICAL: You are working on an EXISTING workflow that is already on the canvas. The workflow ID is: ${options.workflowId}**\n\n**IMPORTANT RULES:**\n1. NEVER call createWorkflow - the workflow already exists\n2. ALWAYS use workflowId: "${options.workflowId}" when adding/updating nodes\n3. When generating a new workflow, REPLACE existing nodes (delete old ones if needed, then add new ones)\n4. This ensures the new workflow replaces the old one on the canvas instead of creating duplicates\n\n`;
  }

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
    isGeneralChat: options.isGeneralChat,
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

function parseTemplateMetadataJson(rawText: string): Record<string, string> | null {
  const text = rawText.trim();
  if (!text) return null;

  // Handle responses wrapped in markdown code fences.
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const baseCandidate = (fencedMatch?.[1] ?? text).trim();

  const candidates: string[] = [];
  const firstBrace = baseCandidate.indexOf("{");
  const lastBrace = baseCandidate.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(baseCandidate.slice(firstBrace, lastBrace + 1));
  } else if (firstBrace !== -1) {
    // Recover common truncation case: missing trailing brace(s).
    const partial = baseCandidate.slice(firstBrace);
    const openCount = (partial.match(/\{/g) || []).length;
    const closeCount = (partial.match(/\}/g) || []).length;
    candidates.push(partial + "}".repeat(Math.max(0, openCount - closeCount)));
  }

  candidates.push(baseCandidate);

  for (const candidate of candidates) {
    const normalized = candidate
      .replace(/^\uFEFF/, "")
      .replace(/,\s*([}\]])/g, "$1")
      .trim();
    try {
      const parsed = JSON.parse(normalized) as Record<string, string>;
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // Try next candidate
    }
  }

  return null;
}

/**
 * Generate template metadata (name, shortDescription, howItWorks, requirements, category) from a workflow.
 * Fetches the workflow directly from DB, then uses lightweight text generation (no CLI/tools needed)
 * for reliable JSON output.
 */
export async function generateTemplateMetadataForWorkflow(
  userId: string,
  workflowId: string
): Promise<TemplateMetadataResult> {
  const categoriesList = TEMPLATE_CATEGORIES.join(", ");

  try {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId },
      select: {
        id: true,
        name: true,
        connections: true,
        nodes: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!workflow) {
      return { success: false, error: "Workflow not found" };
    }

    const workflowSummary = JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes.map((n: any) => ({ name: n.name, type: n.type })),
      connections: workflow.connections,
    });

    const systemPrompt = `You are a workflow metadata generator. You receive a JSON description of a workflow and produce template metadata. Respond with ONLY a valid JSON object — no markdown, no code fences, no extra text.`;

    const userPrompt = `Given this workflow:
${workflowSummary}

Produce a JSON object with exactly these keys:
- "name": A descriptive, keyword-rich title (e.g. "Send Slack alert when Stripe payment succeeds")
- "shortDescription": One or two sentences summarizing what the workflow does
- "howItWorks": A clear, step-by-step explanation. Include required API keys or credentials if relevant.
- "requirements": List any required API keys, credentials, or external setup. Use "None" if nothing is required.
- "category": MUST be exactly one of: ${categoriesList}

Output ONLY the JSON object.`;

    const { text } = await generateTextWithSystemPrompt({
      systemPrompt,
      userPrompt,
    });

    let parsed = parseTemplateMetadataJson(text);

    if (!parsed && text) {
      const { text: repairedText } = await generateTextWithSystemPrompt({
        systemPrompt:
          "You convert text into strict JSON. Respond with ONLY the JSON object, nothing else.",
        userPrompt: `Rewrite this as valid JSON with keys "name", "shortDescription", "howItWorks", "requirements", "category":\n\n${text}`,
      });
      parsed = parseTemplateMetadataJson(repairedText);
    }

    if (!parsed) {
      return {
        success: false,
        error: "Failed to generate valid JSON metadata for template",
      };
    }

    let category = parsed.category ?? "";
    if (
      category &&
      !TEMPLATE_CATEGORIES.includes(category as (typeof TEMPLATE_CATEGORIES)[number])
    ) {
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
