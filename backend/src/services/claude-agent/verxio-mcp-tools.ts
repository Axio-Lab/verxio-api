/**
 * Verxio MCP Tools for Claude Agent
 *
 * These tools give Claude direct access to create, configure, and execute
 * workflows in Verxio. They enable fully autonomous workflow automation.
 */

import { z } from "zod/v4";
import { basePrismaClient } from "../../lib/prisma";
import { NodeType } from "../../lib/node-types";
import { inngest } from "../../inngest";
import * as connectionService from "../connectionService";
import * as skillService from "../skillService";

const prisma = basePrismaClient as any;

// ============================================
// Tool Type Definition
// ============================================

export interface VerxioTool {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  execute: (args: any, context: ToolContext) => Promise<any>;
}

export interface ToolContext {
  userId: string;
  workflowId?: string;
}

// ============================================
// Available Node Types for Reference
// ============================================

export const AVAILABLE_NODE_TYPES = {
  // Triggers (start workflow execution)
  triggers: [
    { type: "MANUAL_TRIGGER", description: "Manually triggered workflow execution" },
    { type: "MANUAL_INPUT", description: "Workflow that starts with user-provided input data" },
    { type: "TIMED_TRIGGER", description: "Workflow triggered on a schedule (cron)" },
    { type: "WEBHOOK", description: "Workflow triggered by HTTP POST request" },
    { type: "GOOGLE_FORM_TRIGGER", description: "Triggered when a Google Form is submitted" },
    { type: "STRIPE_TRIGGER", description: "Triggered by Stripe webhook events" },
    { type: "AIRTABLE_TRIGGER", description: "Triggered by Airtable record changes" },
    { type: "TELEGRAM_TRIGGER", description: "Triggered by incoming Telegram messages" },
    { type: "WHATSAPP_TRIGGER", description: "Triggered by incoming WhatsApp messages" },
  ],

  // AI Models (generate content, analyze data)
  ai: [
    {
      type: "ANTHROPIC",
      description: "Claude AI for text generation and analysis",
      requiredCredential: "ANTHROPIC",
    },
    { type: "OPENAI", description: "GPT models for text generation", requiredCredential: "OPENAI" },
    {
      type: "GEMINI",
      description: "Google Gemini for multimodal AI tasks",
      requiredCredential: "GEMINI",
    },
  ],

  // Communication (send messages)
  communication: [
    { type: "DISCORD", description: "Send messages to Discord channels" },
    { type: "SLACK", description: "Send messages to Slack channels" },
    { type: "TELEGRAM", description: "Send Telegram messages", requiredCredential: "TELEGRAM" },
    { type: "WHATSAPP", description: "Send WhatsApp messages" },
    { type: "GMAIL", description: "Send emails via Gmail", requiredOAuth: "GOOGLE" },
  ],

  // Google Workspace (document operations)
  google: [
    { type: "GOOGLE_DOCS", description: "Create/edit Google Docs", requiredOAuth: "GOOGLE" },
    { type: "GOOGLE_SHEETS", description: "Read/write Google Sheets", requiredOAuth: "GOOGLE" },
    { type: "GOOGLE_SLIDES", description: "Create/edit Google Slides", requiredOAuth: "GOOGLE" },
    { type: "GOOGLE_DRIVE", description: "Manage files in Google Drive", requiredOAuth: "GOOGLE" },
    { type: "GOOGLE_CALENDAR", description: "Manage calendar events", requiredOAuth: "GOOGLE" },
    { type: "GOOGLE_MEET", description: "Create Google Meet links", requiredOAuth: "GOOGLE" },
  ],

  // Data & APIs
  data: [
    { type: "HTTP_REQUEST", description: "Make HTTP requests to any API" },
    {
      type: "AIRTABLE",
      description: "Read/write Airtable records",
      requiredCredential: "AIRTABLE",
    },
    { type: "FIRECRAWL", description: "Web scraping and crawling" },
    { type: "APIFY", description: "Run Apify actors for web automation" },
  ],

  // Logic & Code
  logic: [
    { type: "DECIDER", description: "Conditional branching based on data" },
    { type: "CODE_BLOCK", description: "Execute custom TypeScript code" },
    { type: "PLAN", description: "AI-powered planning and decision making" },
  ],

  // Media
  media: [
    { type: "ELEVENLABS", description: "Text-to-speech with ElevenLabs" },
    {
      type: "REMOTION",
      description:
        "Generate motion videos using AI-powered Remotion code generation. Supports assets, background audio, and various video formats.",
    },
    { type: "DESIGN", description: "AI image generation" },
    { type: "DESIGN_PRO", description: "Advanced AI image generation with editing capabilities" },
    { type: "VEO", description: "AI video generation using Veo 3.1" },
    { type: "KLING_TEXT2VIDEO", description: "Kling AI text-to-video generation" },
    { type: "KLING_IMAGE2VIDEO", description: "Kling AI image-to-video (animate an image)" },
    { type: "KLING_IMAGE", description: "Kling AI image generation from text" },
    { type: "KLING_TTS", description: "Kling AI text-to-speech" },
    { type: "KLING_OMNI_VIDEO", description: "Kling O1 omni-video (prompt + optional image list)" },
    { type: "KLING_OMNI_IMAGE", description: "Kling O1 omni-image generation" },
    {
      type: "KLING_VIDEO_EXTEND",
      description: "Kling video extend (video_id from previous Kling video)",
    },
    { type: "KLING_MULTI_IMAGE2VIDEO", description: "Kling multi-image to video" },
    {
      type: "KLING_MOTION_CONTROL",
      description: "Kling motion control (image + optional video ref)",
    },
    { type: "KLING_MULTI_IMAGE2IMAGE", description: "Kling multi-image to image" },
  ],
};

// ============================================
// Tool: List Available Node Types
// ============================================

export const listNodeTypesTool: VerxioTool = {
  name: "listNodeTypes",
  description: "List all available node types in Verxio with their descriptions and requirements",
  inputSchema: z.object({
    category: z
      .enum(["triggers", "ai", "communication", "google", "data", "logic", "media", "all"])
      .optional(),
  }),
  execute: async ({ category }) => {
    if (category && category !== "all") {
      return {
        category,
        nodes: AVAILABLE_NODE_TYPES[category as keyof typeof AVAILABLE_NODE_TYPES],
      };
    }
    return AVAILABLE_NODE_TYPES;
  },
};

// ============================================
// Tool: Create Workflow
// ============================================

