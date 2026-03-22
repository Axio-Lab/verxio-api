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
import { runSingleNodeAndWait } from "../singleNodeExecutionService";

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
  integrationId?: string;
  evolvePersonality?: boolean;
  skillScope?: "ALL_SKILLS" | "SELECTED_SKILLS" | "NO_SKILLS";
  allowedSkillIds?: string[];
}

// ============================================
// Available Node Types for Reference
// ============================================

export const AVAILABLE_NODE_TYPES = {
  // Triggers (start workflow execution)
  triggers: [
    {
      type: "MANUAL_TRIGGER",
      description: "Starts a run when the user clicks Run (default manual start)",
    },
    {
      type: "MANUAL_INPUT",
      description:
        "Prompts the user for input when execution reaches this node. Not a substitute for MANUAL_TRIGGER: use MANUAL_TRIGGER to start the run, then MANUAL_INPUT if you need fields at run time.",
    },
    { type: "TIMED_TRIGGER", description: "Workflow triggered on a schedule (cron)" },
    { type: "WEBHOOK", description: "Workflow triggered by HTTP POST request" },
    { type: "GOOGLE_FORM_TRIGGER", description: "Triggered when a Google Form is submitted" },
    { type: "STRIPE_TRIGGER", description: "Triggered by Stripe webhook events" },
    { type: "AIRTABLE_TRIGGER", description: "Triggered by Airtable record changes" },
    { type: "TELEGRAM_TRIGGER", description: "Triggered by incoming Telegram messages" },
    { type: "WHATSAPP_TRIGGER", description: "Triggered by incoming WhatsApp messages" },
    {
      type: "COMPOSIO_TRIGGER",
      description:
        "Triggered by Composio app events (e.g. SLACK_CHANNEL_CREATED, GITHUB_COMMIT_EVENT) with custom trigger config",
    },
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
  ],

  // Composio (10,000+ external actions)
  composio: [
    {
      type: "COMPOSIO_ACTION",
      description:
        "Execute any of 10,000+ actions from 800+ apps via Composio (GitHub, Notion, Linear, Jira, HubSpot, Salesforce, ElevenLabs, Firecrawl, Shopify, Zendesk, etc.)",
    },
  ],

  // Web Automation (TinyFish)
  web: [
    {
      type: "TINYFISH",
      description:
        "Browse any website, extract data, fill forms, or complete multi-step web tasks using AI-powered browser automation (TinyFish). Supports stealth mode and geographic proxies.",
    },
  ],

  // Search & Research (Valyu AI)
  valyu: [
    {
      type: "VALYU_SEARCH",
      description:
        "Search across web and proprietary data sources (academic, news, stocks) via Valyu AI",
      requiredCredential: "VALYU",
    },
    {
      type: "VALYU_CONTENTS",
      description: "Extract and process content from URLs with optional AI summarization via Valyu",
      requiredCredential: "VALYU",
    },
    {
      type: "VALYU_ANSWER",
      description: "Generate AI-powered answers with integrated search via Valyu",
      requiredCredential: "VALYU",
    },
    {
      type: "VALYU_DEEP_RESEARCH",
      description:
        "Run comprehensive multi-source deep research with detailed reports via Valyu (async, can take minutes)",
      requiredCredential: "VALYU",
    },
  ],

  // Logic & Code
  logic: [
    { type: "DECIDER", description: "Conditional branching based on data" },
    { type: "CODE_BLOCK", description: "Execute custom TypeScript code" },
    { type: "PLAN", description: "AI-powered planning and decision making" },
    {
      type: "AGENT_TEAM",
      description:
        "Orchestrate multiple AI agents in one node: sequential (pipeline), parallel (same task, multiple agents), or supervisor (one agent delegates and reviews). Each agent has name, role, and optional personality. Use for research→write→edit pipelines or adaptive multi-step tasks.",
    },
  ],

  // Media
  media: [
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
    {
      type: "SEEDANCE",
      description:
        "BytePlus Seedance video generation. Supports text-to-video, image-to-video (first frame), first-and-last frame interpolation, and multi-reference image-to-video (1-4 images). Uses Seedance 1.5 Pro model.",
    },
    {
      type: "SEEDREAM",
      description:
        "BytePlus Seedream image generation. Supports text-to-image, single image editing, and multi-image blending (1-4 reference images). Uses Seedream 4.5 model. Supports batch generation.",
    },
    {
      type: "OUTPUT",
      description:
        "Display and download workflow outputs (images, videos, audio) with preview and download.",
    },
    {
      type: "MARKDOWN",
      description:
        "Display a node's text output as markdown (e.g. {{gemini.text}}). User can view and download as .md file.",
    },
  ],
};

// ============================================
// Node schemas (exact action names and fields) — derived from backend executors
// Agent must use these exact strings when configuring nodes (e.g. "listEvents" not "list")
// ============================================

export type NodeSchemaEntry = {
  description: string;
  actions?: string[];
  fieldsByAction?: Record<string, string[]>;
  required?: string[];
  credential?: string; // e.g. "Google OAuth", "AIRTABLE"
};