export const createWorkflowTool: VerxioTool = {
  name: "createWorkflow",
  description:
    "Create a new workflow in Verxio with a name and optional description. WARNING: If workflowId exists in context, DO NOT use this tool - use the existing workflowId instead.",
  inputSchema: z.object({
    name: z.string().min(1).max(100).describe("Name for the new workflow"),
    description: z.string().optional().describe("Optional description of what this workflow does"),
  }),
  execute: async ({ name, description }, context) => {
    // CRITICAL: If workflowId exists in context, this means we're working on an existing workflow
    // Do NOT create a new workflow - the agent should use the existing workflowId
    if (context.workflowId) {
      return {
        success: false,
        error: `Cannot create a new workflow. You are already working on an existing workflow with ID: ${context.workflowId}. Use this workflowId when adding nodes instead of creating a new workflow.`,
        existingWorkflowId: context.workflowId,
        suggestion: `Use getWorkflow("${context.workflowId}") to see the current workflow, then use addNode with workflowId: "${context.workflowId}" to add nodes to the existing workflow.`,
      };
    }
    const trimmedName = name.trim();
    const existing = await prisma.workflow.findFirst({
      where: {
        userId: context.userId,
        name: { equals: trimmedName, mode: "insensitive" },
      },
    });
    if (existing) {
      return {
        success: false,
        error: `A workflow named "${trimmedName}" already exists. Please choose a different name.`,
        suggestion:
          "Use a unique name, e.g. add a number or descriptor (e.g. 'My Workflow 2', 'Daily Report v1').",
      };
    }
    const workflow = await prisma.workflow.create({
      data: {
        name: trimmedName,
        userId: context.userId,
        nodes: {
          create: {
            name: NodeType.INITIAL,
            type: NodeType.INITIAL,
            position: { x: 0, y: 0 },
            data: description ? { description } : {},
          },
        },
      },
      include: {
        nodes: true,
        connections: true,
      },
    });

    return {
      success: true,
      workflowId: workflow.id,
      name: workflow.name,
      initialNodeId: workflow.nodes[0]?.id,
      message: `Created workflow "${name}" with ID ${workflow.id}`,
    };
  },
};

// ============================================
// Tool: Get Workflow
// ============================================

export const getWorkflowTool: VerxioTool = {
  name: "getWorkflow",
  description: "Get details of a workflow including all nodes and connections",
  inputSchema: z.object({
    workflowId: z.string().describe("ID of the workflow to retrieve"),
  }),
  execute: async ({ workflowId }, context) => {
    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        userId: context.userId,
      },
      include: {
        nodes: {
          orderBy: { createdAt: "asc" },
        },
        connections: true,
      },
    });

    if (!workflow) {
      return { success: false, error: "Workflow not found or access denied" };
    }

    return {
      success: true,
      workflow: {
        id: workflow.id,
        name: workflow.name,
        nodes: workflow.nodes.map((n: any) => ({
          id: n.id,
          name: n.name,
          type: n.type,
          position: n.position,
          data: n.data,
        })),
        connections: workflow.connections.map((c: any) => ({
          id: c.id,
          source: c.fromNodeId,
          target: c.toNodeId,
          sourceHandle: c.fromOutput,
          targetHandle: c.toInput,
        })),
      },
    };
  },
};

// ============================================
// Tool: Add Node
// ============================================

// Helper function to check required credentials for node types
async function validateRequiredCredentials(
  nodeType: string,
  data: Record<string, any> | undefined,
  userId: string
): Promise<{ valid: boolean; error?: string; requiredCredentialType?: string }> {
  // Map of node types to required credential types
  const requiredCredentials: Record<string, string> = {
    TELEGRAM_TRIGGER: "TELEGRAM",
    TELEGRAM: "TELEGRAM",
    ANTHROPIC: "ANTHROPIC",
    OPENAI: "OPENAI",
    GEMINI: "GEMINI",
  };

  const requiredCredentialType = requiredCredentials[nodeType];
  if (!requiredCredentialType) {
    return { valid: true }; // No credential required for this node type
  }

  // Check if credentialId is provided in data
  const credentialId = data?.credentialId;
  if (!credentialId) {
    return {
      valid: false,
      error: `${nodeType} node requires a credentialId. Please use getCredentials("${requiredCredentialType}") to find an existing credential, or use requestCredential("${requiredCredentialType}") to request one from the user.`,
      requiredCredentialType,
    };
  }

  // Verify the credential exists and belongs to the user
  const credential = await prisma.credential.findFirst({
    where: {
      id: credentialId,
      userId: userId,
      type: requiredCredentialType,
    },
  });

  if (!credential) {
    return {
      valid: false,
      error: `Credential ${credentialId} not found or does not match required type ${requiredCredentialType}. Please use getCredentials("${requiredCredentialType}") to find a valid credential.`,
      requiredCredentialType,
    };
  }

  return { valid: true };
}

export const addNodeTool: VerxioTool = {
  name: "addNode",
  description: "Add a new node to a workflow",
  inputSchema: z.object({
    workflowId: z.string().describe("ID of the workflow"),
    nodeType: z.string().describe("Type of node (e.g., ANTHROPIC, GOOGLE_SHEETS, CODE_BLOCK)"),
    name: z.string().describe("Display name for the node"),
    position: z
      .object({
        x: z.number(),
        y: z.number(),
      })
      .optional()
      .describe("Position on canvas (will auto-calculate if not provided)"),
    data: z.record(z.string(), z.any()).optional().describe("Node configuration data"),
  }),
  execute: async ({ workflowId, nodeType, name, position, data }, context) => {
    // Verify workflow belongs to user
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId: context.userId },
      include: { nodes: true },
    });

    if (!workflow) {
      return { success: false, error: "Workflow not found or access denied" };
    }

    // Validate required credentials before creating node
    const credentialValidation = await validateRequiredCredentials(nodeType, data, context.userId);
    if (!credentialValidation.valid) {
      return {
        success: false,
        error: credentialValidation.error,
        requiredCredentialType: credentialValidation.requiredCredentialType,
        suggestion: `Use getCredentials("${credentialValidation.requiredCredentialType}") to find existing credentials, or requestCredential("${credentialValidation.requiredCredentialType}") to request one.`,
      };
    }

    // Validate that AI nodes have variables and model fields set
    const aiNodeTypes = ["ANTHROPIC", "OPENAI", "GEMINI"];
    if (aiNodeTypes.includes(nodeType)) {
      const variables = data?.variables;
      if (!variables || typeof variables !== "string" || variables.trim() === "") {
        // Convert node name to camelCase as fallback
        const camelCaseName = name
          .replace(/([A-Z])/g, " $1")
          .toLowerCase()
          .trim()
          .replace(/\s+(\w)/g, (_: string, c: string) => c.toUpperCase())
          .replace(/^./, (c: string) => c.toLowerCase());

        return {
          success: false,
          error: `${nodeType} node requires a 'variables' field. The variables field must be set explicitly to the node name converted to camelCase.`,
          suggestion: `Set variables field to "${camelCaseName}" (converted from node name "${name}"). Use this exact variable name when referencing in subsequent nodes: {{${camelCaseName}.text}}`,
          recommendedVariables: camelCaseName,
        };
      }

      // Validate model field is set
      const model = data?.model;
      if (!model || typeof model !== "string" || model.trim() === "") {
        const availableModels: Record<string, string[]> = {
          ANTHROPIC: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-5"],
          OPENAI: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
          GEMINI: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-pro-latest"],
        };

        return {
          success: false,
          error: `${nodeType} node requires a 'model' field. The model must be explicitly selected from available models.`,
          suggestion: `Set model field to one of: ${availableModels[nodeType]?.join(", ") || "available models"}. Recommended: ${availableModels[nodeType]?.[0] || "latest"}`,
          availableModels: availableModels[nodeType] || [],
        };
      }
    }

    // Auto-calculate position if not provided
    const calculatedPosition = position || {
      x: Math.max(...workflow.nodes.map((n: any) => n.position?.x || 0), 0) + 300,
      y: workflow.nodes.length * 100,
    };

    const node = await prisma.node.create({
      data: {
        workflowId,
        name,
        type: nodeType as any,
        position: calculatedPosition,
        data: data || {},
      },
    });

    return {
      success: true,
      nodeId: node.id,
      nodeType: node.type,
      name: node.name,
      position: node.position,
      message: `Added ${nodeType} node "${name}" with ID ${node.id}`,
    };
  },
};

// ============================================
// Tool: Configure Node
// ============================================

export const configureNodeTool: VerxioTool = {
  name: "configureNode",
  description: "Configure a node's settings, prompts, credentials, and other parameters",
  inputSchema: z.object({
    nodeId: z.string().describe("ID of the node to configure"),
    config: z.record(z.string(), z.any()).describe("Configuration data to set/merge"),
    credentialId: z.string().optional().describe("ID of credential to attach to node"),
  }),
  execute: async ({ nodeId, config, credentialId }, context) => {
    // Get node and verify ownership
    const node = await prisma.node.findFirst({
      where: { id: nodeId },
      include: { workflow: true },
    });

    if (!node || node.workflow.userId !== context.userId) {
      return { success: false, error: "Node not found or access denied" };
    }

    // Merge config with existing data
    const existingData = (node.data as Record<string, any>) || {};
    const newData = { ...existingData, ...config };

    // If credentialId is provided in config, use it
    const finalCredentialId = credentialId || config.credentialId || existingData.credentialId;

    // Validate required credentials for this node type
    const credentialValidation = await validateRequiredCredentials(
      node.type,
      { ...newData, credentialId: finalCredentialId },
      context.userId
    );
    if (!credentialValidation.valid) {
      return {
        success: false,
        error: credentialValidation.error,
        requiredCredentialType: credentialValidation.requiredCredentialType,
        suggestion: `Use getCredentials("${credentialValidation.requiredCredentialType}") to find existing credentials, or requestCredential("${credentialValidation.requiredCredentialType}") to request one.`,
      };
    }

    const updateData: any = { data: newData };
    if (finalCredentialId) {
      // Verify credential belongs to user and matches required type
      const requiredCredentials: Record<string, string> = {
        TELEGRAM_TRIGGER: "TELEGRAM",
        TELEGRAM: "TELEGRAM",
        ANTHROPIC: "ANTHROPIC",
        OPENAI: "OPENAI",
        GEMINI: "GEMINI",
      };
      const requiredCredentialType = requiredCredentials[node.type];

      const credential = await prisma.credential.findFirst({
        where: {
          id: finalCredentialId,
          userId: context.userId,
          ...(requiredCredentialType ? { type: requiredCredentialType } : {}),
        },
      });
      if (!credential) {
        return {
          success: false,
          error: `Credential not found or does not match required type${requiredCredentialType ? ` ${requiredCredentialType}` : ""}`,
        };
      }
      updateData.credentialId = finalCredentialId;
    }

    const updatedNode = await prisma.node.update({
      where: { id: nodeId },
      data: updateData,
    });

    return {
      success: true,
      nodeId: updatedNode.id,
      updatedConfig: newData,
      message: `Configured node ${nodeId} with new settings`,
    };
  },
};

// ============================================
// Tool: Connect Nodes
// ============================================

export const connectNodesTool: VerxioTool = {
  name: "connectNodes",
  description: "Connect two nodes to define execution flow",
  inputSchema: z.object({
    sourceNodeId: z.string().describe("ID of the source node (output)"),
    targetNodeId: z.string().describe("ID of the target node (input)"),
    sourceHandle: z.string().optional().default("main").describe("Source output handle"),
    targetHandle: z.string().optional().default("main").describe("Target input handle"),
  }),
  execute: async ({ sourceNodeId, targetNodeId, sourceHandle, targetHandle }, context) => {
    // Get both nodes and verify they're in same workflow owned by user
    const [sourceNode, targetNode] = await Promise.all([
      prisma.node.findFirst({ where: { id: sourceNodeId }, include: { workflow: true } }),
      prisma.node.findFirst({ where: { id: targetNodeId }, include: { workflow: true } }),
    ]);

    if (!sourceNode || !targetNode) {
      return { success: false, error: "One or both nodes not found" };
    }

    if (sourceNode.workflowId !== targetNode.workflowId) {
      return { success: false, error: "Nodes must be in the same workflow" };
    }

    if (sourceNode.workflow.userId !== context.userId) {
      return { success: false, error: "Access denied to this workflow" };
    }

    // Check for existing connection
    const existingConnection = await prisma.connection.findFirst({
      where: {
        fromNodeId: sourceNodeId,
        toNodeId: targetNodeId,
        fromOutput: sourceHandle || "main",
        toInput: targetHandle || "main",
      },
    });

    if (existingConnection) {
      return {
        success: true,
        connectionId: existingConnection.id,
        message: "Connection already exists",
      };
    }

    const connection = await prisma.connection.create({
      data: {
        workflowId: sourceNode.workflowId,
        fromNodeId: sourceNodeId,
        toNodeId: targetNodeId,
        fromOutput: sourceHandle || "main",
        toInput: targetHandle || "main",
      },
    });

    return {
      success: true,
      connectionId: connection.id,
      message: `Connected ${sourceNode.name} -> ${targetNode.name}`,
    };
  },
};