export const NODE_SCHEMAS: Record<string, NodeSchemaEntry> = {
  GOOGLE_CALENDAR: {
    description: "Manage calendar events.",
    credential: "Google OAuth",
    actions: [
      "listEvents",
      "createEvent",
      "updateEvent",
      "deleteEvent",
      "getEvent",
      "findFreeBusy",
    ],
    fieldsByAction: {
      listEvents: [
        "timeMin (ISO, optional, default: now)",
        "timeMax (ISO, optional)",
        "maxResults (number, default 10)",
        "calendarId (default 'primary')",
      ],
      createEvent: [
        "summary (REQ)",
        "startDateTime (REQ)",
        "endDateTime (REQ)",
        "calendarId",
        "description",
        "timeZone",
        "attendees",
        "location",
        "addMeetLink (optional: true to create Google Meet link for virtual meeting)",
      ],
      updateEvent: [
        "eventId (REQ)",
        "calendarId",
        "summary",
        "description",
        "startDateTime",
        "endDateTime",
        "location",
      ],
      deleteEvent: ["eventId (REQ)", "calendarId"],
      getEvent: ["eventId (REQ)", "calendarId"],
      findFreeBusy: ["items (JSON array of calendar IDs)"],
    },
    required: ["action", "variables"],
  },
  GOOGLE_SHEETS: {
    description: "Read/write Google Sheets.",
    credential: "Google OAuth",
    actions: [
      "readRange",
      "writeRange",
      "appendRow",
      "updateCells",
      "clearRange",
      "createSheet",
      "createSpreadsheet",
    ],
    fieldsByAction: {
      readRange: ["spreadsheetId (REQ)", "sheetName (REQ)", "range (REQ)"],
      writeRange: [
        "spreadsheetId (REQ)",
        "sheetName (REQ)",
        "range (REQ)",
        "values (JSON array of arrays)",
      ],
      appendRow: ["spreadsheetId (REQ)", "sheetName (REQ)", "values (REQ)"],
      updateCells: ["spreadsheetId (REQ)", "sheetName (REQ)", "range (REQ)", "values (REQ)"],
      clearRange: ["spreadsheetId (REQ)", "sheetName (REQ)", "range (REQ)"],
      createSpreadsheet: ["title (REQ)"],
      createSheet: ["spreadsheetId (REQ)", "sheetTitle (REQ)"],
    },
    required: ["action", "variables"],
  },
  GOOGLE_DOCS: {
    description: "Create, read, and edit Google Docs.",
    credential: "Google OAuth",
    actions: ["createDocument", "readDocument", "insertText", "updateText", "exportDocument"],
    fieldsByAction: {
      createDocument: ["title (REQ)"],
      readDocument: ["documentId (REQ)"],
      insertText: ["documentId (REQ)", "text (REQ)", "index (optional)"],
      updateText: ["documentId (REQ)", "text (REQ)", "index (optional)"],
      exportDocument: ["documentId (REQ)", "mimeType (e.g. application/pdf)"],
    },
    required: ["action", "variables"],
  },
  GOOGLE_DRIVE: {
    description: "Upload, download, list, and manage files in Google Drive.",
    credential: "Google OAuth",
    actions: [
      "upload",
      "download",
      "list",
      "createFolder",
      "move",
      "copy",
      "delete",
      "share",
      "getMetadata",
    ],
    fieldsByAction: {
      list: ["folderId (optional)", "query (optional)"],
      upload: ["fileName (REQ)", "fileContent or file URL", "parentFolderId", "mimeType"],
      download: ["fileId (REQ)"],
      createFolder: ["fileName (REQ)", "parentFolderId (optional)"],
      move: ["fileId (REQ)", "destinationFolderId (REQ)"],
      copy: ["fileId (REQ)", "destinationFolderId (REQ)"],
      delete: ["fileId (REQ)"],
      share: ["fileId (REQ)", "email (REQ)", "role (reader|writer|commenter|owner)"],
      getMetadata: ["fileId (REQ)", "fields (optional)"],
    },
    required: ["action", "variables"],
  },
  GOOGLE_MEET: {
    description: "Create Google Meet links via Calendar.",
    credential: "Google OAuth",
    actions: ["createMeeting", "getMeetingLink"],
    fieldsByAction: {
      createMeeting: [
        "summary (REQ)",
        "startDateTime (REQ)",
        "endDateTime (REQ)",
        "calendarId",
        "description",
        "timeZone",
        "attendees",
        "location",
      ],
      getMeetingLink: ["eventId (REQ)"],
    },
    required: ["action", "variables"],
  },
  GOOGLE_SLIDES: {
    description: "Create and edit Google Slides presentations.",
    credential: "Google OAuth",
    actions: [
      "createPresentation",
      "listPresentations",
      "createSlide",
      "insertText",
      "insertImage",
      "insertShape",
      "insertTable",
      "replaceText",
      "replaceImage",
      "exportPresentation",
      "getPresentation",
    ],
    fieldsByAction: {
      createPresentation: ["title (REQ)"],
      listPresentations: [],
      createSlide: ["presentationId (REQ)"],
      insertText: ["presentationId (REQ)", "text (REQ)", "slideIndex", "x", "y", "width", "height"],
      insertImage: [
        "presentationId (REQ)",
        "imageUrl or imageDriveFileId",
        "slideIndex",
        "x",
        "y",
        "width",
        "height",
      ],
      replaceText: ["presentationId (REQ)", "oldText (REQ)", "newText (REQ)"],
      exportPresentation: ["presentationId (REQ)", "mimeType (optional)"],
      getPresentation: ["presentationId (REQ)"],
    },
    required: ["action", "variables"],
  },
  AIRTABLE: {
    description: "Read/write Airtable bases and records.",
    credential: "AIRTABLE (API key)",
    actions: [
      "listBases",
      "listTables",
      "getRecords",
      "getRecord",
      "createRecord",
      "updateRecord",
      "deleteRecord",
      "listFields",
    ],
    fieldsByAction: {
      listBases: [],
      listTables: ["baseId (REQ)"],
      getRecords: [
        "baseId (REQ)",
        "tableId (REQ)",
        "maxRecords",
        "view",
        "filterByFormula",
        "sort",
        "fields",
      ],
      getRecord: ["baseId (REQ)", "tableId (REQ)", "recordId (REQ)"],
      createRecord: ["baseId (REQ)", "tableId (REQ)", "fieldsData (JSON, REQ)"],
      updateRecord: ["baseId (REQ)", "tableId (REQ)", "recordId (REQ)", "fieldsData (JSON, REQ)"],
      deleteRecord: ["baseId (REQ)", "tableId (REQ)", "recordId (REQ)"],
      listFields: ["baseId (REQ)", "tableId (REQ)"],
    },
    required: ["action", "variables", "credentialId"],
  },
  COMPOSIO_ACTION: {
    description:
      "Execute any of 10,000+ actions from 800+ apps via Composio (GitHub, Notion, Linear, Jira, HubSpot, Salesforce, ElevenLabs, Firecrawl, Shopify, Zendesk, etc.). Fields: composioActionName (REQ, e.g. GITHUB_CREATE_ISSUE, NOTION_CREATE_PAGE), composioParams (object with action-specific params), variables (output variable name, default: composioAction).",
    required: ["composioActionName", "variables"],
  },
  COMPOSIO_TRIGGER: {
    description:
      "Subscribe workflow start to a Composio trigger slug. Fields: composioTriggerSlug (REQ, e.g. SLACK_CHANNEL_CREATED), triggerConfig (JSON object), variables (default: composioTrigger), connectedAccountId (optional), enabled (default true).",
    required: ["composioTriggerSlug", "variables"],
  },
  TINYFISH: {
    description:
      "AI-powered web automation via TinyFish. Browse any website, extract structured data, fill forms, navigate multi-step workflows, handle bot-protected sites. Fields: url (REQ, target website URL), goal (REQ, natural language description of what to do), browserProfile (optional: 'lite' default or 'stealth' for anti-detection), proxyCountry (optional: US, GB, CA, DE, FR, JP, AU), variables (output variable name, default: tinyfish).",
    required: ["url", "goal", "variables"],
  },
  AGENT_TEAM: {
    description:
      "Orchestrate multiple AI agents in one node. Fields: variables (REQ), objective (REQ), strategy (REQ: 'sequential'|'parallel'|'supervisor'), agents (REQ, array of agent objects; you can add as many agents as needed). Each agent: { name (REQ), role (REQ), personality (optional, extra instructions for this agent) }. To update name/role/personality or add more agents, use configureNode with config.agents set to the full array (e.g. add a new agent by appending to the list). maxRounds (optional, for supervisor).",
    required: ["variables", "objective", "strategy", "agents"],
  },
  GMAIL: {
    description: "Send, list, and manage Gmail emails.",
    credential: "Google OAuth",
    actions: [
      "sendEmail",
      "sendEmailWithAttachment",
      "listEmails",
      "getEmail",
      "createDraft",
      "sendDraft",
      "replyToEmail",
      "forwardEmail",
      "deleteEmail",
      "addLabel",
    ],
    fieldsByAction: {
      sendEmail: ["to (REQ)", "subject (REQ)", "body (REQ)", "cc", "bcc", "isHtml"],
      sendEmailWithAttachment: [
        "to (REQ)",
        "subject (REQ)",
        "body (REQ)",
        "attachmentUrl or attachmentDriveFileId",
        "attachmentName",
      ],
      listEmails: ["query (Gmail search)", "maxResults"],
      getEmail: ["emailId (REQ)"],
      createDraft: ["to (REQ)", "subject (REQ)", "body (REQ)", "cc", "bcc"],
      sendDraft: ["draftId (REQ)"],
      replyToEmail: ["emailId (REQ)", "body (REQ)", "replyAll"],
      forwardEmail: ["emailId (REQ)", "forwardTo (REQ)", "body (optional)"],
      deleteEmail: ["emailId (REQ)"],
      addLabel: ["emailId (REQ)", "labelId or labelName (REQ)"],
    },
    required: ["action", "variables"],
  },
  LOYALTY_PROGRAM: {
    description:
      "Loyalty program operations (get programs, create program, issue pass, gift/revoke points).",
    actions: [
      "get_programs",
      "create_program",
      "get_total_members",
      "issue_pass",
      "get_program_details",
      "get_program_users",
      "gift_points",
      "revoke_points",
    ],
    required: ["action", "variables"],
  },
  LOYALTY_DEAL: {
    description:
      "Loyalty deal operations (stats, activity, create deal, lookup voucher, add quantity, extend expiry).",
    actions: [
      "get_stats",
      "get_recent_activity",
      "get_deals",
      "create_deal",
      "lookup_voucher",
      "add_quantity",
      "extend_expiry",
    ],
    required: ["action", "variables"],
  },
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
// Tool: Get Node Schema (exact actions and fields for a node type)
// ============================================

export const getNodeSchemaTool: VerxioTool = {
  name: "getNodeSchema",
  description:
    "Get the exact schema for a node type: allowed action values and required/optional fields. Use before addNode or configureNode so you use correct action names (e.g. GOOGLE_CALENDAR uses 'listEvents' not 'list'; GMAIL uses 'listEmails' not 'list'). Pass nodeType 'all' to get every action-based node schema at once.",
  inputSchema: z.object({
    nodeType: z
      .string()
      .describe(
        "Node type (e.g. GOOGLE_CALENDAR, GOOGLE_SHEETS, GMAIL, COMPOSIO_ACTION, COMPOSIO_TRIGGER, TINYFISH, AGENT_TEAM, LOYALTY_PROGRAM, LOYALTY_DEAL). Use 'all' to return every schema."
      ),
  }),
  execute: async ({ nodeType }) => {
    const upper = nodeType.toUpperCase();
    if (upper === "ALL") {
      return {
        success: true,
        nodeType: "all",
        schemas: NODE_SCHEMAS,
        registeredTypes: Object.keys(NODE_SCHEMAS),
      };
    }
    const schema = NODE_SCHEMAS[upper] ?? NODE_SCHEMAS[nodeType];
    if (schema) {
      return { success: true, nodeType: upper || nodeType, schema };
    }
    return {
      success: false,
      nodeType: nodeType,
      message: `No schema registered for "${nodeType}". Use exact type from list below.`,
      registeredTypes: Object.keys(NODE_SCHEMAS),
    };
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
    VALYU_SEARCH: "VALYU",
    VALYU_CONTENTS: "VALYU",
    VALYU_ANSWER: "VALYU",
    VALYU_DEEP_RESEARCH: "VALYU",
    TINYFISH: "TINYFISH",
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
          ANTHROPIC: [
            "claude-sonnet-4-6",
            "claude-opus-4-6",
            "claude-sonnet-4-5",
            "claude-haiku-4-5",
            "claude-opus-4-5",
          ],
          OPENAI: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
          GEMINI: ["gemini-3.1-pro-preview", "gemini-3-flash-preview"],
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

    // Bump workflow.updatedAt so the client cache knows the workflow changed
    await prisma.workflow.update({
      where: { id: workflowId },
      data: { updatedAt: new Date() },
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
        VALYU_SEARCH: "VALYU",
        VALYU_CONTENTS: "VALYU",
        VALYU_ANSWER: "VALYU",
        VALYU_DEEP_RESEARCH: "VALYU",
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

    // Bump workflow.updatedAt so the client cache knows the workflow changed
    await prisma.workflow.update({
      where: { id: node.workflowId },
      data: { updatedAt: new Date() },
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

    // Bump workflow.updatedAt so the client cache knows the workflow changed
    await prisma.workflow.update({
      where: { id: sourceNode.workflowId },
      data: { updatedAt: new Date() },
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
  description:
    "Execute a workflow and wait for the result. Returns the actual output so you can summarize it for the user. Always present the output in your reply.",
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

    // Create a publicChatRun to track execution and poll for results
    const run = await prisma.publicChatRun.create({
      data: {
        workflowId,
        status: "PENDING",
        input: { ...(inputData || {}), triggeredBy: "agent" } as object,
      },
    });

    // Send Inngest event to trigger workflow
    await inngest.send({
      name: "workflow/trigger",
      data: {
        workflowId,
        userId: context.userId,
        triggerNodeId: triggerNode.id,
        initialData: inputData || {},
        triggeredBy: "agent",
        publicChatRunId: run.id,
      },
    });

    // Poll for completion (up to 90s)
    const POLL_INTERVAL = 1500;
    const MAX_WAIT = 90_000;
    const deadline = Date.now() + MAX_WAIT;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      const updated = await prisma.publicChatRun.findUnique({
        where: { id: run.id },
      });
      if (!updated) break;
      if (updated.status === "COMPLETED") {
        return {
          success: true,
          output: updated.output || {},
          workflowId,
          workflowName: workflow.name,
          message:
            "Workflow executed successfully. Summarize the output in human language for the user in your reply.",
        };
      }
      if (updated.status === "FAILED") {
        return {
          success: false,
          error: updated.error || "Workflow execution failed",
          workflowId,
          workflowName: workflow.name,
        };
      }
    }

    return {
      success: false,
      error: "Workflow did not complete within the time limit (90s). It may still be running.",
      workflowId,
      workflowName: workflow.name,
    };
  },
};

// ============================================
// Tool: Execute Single Node and Wait for Result
// ============================================

export const executeSingleNodeAndWaitTool: VerxioTool = {
  name: "executeSingleNodeAndWait",
  description:
    "Run a single workflow node and wait for its output. Use for one-off actions that need workflow nodes (GOOGLE_CALENDAR, DESIGN, VEO, CODE_BLOCK, etc.). For Composio one-offs (create doc, send email, list events via Composio), use runComposioAction instead—it runs directly without adding nodes. Add/configure the node with addNode and configureNode; fill all required fields; then call this with nodeId. Summarize the output in human language in your reply.",
  inputSchema: z.object({
    workflowId: z.string().describe("ID of the workflow that contains the node"),
    nodeId: z.string().describe("ID of the node to execute"),
    nodeOverrides: z
      .record(z.string(), z.any())
      .optional()
      .describe(
        "Optional runtime overrides for node data (e.g. timeMin, timeMax for calendar list; prompt for AI nodes). Merged with node's configured data for this run only."
      ),
  }),
  execute: async ({ workflowId, nodeId, nodeOverrides }, context) => {
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId: context.userId },
      include: { nodes: true },
    });

    if (!workflow) {
      return { success: false, error: "Workflow not found or access denied" };
    }

    const node = workflow.nodes.find((n: any) => n.id === nodeId);
    if (!node) {
      return { success: false, error: `Node "${nodeId}" not found in workflow` };
    }

    const result = await runSingleNodeAndWait(workflowId, context.userId, nodeId, nodeOverrides);

    if (result.success) {
      return {
        success: true,
        output: result.output,
        message:
          "Node executed successfully. Summarize this output in human language for the user in your reply.",
      };
    }

    return {
      success: false,
      error: result.error,
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

    // Bump workflow.updatedAt so the client cache knows the workflow changed
    await prisma.workflow.update({
      where: { id: node.workflowId },
      data: { updatedAt: new Date() },
    });

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
              "Model to use. For DESIGN: 'gemini-2.5-flash-image' (default). For DESIGN_PRO: 'gemini-3.1-flash-image-preview' (default, Design Agent Pro)."
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
        nodeType === "DESIGN_PRO" ? `Design Agent Pro ${i + 1}` : `Design Agent ${i + 1}`;

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
          nodeData.model = "gemini-3.1-flash-image-preview";
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
    let skills = await prisma.userSkill.findMany({
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

    // When in integration context with restricted skill scope, filter
    if (context.skillScope === "NO_SKILLS") {
      skills = [];
    } else if (
      context.skillScope === "SELECTED_SKILLS" &&
      context.allowedSkillIds &&
      context.allowedSkillIds.length > 0
    ) {
      skills = skills.filter((s: { id: string }) => context.allowedSkillIds!.includes(s.id));
    }

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
// Agent Personality (Soul) Evolution Tool
// ============================================

const updateSoulMdTool: VerxioTool = {
  name: "updateSoulMd",
  description:
    "Update your own personality (soul.md) based on user interaction patterns. " +
    "Only available when personality evolution is enabled. " +
    "Use sparingly — only when you have clear evidence that the user prefers a different communication style. " +
    "You can update a specific section (coreTruths, boundaries, vibe) or the full document.",
  inputSchema: z.object({
    updatedSection: z
      .enum(["coreTruths", "boundaries", "vibe", "full"])
      .describe(
        "Which section to update: 'coreTruths', 'boundaries', 'vibe', or 'full' for the entire soul.md"
      ),
    content: z.string().describe("The new content for the specified section or the full soul.md"),
    reason: z
      .string()
      .describe(
        "Brief explanation of why you are evolving your personality (based on user interaction patterns)"
      ),
  }),
  execute: async (
    args: { updatedSection: string; content: string; reason: string },
    context: ToolContext
  ) => {
    try {
      if (!context.evolvePersonality || !context.integrationId) {
        return {
          success: false,
          error: "Personality evolution is not enabled for this integration.",
        };
      }

      // Fetch current soul.md
      const integration = await prisma.chatIntegration.findFirst({
        where: { id: context.integrationId, userId: context.userId },
      });

      if (!integration) {
        return { success: false, error: "Integration not found." };
      }

      let updatedSoulMd: string;

      if (args.updatedSection === "full") {
        updatedSoulMd = args.content;
      } else {
        // Parse existing soul.md and update the specific section
        const currentSoul = integration.soulMd || "";
        const sectionMap: Record<string, string> = {
          coreTruths: "## Core Truths",
          boundaries: "## Boundaries",
          vibe: "## The Vibe",
        };
        const sectionHeader = sectionMap[args.updatedSection];
        if (!sectionHeader) {
          return { success: false, error: `Unknown section: ${args.updatedSection}` };
        }

        // Find and replace the section
        const sectionRegex = new RegExp(
          `(${sectionHeader.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})([\\s\\S]*?)(?=\\n## |$)`,
          "i"
        );

        if (sectionRegex.test(currentSoul)) {
          updatedSoulMd = currentSoul.replace(sectionRegex, `${sectionHeader}\n${args.content}\n`);
        } else {
          // Section doesn't exist; append
          updatedSoulMd = `${currentSoul}\n\n${sectionHeader}\n${args.content}\n`;
        }
      }

      await prisma.chatIntegration.update({
        where: { id: context.integrationId },
        data: { soulMd: updatedSoulMd },
      });

      return {
        success: true,
        message: `Personality ${args.updatedSection === "full" ? "fully updated" : `section "${args.updatedSection}" updated`}. Reason: ${args.reason}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update soul.md",
      };
    }
  },
};

// ============================================
// Tool: Browse Website (TinyFish)
// ============================================

const browseWebsiteTool: VerxioTool = {
  name: "browseWebsite",
  description:
    "Browse any website using AI-powered browser automation (TinyFish). Extract data, fill forms, navigate multi-step workflows, handle authenticated or bot-protected sites. Returns structured results. Use this when you need live data from a website that has no API.",
  inputSchema: z.object({
    url: z.string().describe("Target website URL to browse"),
    goal: z
      .string()
      .describe(
        "Natural language description of what to accomplish on the website. Be specific: include output format, stopping conditions, and edge case handling."
      ),
    browserProfile: z
      .enum(["lite", "stealth"])
      .optional()
      .describe(
        "Browser profile: 'lite' (default) or 'stealth' for anti-detection on bot-protected sites"
      ),
    proxyCountry: z
      .string()
      .optional()
      .describe("ISO country code for proxy location: US, GB, CA, DE, FR, JP, AU"),
    credentialId: z
      .string()
      .optional()
      .describe(
        "Optional TinyFish credential ID. If provided, uses the user's TinyFish API key; otherwise falls back to the server TinyFish key if configured."
      ),
  }),
  execute: async (
    args: {
      url: string;
      goal: string;
      browserProfile?: "lite" | "stealth";
      proxyCountry?: string;
      credentialId?: string;
    },
    context: ToolContext
  ) => {
    try {
      const { runWebAutomation } = await import("@/services/tinyfish/tinyfishService");
      let apiKeyOverride: string | undefined;
      if (args.credentialId) {
        const { getCredential } = await import("@/services/credentialService");
        const cred = await getCredential(args.credentialId, context.userId);
        apiKeyOverride = cred.value;
      }
      const result = await runWebAutomation(
        args.url,
        args.goal,
        {
          browserProfile: args.browserProfile,
          proxyCountry: args.proxyCountry,
        },
        apiKeyOverride
      );

      if (result.status === "FAILED") {
        return {
          success: false,
          error: result.error?.message || "Web automation failed",
          run_id: result.run_id,
        };
      }

      return {
        success: true,
        result: result.result,
        run_id: result.run_id,
        num_of_steps: result.num_of_steps,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to browse website",
      };
    }
  },
};

// ============================================
// Tool: Check Web Automation Run (TinyFish)
// ============================================

const checkWebRunTool: VerxioTool = {
  name: "checkWebRun",
  description:
    "Check the status and result of a previously started async web automation run (TinyFish). Use after browseWebsiteAsync or when you need to poll for completion.",
  inputSchema: z.object({
    runId: z.string().describe("The run_id returned by a previous TinyFish automation"),
  }),
  execute: async (args: { runId: string }, context: ToolContext) => {
    try {
      const { getRunStatus } = await import("@/services/tinyfish/tinyfishService");
      const result = await getRunStatus(args.runId);

      return {
        success: result.status === "COMPLETED",
        status: result.status,
        result: result.result,
        error: result.error?.message || null,
        num_of_steps: result.num_of_steps,
        started_at: result.started_at,
        finished_at: result.finished_at,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check web run status",
      };
    }
  },
};

// ============================================
// Knowledge Base Search Tool
// ============================================

const searchKnowledgeBaseTool: VerxioTool = {
  name: "searchKnowledgeBase",
  description:
    "Search a user's knowledge base for relevant information. Returns the most relevant text chunks based on semantic similarity to the query. Use this when the user asks questions that might be answered by their uploaded documents or knowledge bases.",
  inputSchema: z.object({
    knowledgeBaseId: z.string().describe("The ID of the knowledge base to search"),
    query: z.string().describe("The search query to find relevant information"),
    topK: z.number().optional().default(5).describe("Number of results to return (default 5)"),
  }),
  execute: async (
    args: { knowledgeBaseId: string; query: string; topK?: number },
    context: ToolContext
  ) => {
    try {
      const { searchKnowledge } = await import("../knowledgeBaseService");
      const results = await searchKnowledge(args.knowledgeBaseId, args.query, args.topK || 5);
      return {
        success: true,
        results: results.map((r) => ({
          content: r.content,
          score: Math.round(r.score * 100) / 100,
        })),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Search failed" };
    }
  },
};

const listKnowledgeBasesTool: VerxioTool = {
  name: "listKnowledgeBases",
  description: "List all knowledge bases belonging to the current user.",
  inputSchema: z.object({}),
  execute: async (_args: any, context: ToolContext) => {
    try {
      const { listKnowledgeBases } = await import("../knowledgeBaseService");
      const kbs = await listKnowledgeBases(context.userId);
      return {
        success: true,
        knowledgeBases: kbs.map((kb: any) => ({
          id: kb.id,
          name: kb.name,
          description: kb.description,
          documentCount: kb.documents?.length || 0,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list knowledge bases",
      };
    }
  },
};

// ============================================
// Composio Connection Tools (in-chat connection management)
// ============================================

const listComposioConnectionsTool: VerxioTool = {
  name: "listComposioConnections",
  description:
    "List the user's connected Composio apps and their status. Use this to check which external apps (GitHub, Notion, Google, Slack, etc.) the user has connected before suggesting Composio actions.",
  inputSchema: z.object({}),
  execute: async (_args: any, context: ToolContext) => {
    try {
      const { listConnectedAccounts, isComposioConfigured } =
        await import("../composio/composioService");
      if (!isComposioConfigured()) {
        return {
          success: false,
          error:
            "Composio is not configured. The COMPOSIO_API_KEY environment variable is not set.",
        };
      }
      const accounts = await listConnectedAccounts(context.userId);
      return {
        success: true,
        connectedApps: accounts.map((a: any) => ({
          id: a.id,
          appSlug: a.appSlug,
          status: a.status,
          connectedAt: a.createdAt,
        })),
        count: accounts.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list Composio connections",
      };
    }
  },
};

const connectComposioAppTool: VerxioTool = {
  name: "connectComposioApp",
  description:
    "Initiate a connection to an external app via Composio. Returns a redirect URL. You MUST present this URL as a clickable markdown link in your reply so the user can connect without leaving the chat. Example: [Connect Google Sheets](redirectUrl). Never tell the user to go to Settings > Connections when you have the redirectUrl.",
  inputSchema: z.object({
    appSlug: z
      .string()
      .describe(
        "The Composio app slug to connect (e.g. 'github', 'notion', 'google', 'slack', 'linear', 'jira'). Use lowercase."
      ),
  }),
  execute: async (args: { appSlug: string }, context: ToolContext) => {
    try {
      const { initiateAppConnection, isComposioConfigured } =
        await import("../composio/composioService");
      if (!isComposioConfigured()) {
        return {
          success: false,
          error:
            "Composio is not configured. The COMPOSIO_API_KEY environment variable is not set.",
        };
      }
      const result = await initiateAppConnection(context.userId, args.appSlug.toLowerCase());
      return {
        success: true,
        appSlug: args.appSlug.toLowerCase(),
        redirectUrl: result.redirectUrl,
        connectionId: result.connectionId,
        message: result.redirectUrl
          ? `In your reply, present the connection link as a clickable markdown link, e.g. [Connect ${args.appSlug}](${result.redirectUrl}). The user can click it to authorize without leaving the chat. Do NOT tell them to go to Settings > Connections.`
          : `Connection created successfully (no OAuth redirect needed).`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to initiate connection";
      if (msg.includes("MissingRequiredFields") || msg.includes("Missing required")) {
        return {
          success: false,
          error: msg,
          hint: "This app requires additional configuration fields that cannot be provided through the chat. The user should connect this app from the Connections page in Settings.",
        };
      }
      return { success: false, error: msg };
    }
  },
};

const searchComposioAppsTool: VerxioTool = {
  name: "searchComposioApps",
  description:
    "Search available Composio apps/toolkits by name or keyword. Use this when the user asks what apps are available to connect, or when you need to find the correct app slug for a connection. Returns matching apps with their slugs and descriptions.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Search query to find apps (e.g. 'github', 'email', 'crm', 'social media'). Case-insensitive."
      ),
  }),
  execute: async (args: { query: string }, context: ToolContext) => {
    try {
      const { listAvailableApps, isComposioConfigured } =
        await import("../composio/composioService");
      if (!isComposioConfigured()) {
        return {
          success: false,
          error:
            "Composio is not configured. The COMPOSIO_API_KEY environment variable is not set.",
        };
      }
      const allApps = await listAvailableApps();
      const q = args.query.toLowerCase();
      const matches = allApps.filter(
        (app) =>
          app.name.toLowerCase().includes(q) ||
          app.slug.toLowerCase().includes(q) ||
          app.description.toLowerCase().includes(q) ||
          app.categories.some((c) => c.toLowerCase().includes(q))
      );
      const limited = matches.slice(0, 20);
      return {
        success: true,
        apps: limited.map((app) => ({
          slug: app.slug,
          name: app.name,
          description: app.description,
          categories: app.categories,
          noAuth: app.noAuth,
        })),
        totalMatches: matches.length,
        showing: limited.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search Composio apps",
      };
    }
  },
};

const getComposioAppDetailsTool: VerxioTool = {
  name: "getComposioAppDetails",
  description:
    "Fetch detailed information for a specific Composio app/toolkit, including the exact tool and trigger slugs. Use this before configuring COMPOSIO_ACTION nodes so you NEVER guess action names.",
  inputSchema: z.object({
    appSlug: z
      .string()
      .describe(
        "The Composio app slug (e.g. 'googledocs', 'github', 'notion', 'slack'). Use lowercase."
      ),
  }),
  execute: async (args: { appSlug: string }, _context: ToolContext) => {
    try {
      const { getAppDetails, isComposioConfigured } = await import("../composio/composioService");
      if (!isComposioConfigured()) {
        return {
          success: false,
          error:
            "Composio is not configured. The COMPOSIO_API_KEY environment variable is not set.",
        };
      }

      const appSlug = args.appSlug.toLowerCase();
      const details = await getAppDetails(appSlug);

      const tools = details?.tools || {};
      const triggers = details?.triggers || {};

      return {
        success: true,
        appSlug,
        name: details?.toolkit?.name || appSlug,
        description: details?.toolkit?.description || "",
        isMcpToolkit: !!details?.isMcpToolkit,
        tools: {
          count: tools.count ?? (tools.items?.length || 0),
          items: (tools.items || []).map((t: any) => ({
            slug: t.slug,
            name: t.name,
            description: t.description || "",
          })),
        },
        triggers: {
          count: triggers.count ?? (triggers.items?.length || 0),
          items: (triggers.items || []).map((tr: any) => ({
            slug: tr.slug,
            name: tr.name,
            description: tr.description || "",
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch Composio app details",
      };
    }
  },
};

/**
 * Run a Composio action directly without adding a workflow node.
 * Use this for one-off actions (create doc, send email, list calendar, etc.).
 * Use COMPOSIO_ACTION nodes only when building workflows.
 */
function detectComposioPermissionError(result: unknown): string | null {
  try {
    const serialized = JSON.stringify(result);
    if (
      /insufficient authentication scopes/i.test(serialized) ||
      /ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(serialized) ||
      /"status"\s*:\s*"PERMISSION_DENIED"/i.test(serialized)
    ) {
      return "Request had insufficient authentication scopes or permissions for the connected app.";
    }
  } catch {
    /* fall through */
  }
  return null;
}

const runComposioActionTool: VerxioTool = {
  name: "runComposioAction",
  description:
    "Execute a Composio action directly without adding a workflow node. Use for one-offs: create doc, send email, list calendar, create GitHub issue, etc. Before calling: use listComposioConnections to verify the app is connected. If it fails because the app is not connected, call connectComposioApp with the app slug (e.g. from GITHUB_CREATE_ISSUE use 'github') to get the connection link, then present it as a clickable markdown link. Never tell users to go to Settings > Connections.",
  inputSchema: z.object({
    composioActionName: z
      .string()
      .describe(
        "Exact Composio action slug (e.g. GITHUB_CREATE_ISSUE, NOTION_CREATE_PAGE, GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN, GOOGLECALENDAR_LIST_EVENTS). Get from getComposioAppDetails—do not guess."
      ),
    composioParams: z
      .record(z.string(), z.any())
      .describe(
        "Action-specific parameters as JSON. For GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN: title (string), markdown_text (string, REQUIRED). For GOOGLECALENDAR_LIST_EVENTS: timeMin, timeMax (ISO dates). Pass resolved values—no {{variable}} templates."
      ),
  }),
  execute: async (
    args: { composioActionName: string; composioParams: Record<string, unknown> },
    context: ToolContext
  ) => {
    try {
      const { executeComposioAction, isComposioConfigured } =
        await import("../composio/composioService");
      if (!isComposioConfigured()) {
        return {
          success: false,
          error:
            "Composio is not configured. The COMPOSIO_API_KEY environment variable is not set.",
        };
      }

      const { checkNodeAccess } = await import("@/services/subscriptionCheck");
      await checkNodeAccess(context.userId, "COMPOSIO_ACTION");

      const { consumePremiumQuota } = await import("@/services/subscriptionService");
      const { QUOTA_COST } = await import("@/config/rate-limits");
      await consumePremiumQuota(context.userId, QUOTA_COST.COMPOSIO_ACTION);

      const actionName = args.composioActionName.toUpperCase();
      let params = { ...(args.composioParams || {}) };

      // Normalize GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN params
      if (actionName === "GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN") {
        if (
          (params.markdown_text === undefined || params.markdown_text === "") &&
          (params.content !== undefined ||
            params.body !== undefined ||
            params.markdown !== undefined ||
            params.markdown_content !== undefined ||
            params.text !== undefined)
        ) {
          const body =
            params.content ??
            params.body ??
            params.markdown ??
            params.markdown_content ??
            params.text;
          if (body !== undefined && body !== "") {
            params = { ...params, markdown_text: body };
          }
        }
        const bodyValue = params.markdown_text;
        if (!bodyValue || (typeof bodyValue === "string" && bodyValue.trim() === "")) {
          return {
            success: false,
            error:
              "GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN requires markdown_text (or content/body) with non-empty content.",
          };
        }
      }

      const result = await executeComposioAction(context.userId, actionName, params);

      const permissionError = detectComposioPermissionError(result);
      if (permissionError) {
        return {
          success: false,
          error: `${permissionError} Call connectComposioApp with the app slug to get a connection link, then present it to the user as a clickable link. Do not tell them to go to Settings > Connections.`,
        };
      }

      return {
        success: true,
        actionName: actionName,
        result,
        message:
          "Composio action completed. Summarize this result in human language for the user in your reply.",
      };
    } catch (error: any) {
      if (error?.message?.includes("Rate limit") || error?.message?.includes("quota")) {
        return {
          success: false,
          error: error.message || "Rate limit exceeded. Upgrade or wait for quota reset.",
        };
      }
      return {
        success: false,
        error: `Composio action failed: ${error instanceof Error ? error.message : "Unknown error"}. If the app is not connected, call connectComposioApp with the app slug (e.g. from the action: GITHUB_CREATE_ISSUE -> github) to get the connection link, then present it to the user as a clickable markdown link. Do not tell them to go to Settings > Connections.`,
      };
    }
  },
};

// ============================================
// Agentic Operations Tools
// ============================================

const createGoalTool: VerxioTool = {
  name: "create_goal",
  description: "Create a high-level AI goal that will be automatically decomposed into sub-tasks",
  inputSchema: z.object({
    name: z.string().describe("Short name for the goal"),
    objective: z.string().describe("Detailed description of what the goal should achieve"),
    reportingChannelId: z.string().optional().describe("Support channel ID for progress reports"),
  }),
  execute: async (args: any, context: ToolContext) => {
    const { createGoal } = await import("../goalService");
    const goal = await createGoal(context.userId, {
      name: args.name,
      objective: args.objective,
      reportingChannelId: args.reportingChannelId,
    });
    return { success: true, goalId: goal.id, status: goal.status };
  },
};

const decomposeGoalTool: VerxioTool = {
  name: "decompose_goal",
  description: "Trigger decomposition of an existing goal into sub-tasks",
  inputSchema: z.object({
    goalId: z.string().describe("ID of the goal to decompose"),
  }),
  execute: async (args: any, context: ToolContext) => {
    await inngest.send({
      name: "verxio/goal.decompose",
      data: { goalId: args.goalId, userId: context.userId },
    });
    return { success: true, message: "Goal decomposition triggered" };
  },
};

const rememberFactTool: VerxioTool = {
  name: "remember_fact",
  description: "Store a fact in agent memory for future recall across sessions",
  inputSchema: z.object({
    key: z.string().describe("Unique key for the fact"),
    value: z.string().describe("The fact value to remember"),
    scope: z.enum(["GLOBAL", "GOAL", "CONTACT"]).optional().describe("Memory scope"),
    goalId: z.string().optional().describe("Goal ID if scope is GOAL"),
  }),
  execute: async (args: any, context: ToolContext) => {
    const { rememberFact } = await import("../agentMemoryService");
    const memory = await rememberFact(context.userId, {
      key: args.key,
      value: args.value,
      scope: args.scope || "GLOBAL",
      goalId: args.goalId,
    });
    return { success: true, memoryId: memory.id };
  },
};

const recallFactsTool: VerxioTool = {
  name: "recall_facts",
  description: "Retrieve stored facts from agent memory",
  inputSchema: z.object({
    scope: z.enum(["GLOBAL", "GOAL", "CONTACT"]).optional().describe("Filter by scope"),
    goalId: z.string().optional().describe("Filter by goal ID"),
  }),
  execute: async (args: any, context: ToolContext) => {
    const { recallFacts } = await import("../agentMemoryService");
    const memories = await recallFacts(context.userId, args.scope, args.goalId);
    return {
      facts: memories.map((m: any) => ({
        key: m.key,
        value: m.value,
        scope: m.scope,
        confidence: m.confidence,
      })),
    };
  },
};

const requestApprovalTool: VerxioTool = {
  name: "request_approval",
  description: "Request human approval before proceeding with a high-risk action",
  inputSchema: z.object({
    goalId: z.string().describe("Goal requiring approval"),
    taskId: z.string().optional().describe("Specific task requiring approval"),
    action_description: z.string().describe("Description of the action needing approval"),
    risk_level: z.enum(["low", "medium", "high", "critical"]).describe("Risk level assessment"),
  }),
  execute: async (args: any, context: ToolContext) => {
    await inngest.send({
      name: "verxio/goal.approval-requested",
      data: {
        goalId: args.goalId,
        taskId: args.taskId,
        actionDescription: args.action_description,
        riskLevel: args.risk_level,
        userId: context.userId,
      },
    });
    return { success: true, message: "Approval request sent. Waiting for owner response." };
  },
};

const reflectOnOutputTool: VerxioTool = {
  name: "reflect_on_output",
  description:
    "Evaluate a task output against success criteria and decide whether to accept, retry, or escalate",
  inputSchema: z.object({
    taskId: z.string().describe("Task ID to reflect on"),
    output: z.any().describe("The task output to evaluate"),
    success_criteria: z.string().describe("Criteria the output must meet"),
  }),
  execute: async (args: any, context: ToolContext) => {
    const task = await prisma.agentTask.findUnique({ where: { id: args.taskId } });
    if (!task) return { error: "Task not found" };
    await inngest.send({
      name: "verxio/goal.reflect",
      data: {
        goalId: task.goalId,
        taskId: args.taskId,
        output: args.output,
        successCriteria: args.success_criteria,
        userId: context.userId,
      },
    });
    return { success: true, message: "Reflection triggered" };
  },
};

const createWatchTool: VerxioTool = {
  name: "create_watch",
  description: "Create a proactive watch that fires a workflow when a condition is met",
  inputSchema: z.object({
    name: z.string().describe("Watch name"),
    triggerType: z.enum(["CRON", "THRESHOLD", "WEBHOOK_EVENT"]).describe("Type of trigger"),
    cronExpression: z.string().optional().describe("Cron expression for CRON type"),
    thresholdCondition: z.any().optional().describe("Threshold condition for THRESHOLD type"),
    actionWorkflowId: z.string().optional().describe("Workflow to trigger when watch fires"),
  }),
  execute: async (args: any, context: ToolContext) => {
    const { createWatch } = await import("../agentWatchService");
    const watch = await createWatch(context.userId, {
      name: args.name,
      triggerType: args.triggerType,
      cronExpression: args.cronExpression,
      thresholdCondition: args.thresholdCondition,
      actionWorkflowId: args.actionWorkflowId,
    });
    return { success: true, watchId: watch.id };
  },
};

const deliverReportToGoogleDocsTool: VerxioTool = {
  name: "deliver_report_to_google_docs",
  description:
    "Create a Google Doc with report content via Composio. Requires user to have Google Docs connected through Composio. Use for goal progress reports, compliance reports, or any structured document delivery.",
  inputSchema: z.object({
    title: z.string().describe("Document title"),
    content: z.string().describe("Markdown content for the document body"),
  }),
  execute: async (args: any, context: ToolContext) => {
    const { executeDeliveryActions } = await import("../composioReportDeliveryService");
    const results = await executeDeliveryActions(
      context.userId,
      {
        composioActions: [{ action: "GOOGLEDOCS_CREATE_DOCUMENT", label: "Google Docs" }],
      },
      args.title,
      args.content
    );
    return results[0] || { delivered: false, error: "No result" };
  },
};

const generateGoalReportTool: VerxioTool = {
  name: "generate_goal_report",
  description:
    "Generate a progress report for an AI goal and optionally deliver it to all configured channels including Google Docs",
  inputSchema: z.object({
    goalId: z.string().describe("Goal ID to generate the report for"),
    deliverToChannels: z
      .boolean()
      .optional()
      .describe("Whether to also deliver to messaging channels (default: true)"),
  }),
  execute: async (args: any, _context: ToolContext) => {
    const { generateProgressReport, deliverReport } = await import("../goalReportService");
    const report = await generateProgressReport(args.goalId);
    let delivery;
    if (args.deliverToChannels !== false) {
      delivery = await deliverReport(args.goalId);
    }
    return { report, delivery };
  },
};

const createHumanTaskTool: VerxioTool = {
  name: "create_human_task",
  description:
    "Create a managed human task with AI-powered compliance scoring. The task defines work that human workers must complete on a schedule, with evidence submission and AI vetting.",
  inputSchema: z.object({
    name: z.string().describe("Short name for the task, e.g. 'Toilet Cleaning'"),
    description: z.string().optional().describe("Detailed description of what the task entails"),
    evidenceType: z
      .enum(["PHOTO", "TEXT", "PHOTO_AND_TEXT", "DOCUMENT"])
      .optional()
      .describe(
        "Type of evidence workers must submit. DOCUMENT is for PDFs, reports, or memos. Default: PHOTO"
      ),
    recurrenceType: z
      .enum(["ONCE", "INTERVAL", "DAILY", "WEEKLY"])
      .optional()
      .describe("How often the task recurs. Default: DAILY"),
    recurrenceInterval: z
      .number()
      .optional()
      .describe("Interval in minutes for INTERVAL recurrence type"),
    scheduledTimes: z
      .array(z.string())
      .optional()
      .describe("Times of day the task is due, e.g. ['09:00', '14:00']"),
    timezone: z
      .string()
      .optional()
      .describe("Timezone for scheduling, e.g. 'America/New_York'. Default: UTC"),
    acceptanceRules: z
      .array(z.string())
      .optional()
      .describe(
        "Rules the AI uses to vet submitted evidence, e.g. ['Floor must be dry and clean', 'All surfaces wiped']"
      ),
    scoringEnabled: z.boolean().optional().describe("Whether AI scoring is enabled. Default: true"),
    passingScore: z.number().optional().describe("Minimum score (0-100) to pass. Default: 70"),
    graceMinutes: z
      .number()
      .optional()
      .describe("Grace period in minutes after scheduled time. Default: 15"),
    resubmissionAllowed: z
      .boolean()
      .optional()
      .describe("Whether workers can resubmit on failure. Default: true"),
    reportTime: z
      .string()
      .optional()
      .describe("Time of day to generate daily report, e.g. '18:00'. Default: 18:00"),
  }),
  execute: async (args: any, context: ToolContext) => {
    const { createHumanTask } = await import("../humanTaskService");
    const task = await createHumanTask(context.userId, {
      name: args.name,
      description: args.description,
      evidenceType: args.evidenceType,
      recurrenceType: args.recurrenceType,
      recurrenceInterval: args.recurrenceInterval,
      scheduledTimes: args.scheduledTimes,
      timezone: args.timezone,
      acceptanceRules: args.acceptanceRules,
      scoringEnabled: args.scoringEnabled,
      passingScore: args.passingScore,
      graceMinutes: args.graceMinutes,
      resubmissionAllowed: args.resubmissionAllowed,
      reportTime: args.reportTime,
    });
    return {
      success: true,
      taskId: task.id,
      name: task.name,
      status: task.status,
      message: `Task "${task.name}" created. Add workers to assign people to this task.`,
    };
  },
};

const addWorkerToTaskTool: VerxioTool = {
  name: "add_worker_to_task",
  description:
    "Add a human worker to an existing task so they receive reminders and can submit evidence",
  inputSchema: z.object({
    taskId: z.string().describe("ID of the human task to add the worker to"),
    name: z.string().describe("Worker's name"),
    platform: z
      .enum(["WHATSAPP", "TELEGRAM", "SLACK", "DISCORD"])
      .describe("Communication platform for reminders"),
    externalId: z
      .string()
      .describe(
        "Platform-specific ID (phone number for WhatsApp, user/chat ID for Telegram, user ID for Slack/Discord)"
      ),
    role: z.string().optional().describe("Worker's role, e.g. 'Cleaner', 'Security Guard'"),
  }),
  execute: async (args: any, context: ToolContext) => {
    const { addWorker } = await import("../humanWorkerService");
    const worker = await addWorker(context.userId, args.taskId, {
      name: args.name,
      platform: args.platform,
      externalId: args.externalId,
      role: args.role,
    });
    return {
      success: true,
      workerId: worker.id,
      message: `Worker "${worker.name}" added to the task on ${args.platform}.`,
    };
  },
};

const listHumanTasksTool: VerxioTool = {
  name: "list_human_tasks",
  description: "List all human tasks for the current user with worker and submission counts",
  inputSchema: z.object({}),
  execute: async (_args: any, context: ToolContext) => {
    const { listHumanTasks } = await import("../humanTaskService");
    const tasks = await listHumanTasks(context.userId);
    return {
      tasks: tasks.map((t: any) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        recurrenceType: t.recurrenceType,
        evidenceType: t.evidenceType,
        workerCount: t._count?.workers ?? 0,
        submissionCount: t._count?.submissions ?? 0,
      })),
    };
  },
};

const generateTaskComplianceReportTool: VerxioTool = {
  name: "generate_task_compliance_report",
  description:
    "Generate a daily compliance report for a human task, including AI scores, worker breakdown, and delivery to messaging channels and Google Docs",
  inputSchema: z.object({
    taskId: z.string().describe("Human task ID to generate compliance report for"),
  }),
  execute: async (args: any, _context: ToolContext) => {
    const { generateDailyReport } = await import("../taskReportService");
    const report = await generateDailyReport(args.taskId);
    return {
      reportId: report.id,
      totalSubmissions: report.totalSubmissions,
      missedCount: report.missedCount,
      avgScore: report.avgScore,
      passRate: report.passRate,
    };
  },
};

export const verxioTools: VerxioTool[] = [
  listNodeTypesTool,
  getNodeSchemaTool,
  createWorkflowTool,
  getWorkflowTool,
  addNodeTool,
  configureNodeTool,
  connectNodesTool,
  executeWorkflowTool,
  executeSingleNodeAndWaitTool,
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
  updateSoulMdTool,
  browseWebsiteTool,
  checkWebRunTool,
  searchKnowledgeBaseTool,
  listKnowledgeBasesTool,
  listComposioConnectionsTool,
  connectComposioAppTool,
  searchComposioAppsTool,
  getComposioAppDetailsTool,
  runComposioActionTool,
  createGoalTool,
  decomposeGoalTool,
  rememberFactTool,
  recallFactsTool,
  requestApprovalTool,
  reflectOnOutputTool,
  createWatchTool,
  deliverReportToGoogleDocsTool,
  generateGoalReportTool,
  generateTaskComplianceReportTool,
  createHumanTaskTool,
  addWorkerToTaskTool,
  listHumanTasksTool,
];

export default verxioTools;