// ============================================
// Tool: Execute Workflow
// ============================================

export const executeWorkflowTool: VerxioTool = {
  name: "executeWorkflow",
  description: "Trigger execution of a workflow",
  inputSchema: z.object({
    workflowId: z.string().describe("ID of the workflow to execute"),
    inputData: z
      .record(z.string(), z.any())
      .optional()
      .describe("Optional input data for the workflow"),
    triggerNodeId: z.string().optional().describe("Specific trigger node to start from"),
  }),
  execute: async ({ workflowId, inputData, triggerNodeId }, context) => {
    // Verify workflow ownership
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId: context.userId },
      include: { nodes: true },
    });

    if (!workflow) {
      return { success: false, error: "Workflow not found or access denied" };
    }

    // Find trigger node
    let triggerNode = triggerNodeId
      ? workflow.nodes.find((n: any) => n.id === triggerNodeId)
      : workflow.nodes.find((n: any) =>
          ["MANUAL_TRIGGER", "MANUAL_INPUT", "WEBHOOK"].includes(n.type)
        );

    if (!triggerNode) {
      return { success: false, error: "No suitable trigger node found in workflow" };
    }

    // Send Inngest event to trigger workflow
    const eventResult = await inngest.send({
      name: "workflow/trigger",
      data: {
        workflowId,
        userId: context.userId,
        triggerNodeId: triggerNode.id,
        initialData: inputData || {},
        triggeredBy: "agent",
      },
    });

    return {
      success: true,
      executionId: eventResult.ids?.[0] || null,
      workflowId,
      triggerNodeId: triggerNode.id,
      message: `Triggered workflow "${workflow.name}" execution`,
    };
  },
};

// ============================================
// Tool: Get Credentials
// ============================================

export const getCredentialsTool: VerxioTool = {
  name: "getCredentials",
  description: "List available credentials for the user, optionally filtered by type",
  inputSchema: z.object({
    type: z
      .string()
      .optional()
      .describe("Filter by credential type (e.g., ANTHROPIC, OPENAI, TELEGRAM)"),
  }),
  execute: async ({ type }, context) => {
    const where: any = { userId: context.userId };
    if (type) {
      where.type = type;
    }

    const credentials = await prisma.credential.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      credentials,
      count: credentials.length,
    };
  },
};

// ============================================
// Tool: Check Credential
// ============================================

export const checkCredentialTool: VerxioTool = {
  name: "checkCredential",
  description: "Check if user has a valid credential for a specific integration type",
  inputSchema: z.object({
    integrationType: z
      .string()
      .describe("Type of integration (e.g., ANTHROPIC, OPENAI, GOOGLE, TELEGRAM)"),
  }),
  execute: async ({ integrationType }, context) => {
    // Check for regular credentials
    const credential = await prisma.credential.findFirst({
      where: {
        userId: context.userId,
        type: integrationType,
      },
      select: { id: true, name: true, type: true },
    });

    // Check for Google OAuth if needed
    if (integrationType === "GOOGLE" || integrationType.startsWith("GOOGLE_")) {
      const googleOAuth = await prisma.googleOAuthToken.findFirst({
        where: { userId: context.userId },
        select: { id: true, scope: true },
      });

      if (googleOAuth) {
        return {
          exists: true,
          type: "oauth",
          credentialType: "GOOGLE_OAUTH",
          scopes: googleOAuth.scope,
          message: "Google OAuth is configured",
        };
      }
    }

    if (credential) {
      return {
        exists: true,
        type: "credential",
        credentialId: credential.id,
        credentialName: credential.name,
        credentialType: credential.type,
        message: `Found ${integrationType} credential: ${credential.name}`,
      };
    }

    return {
      exists: false,
      credentialType: integrationType,
      setupUrl: `/credentials/new?type=${integrationType}`,
      message: `Missing ${integrationType} credential. User needs to add it at /credentials/new`,
      instructions: getCredentialSetupInstructions(integrationType),
    };
  },
};

// ============================================
// Tool: Request Credential
// ============================================

export const requestCredentialTool: VerxioTool = {
  name: "requestCredential",
  description: "Request user to add a missing credential with specific instructions",
  inputSchema: z.object({
    integrationType: z.string().describe("Type of credential needed"),
    reason: z.string().describe("Why this credential is needed"),
    requiredScopes: z.array(z.string()).optional().describe("Required OAuth scopes if applicable"),
  }),
  execute: async ({ integrationType, reason, requiredScopes }) => {
    return {
      action: "REQUEST_CREDENTIAL",
      integrationType,
      reason,
      requiredScopes,
      setupUrl: `/credentials/new?type=${integrationType}`,
      instructions: getCredentialSetupInstructions(integrationType),
      message: `Please add a ${integrationType} credential to continue. ${reason}`,
    };
  },
};

// ============================================
// Tool: Get Connections (MCP, Database, Docs)
// ============================================

export const getConnectionsTool: VerxioTool = {
  name: "getConnections",
  description: "Get user's configured connections (MCP servers, databases, documentation)",
  inputSchema: z.object({
    type: z.enum(["MCP_SERVER", "DATABASE", "DOCUMENTATION", "API_ENDPOINT", "all"]).optional(),
    activeOnly: z.boolean().optional().default(true),
  }),
  execute: async ({ type, activeOnly }, context) => {
    const where: any = { userId: context.userId };
    if (type && type !== "all") {
      where.type = type;
    }
    if (activeOnly) {
      where.isActive = true;
    }

    const connections = await prisma.userConnection.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        isActive: true,
        testStatus: true,
        lastUsedAt: true,
      },
      orderBy: { lastUsedAt: "desc" },
    });

    return {
      success: true,
      connections,
      count: connections.length,
    };
  },
};

// ============================================
// Tool: Search Documentation
// ============================================

export const searchDocumentationTool: VerxioTool = {
  name: "searchDocumentation",
  description: "Search user's connected documentation for relevant information",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
    connectionIds: z
      .array(z.string())
      .optional()
      .describe("Specific documentation connections to search"),
  }),
  execute: async ({ query, connectionIds }, context) => {
    const results = await connectionService.searchDocumentation(
      context.userId,
      query,
      connectionIds
    );

    return {
      success: true,
      query,
      results,
      count: results.length,
    };
  },
};

// ============================================
// Tool: Generate Code Block
// ============================================

export const generateCodeTool: VerxioTool = {
  name: "generateCode",
  description:
    "Generate code for a CODE_BLOCK node (TypeScript, JavaScript, Python, Rust, or Anchor). Use when creating custom data transformations or logic.",
  inputSchema: z.object({
    requirement: z.string().describe("Clear description of what the code should do"),
    language: z
      .enum(["typescript", "javascript", "python", "rust", "anchor"])
      .optional()
      .default("typescript")
      .describe("Language: typescript, javascript, python, rust, or anchor"),
    availableInputs: z
      .record(z.string(), z.any())
      .optional()
      .describe("Available variables from previous nodes and their structure"),
    expectedOutput: z.record(z.string(), z.any()).optional().describe("Expected output structure"),
  }),
  execute: async ({ requirement, language = "typescript", availableInputs, expectedOutput }) => {
    const inputVars = availableInputs ? Object.keys(availableInputs) : [];
    const inputDocs =
      inputVars.length > 0
        ? inputVars
            .map(
              (name) =>
                `  // inputs.${name}: ${JSON.stringify(availableInputs![name], null, 2).split("\n").join("\n  // ")}`
            )
            .join("\n")
        : "  // No specific inputs defined";

    const outputDocs = expectedOutput
      ? `Expected output: ${JSON.stringify(expectedOutput, null, 2)}`
      : "Return an object with your computed results";

    let code: string;
    if (language === "rust" || language === "anchor") {
      code = `// CODE_BLOCK (${language}): ${requirement}
// Available inputs from previous nodes:
${inputDocs}
// ${outputDocs}

fn main() {
    // TODO: Read inputs from env/stdin if needed, implement: ${requirement}
    // Return JSON-serializable result to stdout
}
`;
    } else if (language === "python") {
      code = `# CODE_BLOCK (python): ${requirement}
# Available inputs from previous nodes:
${inputDocs}
# ${outputDocs}

def execute(inputs: dict) -> dict:
    # Access data via inputs["variableName"]
${inputVars.length > 0 ? inputVars.map((name) => `    ${name} = inputs.get("${name}")`).join("\n") : "    pass"}
    # TODO: Implement ${requirement}
    return {"success": True, "result": None}
`;
    } else {
      code = `/**
 * CODE_BLOCK (${language}): ${requirement}
 * Available inputs from previous nodes:
${inputDocs}
 * ${outputDocs}
 */
export default async function execute(inputs: Record<string, any>): Promise<Record<string, any>> {
${inputVars.length > 0 ? inputVars.map((name) => `  const ${name} = inputs.${name};`).join("\n") : "  // const previousData = inputs.previousNodeName;"}
  // TODO: Implement ${requirement}
  return { success: true, result: null };
}`;
    }

    return {
      success: true,
      code,
      requirement,
      language,
      availableInputs: inputVars,
      message: `Generated CODE_BLOCK (${language}) template for: ${requirement}. Complete the implementation.`,
      instructions: [
        "1. Access previous node data via inputs (or inputs.variableName in TS/JS)",
        "2. NEVER use 'context' - always use 'inputs'",
        "3. Return a plain object / JSON-serializable result",
        "4. Handle errors appropriately",
      ],
    };
  },
};

// ============================================
// Tool: Delete Node
// ============================================

export const deleteNodeTool: VerxioTool = {
  name: "deleteNode",
  description: "Delete a node from a workflow",
  inputSchema: z.object({
    nodeId: z.string().describe("ID of the node to delete"),
  }),
  execute: async ({ nodeId }, context) => {
    const node = await prisma.node.findFirst({
      where: { id: nodeId },
      include: { workflow: true },
    });

    if (!node || node.workflow.userId !== context.userId) {
      return { success: false, error: "Node not found or access denied" };
    }

    if (node.type === "INITIAL") {
      return { success: false, error: "Cannot delete the initial node" };
    }

    // Delete connections first, then node
    await prisma.connection.deleteMany({
      where: {
        OR: [{ fromNodeId: nodeId }, { toNodeId: nodeId }],
      },
    });

    await prisma.node.delete({ where: { id: nodeId } });

    return {
      success: true,
      message: `Deleted node ${node.name} (${nodeId})`,
    };
  },
};

// ============================================
// Tool: List User Workflows
// ============================================

export const listWorkflowsTool: VerxioTool = {
  name: "listWorkflows",
  description: "List all workflows for the current user",
  inputSchema: z.object({
    limit: z.number().optional().default(10).describe("Maximum number of workflows to return"),
    search: z.string().optional().describe("Search by workflow name"),
  }),
  execute: async ({ limit, search }, context) => {
    const where: any = { userId: context.userId };
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const workflows = await prisma.workflow.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { nodes: true, connections: true },
        },
      },
    });

    return {
      success: true,
      workflows: workflows.map((w: any) => ({
        id: w.id,
        name: w.name,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        nodeCount: w._count.nodes,
        connectionCount: w._count.connections,
      })),
      count: workflows.length,
    };
  },
};

// ============================================
// Helper: Get Credential Setup Instructions
// ============================================

function getCredentialSetupInstructions(type: string): string {
  const instructions: Record<string, string> = {
    ANTHROPIC:
      "Go to https://console.anthropic.com to get your API key. Create a new API key in the API Keys section.",
    OPENAI:
      "Visit https://platform.openai.com/api-keys to create an API key. You'll need a paid account.",
    GEMINI: "Get your API key from https://makersuite.google.com/app/apikey",
    TELEGRAM:
      "1. Open Telegram and search for @BotFather\n2. Send /newbot and follow instructions\n3. Copy the bot token provided",
    AIRTABLE:
      "Go to https://airtable.com/create/tokens to create a personal access token with the required scopes.",
    GOOGLE: "Use the 'Connect Google Account' button to authorize access to Google services.",
    ELEVENLABS: "Get your API key from https://elevenlabs.io/app/settings/api-keys",
  };

  return (
    instructions[type] ||
    `Please obtain the API key or credentials for ${type} from the service provider's website.`
  );
}

// ============================================
// Tool: Create Multiple Design Nodes
// ============================================

export const createMultipleDesignNodesTool: VerxioTool = {
  name: "createMultipleDesignNodes",
  description:
    "Create multiple DESIGN or DESIGN_PRO nodes in sequence for generating multiple images (e.g., presentation slides, image series). Each node receives a JSON-formatted prompt from the imageSpecs array. Nodes are connected sequentially. Use DESIGN_PRO for higher quality output (1K/2K/4K resolution) or advanced features. Use DESIGN for standard quality output.",
  inputSchema: z.object({
    workflowId: z.string().describe("ID of the workflow"),
    nodeType: z
      .enum(["DESIGN", "DESIGN_PRO"])
      .optional()
      .default("DESIGN")
      .describe(
        "Node type: 'DESIGN' for standard quality (default), 'DESIGN_PRO' for higher quality (1K/2K/4K) and advanced features. Use DESIGN_PRO when user requests high quality, high resolution, or professional output."
      ),
    imageSpecs: z
      .array(
        z.object({
          prompt: z
            .string()
            .describe("JSON-formatted prompt string (REQUIRED - must be valid JSON)"),
          variables: z
            .string()
            .optional()
            .describe("Variable name for this node's output (defaults to design1, design2, etc.)"),
          aspectRatio: z.string().optional().describe("Aspect ratio (e.g., '16:9', '1:1', '9:16')"),
          template: z
            .string()
            .optional()
            .describe("Template type (e.g., 'presentation_slide', 'instagram_post')"),
          model: z
            .string()
            .optional()
            .describe(
              "Model to use. For DESIGN: 'gemini-2.5-flash-image' (default). For DESIGN_PRO: 'gemini-3-pro-image-preview' (default, recommended)."
            ),
          // DESIGN_PRO specific fields
          mode: z
            .enum(["generate", "edit", "editWithReferences"])
            .optional()
            .describe(
              "Mode for DESIGN_PRO nodes: 'generate' (default), 'edit', or 'editWithReferences'"
            ),
          imageSize: z
            .enum(["1K", "2K", "4K"])
            .optional()
            .describe(
              "Image size for DESIGN_PRO nodes: '1K' (default/standard), '2K' (high quality), '4K' (ultra high quality). Use 2K or 4K when user requests high quality output."
            ),
        })
      )
      .min(1)
      .describe("Array of image specifications, one per node"),
    variablesPrefix: z
      .string()
      .optional()
      .describe(
        "Prefix for variable names (defaults to 'design' or 'designPro' based on nodeType)"
      ),
  }),
  execute: async ({ workflowId, imageSpecs, variablesPrefix, nodeType = "DESIGN" }, context) => {
    // Verify workflow belongs to user
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId: context.userId },
      include: { nodes: true },
    });

    if (!workflow) {
      return { success: false, error: "Workflow not found or access denied" };
    }

    const nodeIds: string[] = [];
    const variableNames: string[] = [];

    // Calculate starting position
    const maxX = Math.max(...workflow.nodes.map((n: any) => n.position?.x || 0), 0);
    const startX = maxX + 300;

    // Set default variables prefix based on node type
    const defaultPrefix = variablesPrefix || (nodeType === "DESIGN_PRO" ? "designPro" : "design");

    // Create nodes sequentially
    for (let i = 0; i < imageSpecs.length; i++) {
      const spec = imageSpecs[i];
      const variableName = spec.variables || `${defaultPrefix}${i + 1}`;
      const nodeName =
        nodeType === "DESIGN_PRO" ? `Nano Banana Pro ${i + 1}` : `Nano Banana ${i + 1}`;

      // Validate prompt is JSON
      let parsedPrompt;
      try {
        parsedPrompt = JSON.parse(spec.prompt);
      } catch (error) {
        return {
          success: false,
          error: `Image spec ${i + 1}: prompt must be valid JSON string. Use JSON.stringify() when creating prompts.`,
        };
      }

      // Calculate position (vertical stacking)
      const position = {
        x: startX,
        y: i * 150,
      };

      // Create node data
      const nodeData: Record<string, any> = {
        variables: variableName,
        prompt: spec.prompt, // Store as JSON string
      };

      if (spec.aspectRatio) {
        nodeData.aspectRatio = spec.aspectRatio;
      }
      if (spec.template) {
        nodeData.template = spec.template;
      }
      if (spec.model) {
        nodeData.model = spec.model;
      }

      // Add DESIGN_PRO specific fields
      if (nodeType === "DESIGN_PRO") {
        // Set default mode to "generate" if not specified
        nodeData.mode = spec.mode || "generate";

        // Set default model to Pro model if not specified
        if (!spec.model) {
          nodeData.model = "gemini-3-pro-image-preview";
        }

        // Add imageSize if specified (defaults to 1K in backend)
        if (spec.imageSize) {
          nodeData.imageSize = spec.imageSize;
        }
      } else {
        // For DESIGN nodes, set default model if not specified
        if (!spec.model) {
          nodeData.model = "gemini-2.5-flash-image";
        }
      }

      // Create the node
      const node = await prisma.node.create({
        data: {
          workflowId,
          name: nodeName,
          type: nodeType,
          position,
          data: nodeData,
        },
      });

      nodeIds.push(node.id);
      variableNames.push(variableName);

      // Connect to previous node if not the first
      if (i > 0) {
        const previousNodeId = nodeIds[i - 1];

        // Check if connection already exists
        const existingConnection = await prisma.connection.findFirst({
          where: {
            fromNodeId: previousNodeId,
            toNodeId: node.id,
          },
        });

        if (!existingConnection) {
          await prisma.connection.create({
            data: {
              workflowId,
              fromNodeId: previousNodeId,
              toNodeId: node.id,
              fromOutput: "main",
              toInput: "main",
            },
          });
        }
      }
    }

    return {
      success: true,
      nodeIds,
      variableNames,
      count: nodeIds.length,
      nodeType,
      message: `Created ${nodeIds.length} ${nodeType} nodes connected in sequence. Variable names: ${variableNames.join(", ")}`,
    };
  },
};

// ============================================
// Tool: Create Multiple Video Nodes
// ============================================

export const createMultipleVideoNodesTool: VerxioTool = {
  name: "createMultipleVideoNodes",
  description:
    "Create multiple VEO nodes in sequence for generating multi-scene videos (storyboard) or extending a single video. Supports two strategies: 'separate' for independent video scenes, or 'extend' for sequential video extension. Use this tool when user requests multi-scene videos, storyboards, or video sequences.",
  inputSchema: z.object({
    workflowId: z.string().describe("ID of the workflow"),
    strategy: z
      .enum(["separate", "extend"])
      .describe(
        "Strategy: 'separate' for independent video scenes (storyboard), 'extend' for sequential video extension. Auto-detect based on user intent: use 'separate' for storyboards/multiple scenes, 'extend' for continuous/sequential video."
      ),
    videoSpecs: z
      .array(
        z.object({
          prompt: z
            .string()
            .describe(
              "Scene-specific video prompt (REQUIRED). Use descriptive, cinematic language following video-prompt-guide.txt."
            ),
          mode: z
            .enum(["text", "image", "reference", "frames", "extension"])
            .optional()
            .describe(
              "Generation mode. For 'extend' strategy, first scene can use any mode, subsequent scenes will be forced to 'extension'. For 'separate' strategy, each scene can use different modes."
            ),
          aspectRatio: z
            .enum(["16:9", "9:16"])
            .optional()
            .describe("Aspect ratio: '16:9' (landscape, default) or '9:16' (portrait)"),
          resolution: z
            .enum(["720p", "1080p", "4k"])
            .optional()
            .describe("Resolution: '720p' (default), '1080p' (8s only), '4k' (8s only)"),
          durationSeconds: z
            .enum(["4", "6", "8"])
            .optional()
            .describe(
              "Duration: '4', '6', or '8' seconds (default: '8'). Extension, reference images, 1080p, and 4k require 8s."
            ),
          negativePrompt: z.string().optional().describe("What to avoid in the video"),
          // For character consistency
          referenceImages: z
            .array(
              z.object({
                file: z.string().describe("Image file (URL, base64, or asset:filename)"),
                filename: z.string().describe("Filename for the reference image"),
              })
            )
            .optional()
            .describe(
              "Reference images for character consistency (up to 3). If not specified, will reuse from first scene if maintainCharacters is true."
            ),
          sourceImage: z
            .string()
            .optional()
            .describe(
              "Source image for image-to-video mode (URL, base64, or {{previousNode.imageUrl}})"
            ),
          firstFrame: z
            .string()
            .optional()
            .describe("First frame for frames mode (URL, base64, or {{previousNode.imageUrl}})"),
          lastFrame: z
            .string()
            .optional()
            .describe("Last frame for frames mode (URL, base64, or {{previousNode.imageUrl}})"),
          variables: z
            .string()
            .optional()
            .describe("Variable name for this node's output (defaults to veo1, veo2, etc.)"),
        })
      )
      .min(1)
      .describe("Array of video specifications, one per scene/node"),
    variablesPrefix: z
      .string()
      .optional()
      .describe("Prefix for variable names (defaults to 'veo' or 'veoScene')"),
    maintainCharacters: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "Automatically reuse reference images from first scene in subsequent scenes for character consistency (default: true). Users can override per scene by specifying referenceImages."
      ),
  }),
  execute: async (
    { workflowId, videoSpecs, variablesPrefix, strategy, maintainCharacters = true },
    context
  ) => {
    // Verify workflow belongs to user
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId: context.userId },
      include: { nodes: true },
    });

    if (!workflow) {
      return { success: false, error: "Workflow not found or access denied" };
    }

    const nodeIds: string[] = [];
    const variableNames: string[] = [];

    // Calculate starting position
    const maxX = Math.max(...workflow.nodes.map((n: any) => n.position?.x || 0), 0);
    const startX = maxX + 300;

    // Set default variables prefix
    const defaultPrefix = variablesPrefix || "veo";

    // Extract reference images from first scene for character consistency
    let sharedReferenceImages: Array<{ file: string; filename: string }> | undefined;
    if (maintainCharacters && videoSpecs.length > 0 && videoSpecs[0].referenceImages) {
      sharedReferenceImages = videoSpecs[0].referenceImages;
    }

    // For "extend" strategy, calculate total duration and warn if approaching limit
    // Per Veo 3.1 docs: Input videos can be up to 141 seconds, output up to 148 seconds
    // Each extension adds 7 seconds (per docs), but backend generates 8-second segments
    if (strategy === "extend") {
      // First video is typically 8 seconds, each extension adds ~7-8 seconds
      // Maximum input: 141 seconds, maximum output: 148 seconds
      // Up to 20 extensions allowed (per Veo 3.1 docs)
      const estimatedDuration = 8 + (videoSpecs.length - 1) * 7; // First 8s, then 7s per extension
      if (estimatedDuration > 148) {
        return {
          success: false,
          error: `Total video duration would exceed 148 seconds (estimated ${estimatedDuration}s). Maximum 20 extensions allowed (per Veo 3.1 docs).`,
        };
      }
    }

    // Create nodes sequentially
    for (let i = 0; i < videoSpecs.length; i++) {
      const spec = videoSpecs[i];
      const variableName = spec.variables || `${defaultPrefix}${i + 1}`;
      const nodeName = `Veo Video ${i + 1}`;

      // Calculate position (vertical stacking)
      const position = {
        x: startX,
        y: i * 150,
      };

      // Create node data
      const nodeData: Record<string, any> = {
        variables: variableName,
        prompt: spec.prompt,
      };

      // Handle strategy-specific logic
      if (strategy === "extend") {
        if (i === 0) {
          // First node: use specified mode or default to "text"
          nodeData.mode = spec.mode || "text";

          // Set defaults for first node
          nodeData.aspectRatio = spec.aspectRatio || "16:9";
          nodeData.resolution = spec.resolution || "720p";
          nodeData.durationSeconds = spec.durationSeconds || "8";

          // Add reference images if specified
          if (spec.referenceImages && spec.referenceImages.length > 0) {
            nodeData.referenceImages = spec.referenceImages;
          }

          // Add source image if specified (for image-to-video mode)
          if (spec.sourceImage) {
            nodeData.sourceImage = spec.sourceImage;
          }

          // Add frames if specified (for frames mode)
          if (spec.firstFrame) {
            nodeData.firstFrame = spec.firstFrame;
          }
          if (spec.lastFrame) {
            nodeData.lastFrame = spec.lastFrame;
          }
        } else {
          // Subsequent nodes: force extension mode
          nodeData.mode = "extension";
          nodeData.sourceVideo = `{{${variableNames[i - 1]}.videoUrl}}`;

          // Extension mode requirements (per Veo 3.1 docs):
          // - Input videos (the video being extended) must be 720p resolution
          // - Input videos can be up to 141 seconds long
          // - Each extension adds 7 seconds of new content (per docs)
          // - Backend automatically handles resolution and duration for extension generation
          // - Output can be up to 148 seconds total
          // Note: resolution and durationSeconds are not set here - backend handles them automatically
          // The aspectRatio can be specified to match the input video
          if (spec.aspectRatio) {
            nodeData.aspectRatio = spec.aspectRatio;
          }

          // Optional prompt for extension (defaults to "Extend this video naturally" in backend)
          if (spec.prompt) {
            nodeData.prompt = spec.prompt;
          }
        }
      } else {
        // "separate" strategy: each node generates independently
        nodeData.mode = spec.mode || "text";
        nodeData.aspectRatio = spec.aspectRatio || "16:9";
        nodeData.resolution = spec.resolution || "720p";
        nodeData.durationSeconds = spec.durationSeconds || "8";

        // Use scene-specific reference images, or reuse from first scene if maintainCharacters is true
        if (spec.referenceImages && spec.referenceImages.length > 0) {
          nodeData.referenceImages = spec.referenceImages;
        } else if (maintainCharacters && sharedReferenceImages && i > 0) {
          // Reuse reference images from first scene for character consistency
          nodeData.referenceImages = sharedReferenceImages;
        }

        // Add source image if specified
        if (spec.sourceImage) {
          nodeData.sourceImage = spec.sourceImage;
        }

        // Add frames if specified
        if (spec.firstFrame) {
          nodeData.firstFrame = spec.firstFrame;
        }
        if (spec.lastFrame) {
          nodeData.lastFrame = spec.lastFrame;
        }
      }

      // Add negative prompt if specified
      if (spec.negativePrompt) {
        nodeData.negativePrompt = spec.negativePrompt;
      }

      // Create the node
      const node = await prisma.node.create({
        data: {
          workflowId,
          name: nodeName,
          type: "VEO",
          position,
          data: nodeData,
        },
      });

      nodeIds.push(node.id);
      variableNames.push(variableName);

      // Connect to previous node if not the first
      if (i > 0) {
        const previousNodeId = nodeIds[i - 1];

        // Check if connection already exists
        const existingConnection = await prisma.connection.findFirst({
          where: {
            fromNodeId: previousNodeId,
            toNodeId: node.id,
          },
        });

        if (!existingConnection) {
          await prisma.connection.create({
            data: {
              workflowId,
              fromNodeId: previousNodeId,
              toNodeId: node.id,
              fromOutput: "main",
              toInput: "main",
            },
          });
        }
      }
    }

    return {
      success: true,
      nodeIds,
      variableNames,
      count: nodeIds.length,
      strategy,
      message: `Created ${nodeIds.length} VEO nodes using ${strategy} strategy. Variable names: ${variableNames.join(", ")}`,
    };
  },
};

// ============================================
// Tool: Get Skills
// ============================================

export const getSkillsTool: VerxioTool = {
  name: "getSkills",
  description: "List user's skills that extend AI capabilities",
  inputSchema: z.object({}),
  execute: async (_, context) => {
    const skills = await prisma.userSkill.findMany({
      where: { userId: context.userId },
      select: {
        id: true,
        name: true,
        description: true,
        url: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      skills,
      count: skills.length,
    };
  },
};

// ============================================
// Tool: Add Skill
// ============================================

export const addSkillTool: VerxioTool = {
  name: "addSkill",
  description:
    "Add a new skill from a URL. The skill file will be fetched and parsed automatically.",
  inputSchema: z.object({
    url: z.string().url().describe("URL to the skill file (e.g., https://solana.com/SKILL.md)"),
  }),
  execute: async ({ url }, context) => {
    try {
      const content = await skillService.fetchSkillFromUrl(url);
      const metadata = skillService.parseSkillMetadata(content);
      const skill = await skillService.createSkill({
        userId: context.userId,
        name: metadata.name,
        description: metadata.description,
        url,
        content,
      });

      return {
        success: true,
        skill: {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          url: skill.url,
        },
        message: `Skill "${skill.name}" added successfully`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add skill",
      };
    }
  },
};

// ============================================
// Tool: Update Skill
// ============================================

export const updateSkillTool: VerxioTool = {
  name: "updateSkill",
  description:
    "Update an existing skill from a URL. The skill file will be fetched and parsed automatically.",
  inputSchema: z.object({
    skillId: z.string().describe("ID of the skill to update"),
    url: z.string().url().describe("URL to the updated skill file"),
  }),
  execute: async ({ skillId, url }, context) => {
    try {
      const content = await skillService.fetchSkillFromUrl(url);
      const metadata = skillService.parseSkillMetadata(content);
      const skill = await skillService.updateSkill(context.userId, skillId, {
        name: metadata.name,
        description: metadata.description,
        url,
        content,
      });

      return {
        success: true,
        skill: {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          url: skill.url,
        },
        message: `Skill "${skill.name}" updated successfully`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update skill",
      };
    }
  },
};

// ============================================
// Tool: Remove Skill
// ============================================

export const removeSkillTool: VerxioTool = {
  name: "removeSkill",
  description: "Remove a skill from the user's skill collection",
  inputSchema: z.object({
    skillId: z.string().describe("ID of the skill to remove"),
  }),
  execute: async ({ skillId }, context) => {
    try {
      // Get skill name before deletion for the response
      const skill = await prisma.userSkill.findFirst({
        where: { id: skillId, userId: context.userId },
        select: { name: true },
      });

      if (!skill) {
        return {
          success: false,
          error: "Skill not found",
        };
      }

      await skillService.deleteSkill(context.userId, skillId);

      return {
        success: true,
        message: `Skill "${skill.name}" removed successfully`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to remove skill",
      };
    }
  },
};

// ============================================
// Export All Tools
// ============================================

export const verxioTools: VerxioTool[] = [
  listNodeTypesTool,
  createWorkflowTool,
  getWorkflowTool,
  addNodeTool,
  configureNodeTool,
  connectNodesTool,
  executeWorkflowTool,
  getCredentialsTool,
  checkCredentialTool,
  requestCredentialTool,
  getConnectionsTool,
  searchDocumentationTool,
  generateCodeTool,
  deleteNodeTool,
  listWorkflowsTool,
  createMultipleDesignNodesTool,
  createMultipleVideoNodesTool,
  getSkillsTool,
  addSkillTool,
  updateSkillTool,
  removeSkillTool,
];

export default verxioTools;
