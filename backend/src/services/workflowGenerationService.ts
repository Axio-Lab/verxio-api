/**
 * Workflow Generation Service
 *
 * Uses Claude Agent SDK to autonomously generate workflows
 */

import {
  generateWorkflowWithAgent,
  runAgentQuery,
  type AgentStreamEvent,
} from "./agent/agentService";
import { getWorkflowPlan } from "./planningService";

export interface WorkflowGenerationOptions {
  prompt: string;
  userId: string;
  workflowId?: string;
  existingNodes?: Array<{ type: string; data: Record<string, unknown> }>;
  model?: string;
}

export interface GeneratedNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface GeneratedConnection {
  id: string;
  source: string;
  target: string;
  fromOutput?: string;
  toInput?: string;
}

export interface SetupInstruction {
  type: "credential" | "configuration" | "oauth";
  nodeId?: string;
  nodeType?: string;
  nodeLabel?: string;
  message: string;
  priority: "high" | "medium" | "low";
  action?: {
    type: "open_node" | "add_credential" | "connect_oauth";
    nodeId?: string;
    credentialType?: string;
    credentialName?: string;
  };
}

export interface WorkflowSummary {
  nodesCreated: Array<{
    id: string;
    type: string;
    name: string;
  }>;
  credentialsRequired: Array<{
    type: string;
    nodeId: string;
    nodeName: string;
    setupUrl: string;
  }>;
  fieldsToUpdate: Array<{
    nodeId: string;
    nodeName: string;
    field: string;
    instruction: string;
  }>;
  flowDescription: string;
}

export interface WorkflowGenerationResult {
  nodes: GeneratedNode[];
  connections: GeneratedConnection[];
  customCodeBlocks?: Array<{
    nodeId: string;
    code: string;
    dependencies?: string[];
  }>;
  setupInstructions?: SetupInstruction[];
  workflowId?: string;
  summary?: WorkflowSummary;
}

/**
 * Generates an autonomous workflow blueprint using Claude Agent
 */
export const generateAutonomousWorkflow = async (
  options: WorkflowGenerationOptions
): Promise<WorkflowGenerationResult> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  // Get conversation history from plan if available
  let conversationHistory: Array<{ role: string; content: string }> = [];
  if (options.workflowId) {
    try {
      const plan = await getWorkflowPlan(options.workflowId);
      if (plan && plan.conversationHistory && plan.conversationHistory.length > 0) {
        conversationHistory = plan.conversationHistory.slice(-10); // Last 10 messages for context
      }
    } catch (error) {
      console.error("Failed to load plan context:", error);
    }
  }

  // Use Claude Agent to generate the workflow
  const result = await generateWorkflowWithAgent(
    options.userId,
    options.prompt,
    options.workflowId
  );

  if (!result.success || !result.workflowId) {
    throw new Error(result.error || "Failed to generate workflow");
  }

  // Agent has already created/updated the workflow with all nodes and connections
  // Fetch the actual workflow from database to return nodes and connections
  const { prisma } = await import("@/lib/prisma");

  const workflow = await prisma.workflow.findUnique({
    where: { id: result.workflowId },
    include: {
      nodes: { orderBy: { createdAt: "asc" } },
      connections: true,
    },
  });

  if (!workflow) {
    throw new Error("Workflow was created but could not be retrieved");
  }

  // Convert database nodes to GeneratedNode format
  const nodes: GeneratedNode[] = workflow.nodes.map((node: any) => ({
    id: node.id,
    type: node.type,
    data: node.data as Record<string, unknown>,
    position: node.position as { x: number; y: number },
  }));

  // Convert database connections to GeneratedConnection format
  const connections: GeneratedConnection[] = workflow.connections.map((conn: any) => ({
    id: conn.id,
    source: conn.fromNodeId,
    target: conn.toNodeId,
    fromOutput: conn.fromOutput || "main",
    toInput: conn.toInput || "main",
  }));

  // Generate summary
  const summary = generateWorkflowSummary(nodes, connections, options.userId);

  return {
    nodes,
    connections,
    setupInstructions: [],
    workflowId: result.workflowId,
    summary,
  };
};

// Credential requirements by node type
const NODE_CREDENTIAL_MAP: Record<string, { type: string; setupUrl: string }> = {
  ANTHROPIC: { type: "ANTHROPIC", setupUrl: "/credentials/new?type=ANTHROPIC" },
  OPENAI: { type: "OPENAI", setupUrl: "/credentials/new?type=OPENAI" },
  GEMINI: { type: "GEMINI", setupUrl: "/credentials/new?type=GEMINI" },
  TELEGRAM: { type: "TELEGRAM", setupUrl: "/credentials/new?type=TELEGRAM" },
  TELEGRAM_TRIGGER: { type: "TELEGRAM", setupUrl: "/credentials/new?type=TELEGRAM" },
  AIRTABLE: { type: "AIRTABLE", setupUrl: "/credentials/new?type=AIRTABLE" },
  AIRTABLE_TRIGGER: { type: "AIRTABLE", setupUrl: "/credentials/new?type=AIRTABLE" },
  GOOGLE_SHEETS: { type: "GOOGLE_OAUTH", setupUrl: "/credentials/oauth/google" },
  GOOGLE_DOCS: { type: "GOOGLE_OAUTH", setupUrl: "/credentials/oauth/google" },
  GOOGLE_SLIDES: { type: "GOOGLE_OAUTH", setupUrl: "/credentials/oauth/google" },
  GOOGLE_DRIVE: { type: "GOOGLE_OAUTH", setupUrl: "/credentials/oauth/google" },
  GOOGLE_CALENDAR: { type: "GOOGLE_OAUTH", setupUrl: "/credentials/oauth/google" },
  GOOGLE_MEET: { type: "GOOGLE_OAUTH", setupUrl: "/credentials/oauth/google" },
  GMAIL: { type: "GOOGLE_OAUTH", setupUrl: "/credentials/oauth/google" },
  SLACK: { type: "SLACK", setupUrl: "/credentials/new?type=SLACK" },
  DISCORD: { type: "DISCORD", setupUrl: "/credentials/new?type=DISCORD" },
  WHATSAPP: { type: "WHATSAPP", setupUrl: "/credentials/new?type=WHATSAPP" },
  VALYU_SEARCH: { type: "VALYU", setupUrl: "/credentials/new?type=VALYU" },
  VALYU_CONTENTS: { type: "VALYU", setupUrl: "/credentials/new?type=VALYU" },
  VALYU_ANSWER: { type: "VALYU", setupUrl: "/credentials/new?type=VALYU" },
  VALYU_DEEP_RESEARCH: { type: "VALYU", setupUrl: "/credentials/new?type=VALYU" },
};

// Fields that require user input
const FIELDS_REQUIRING_INPUT: Record<string, Array<{ field: string; instruction: string }>> = {
  GOOGLE_SHEETS: [
    { field: "spreadsheetId", instruction: "Paste your Google Sheets ID from the URL" },
  ],
  GOOGLE_DOCS: [{ field: "documentId", instruction: "Paste your Google Doc ID from the URL" }],
  TELEGRAM: [{ field: "chatId", instruction: "Enter the Telegram chat ID to send messages to" }],
  AIRTABLE: [
    { field: "baseId", instruction: "Enter your Airtable base ID" },
    { field: "tableId", instruction: "Enter the table ID or name" },
  ],
};

/**
 * Generate a summary of the workflow for the user
 */
export function generateWorkflowSummary(
  nodes: GeneratedNode[],
  connections: GeneratedConnection[],
  userId: string
): WorkflowSummary {
  // Build nodes created list
  const nodesCreated = nodes.map((node) => ({
    id: node.id,
    type: node.type,
    name: (node.data.label as string) || (node.data.name as string) || node.type,
  }));

  // Identify required credentials
  const credentialSet = new Set<string>();
  const credentialsRequired: WorkflowSummary["credentialsRequired"] = [];

  for (const node of nodes) {
    const credInfo = NODE_CREDENTIAL_MAP[node.type];
    if (credInfo && !credentialSet.has(credInfo.type)) {
      credentialSet.add(credInfo.type);
      credentialsRequired.push({
        type: credInfo.type,
        nodeId: node.id,
        nodeName: (node.data.label as string) || (node.data.name as string) || node.type,
        setupUrl: credInfo.setupUrl,
      });
    }
  }

  // Identify fields requiring user input
  const fieldsToUpdate: WorkflowSummary["fieldsToUpdate"] = [];

  for (const node of nodes) {
    const requiredFields = FIELDS_REQUIRING_INPUT[node.type];
    if (requiredFields) {
      for (const { field, instruction } of requiredFields) {
        const currentValue = node.data[field] as string | undefined;
        // Check if field is missing or has placeholder
        if (
          !currentValue ||
          currentValue.includes("PASTE_") ||
          currentValue.includes("YOUR_") ||
          currentValue.includes("ENTER_")
        ) {
          fieldsToUpdate.push({
            nodeId: node.id,
            nodeName: (node.data.label as string) || (node.data.name as string) || node.type,
            field,
            instruction,
          });
        }
      }
    }
  }

  // Generate flow description by following connections
  const flowDescription = generateFlowDescription(nodes, connections);

  return {
    nodesCreated,
    credentialsRequired,
    fieldsToUpdate,
    flowDescription,
  };
}

// Node action descriptions for natural language flow
const NODE_ACTION_DESCRIPTIONS: Record<string, (data: Record<string, unknown>) => string> = {
  // Triggers
  TELEGRAM_TRIGGER: () => "receives incoming Telegram messages",
  WHATSAPP_TRIGGER: () => "receives incoming WhatsApp messages",
  WEBHOOK: () => "receives incoming webhook requests",
  MANUAL_TRIGGER: () => "starts when manually triggered",
  MANUAL_INPUT: () => "collects user input",
  TIMED_TRIGGER: (data) =>
    `runs on schedule${data.cronExpression ? ` (${data.cronExpression})` : ""}`,
  GOOGLE_FORM_TRIGGER: () => "receives Google Form submissions",
  STRIPE_TRIGGER: () => "receives Stripe payment events",
  AIRTABLE_TRIGGER: () => "monitors Airtable for changes",

  // AI Models
  ANTHROPIC: (data) => {
    const prompt = (data.userPrompt as string) || "";
    if (prompt.toLowerCase().includes("summar")) return "summarizes the content using Claude AI";
    if (prompt.toLowerCase().includes("analyz")) return "analyzes the content using Claude AI";
    if (prompt.toLowerCase().includes("categor")) return "categorizes the content using Claude AI";
    if (prompt.toLowerCase().includes("extract")) return "extracts information using Claude AI";
    if (prompt.toLowerCase().includes("translate")) return "translates the content using Claude AI";
    return "processes the content with Claude AI";
  },
  OPENAI: (data) => {
    const prompt = (data.userPrompt as string) || "";
    if (prompt.toLowerCase().includes("summar")) return "summarizes the content using GPT";
    if (prompt.toLowerCase().includes("analyz")) return "analyzes the content using GPT";
    if (prompt.toLowerCase().includes("categor")) return "categorizes the content using GPT";
    if (prompt.toLowerCase().includes("extract")) return "extracts information using GPT";
    if (prompt.toLowerCase().includes("translate")) return "translates the content using GPT";
    return "processes the content with GPT";
  },
  GEMINI: (data) => {
    const prompt = (data.userPrompt as string) || "";
    if (prompt.toLowerCase().includes("summar")) return "summarizes the content using Gemini";
    if (prompt.toLowerCase().includes("analyz")) return "analyzes the content using Gemini";
    if (prompt.toLowerCase().includes("categor")) return "categorizes the content using Gemini";
    if (prompt.toLowerCase().includes("extract")) return "extracts information using Gemini";
    if (prompt.toLowerCase().includes("translate")) return "translates the content using Gemini";
    return "processes the content with Gemini";
  },

  // Communication
  TELEGRAM: () => "sends a Telegram message notification",
  WHATSAPP: () => "sends a WhatsApp message",
  DISCORD: () => "posts a message to Discord",
  SLACK: () => "sends a Slack notification",
  GMAIL: (data) => `sends an email${data.to ? ` to ${data.to}` : ""}`,

  // Google Workspace
  GOOGLE_SHEETS: (data) => {
    const action = data.action as string;
    if (action === "readRange") return "reads data from Google Sheets";
    if (action === "writeRange") return "writes data to Google Sheets";
    if (action === "appendRow") return "appends a new row to Google Sheets";
    if (action === "createSpreadsheet") return "creates a new Google Spreadsheet";
    return "interacts with Google Sheets";
  },
  GOOGLE_DOCS: (data) => {
    const action = data.action as string;
    if (action === "create") return "creates a new Google Doc";
    if (action === "read") return "reads content from Google Docs";
    if (action === "append") return "appends content to Google Docs";
    return "interacts with Google Docs";
  },
  GOOGLE_SLIDES: (data) => {
    const action = data.action as string;
    if (action === "create") return "creates a new Google Slides presentation";
    if (action === "addSlide") return "adds a slide to the presentation";
    return "interacts with Google Slides";
  },
  GOOGLE_DRIVE: (data) => {
    const action = data.action as string;
    if (action === "list") return "lists files from Google Drive";
    if (action === "upload") return "uploads a file to Google Drive";
    if (action === "download") return "downloads a file from Google Drive";
    return "interacts with Google Drive";
  },
  GOOGLE_CALENDAR: (data) => {
    const action = data.action as string;
    if (action === "create") return "creates a calendar event";
    if (action === "list") return "lists calendar events";
    return "interacts with Google Calendar";
  },

  // Data & APIs
  HTTP_REQUEST: (data) => {
    const method = (data.method as string) || "GET";
    return `makes an ${method} API request`;
  },
  AIRTABLE: (data) => {
    const action = data.action as string;
    if (action === "getRecords") return "fetches records from Airtable";
    if (action === "createRecord") return "creates a new Airtable record";
    if (action === "updateRecord") return "updates an Airtable record";
    return "interacts with Airtable";
  },

  // Logic & Code
  CODE_BLOCK: (data) => {
    const label = (data.label as string) || "";
    if (label.toLowerCase().includes("format")) return "formats the data";
    if (label.toLowerCase().includes("transform")) return "transforms the data";
    if (label.toLowerCase().includes("filter")) return "filters the data";
    if (label.toLowerCase().includes("parse")) return "parses the data";
    return "processes the data with custom code";
  },
  DECIDER: () => "makes a conditional decision",
  PLAN: () => "creates an AI-powered plan",
};

/**
 * Generate a human-readable flow description
 */
function generateFlowDescription(
  nodes: GeneratedNode[],
  connections: GeneratedConnection[]
): string {
  if (nodes.length === 0) return "Empty workflow";
  if (nodes.length === 1) {
    const node = nodes[0];
    const descFn = NODE_ACTION_DESCRIPTIONS[node.type];
    if (descFn) {
      return `This workflow ${descFn(node.data)}.`;
    }
    return `This workflow runs ${(node.data.label as string) || node.type}.`;
  }

  // Build adjacency list
  const adjacency: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  for (const node of nodes) {
    adjacency[node.id] = [];
    inDegree[node.id] = 0;
  }

  for (const conn of connections) {
    if (adjacency[conn.source]) {
      adjacency[conn.source].push(conn.target);
      inDegree[conn.target] = (inDegree[conn.target] || 0) + 1;
    }
  }

  // Find starting nodes (no incoming edges)
  const startNodes = nodes.filter((n) => (inDegree[n.id] || 0) === 0);

  if (startNodes.length === 0) {
    // Fallback: basic description
    return `This workflow uses ${nodes.length} nodes to process data.`;
  }

  // Topological traversal from first start node
  const visited = new Set<string>();
  const orderedNodes: GeneratedNode[] = [];

  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      orderedNodes.push(node);
    }

    const nextNodes = adjacency[nodeId] || [];
    for (const next of nextNodes) {
      traverse(next);
    }
  }

  traverse(startNodes[0].id);

  // Build natural language description
  const descriptions: string[] = [];

  for (let i = 0; i < orderedNodes.length; i++) {
    const node = orderedNodes[i];
    const descFn = NODE_ACTION_DESCRIPTIONS[node.type];
    const nodeName = (node.data.label as string) || node.type;

    let desc = descFn ? descFn(node.data) : `runs ${nodeName}`;

    // Add appropriate connector
    if (i === 0) {
      // First node - use "The workflow starts when" for triggers
      if (
        node.type.includes("TRIGGER") ||
        node.type === "WEBHOOK" ||
        node.type === "MANUAL_INPUT"
      ) {
        descriptions.push(`The workflow starts when it ${desc}`);
      } else {
        descriptions.push(`First, it ${desc}`);
      }
    } else if (i === orderedNodes.length - 1) {
      // Last node
      descriptions.push(`finally ${desc}`);
    } else {
      // Middle nodes - vary connectors
      const connectors = ["then", "which", "and then", "next it"];
      const connector = connectors[i % connectors.length];
      descriptions.push(`${connector} ${desc}`);
    }
  }

  // Join with commas and proper punctuation
  if (descriptions.length === 1) {
    return descriptions[0] + ".";
  } else if (descriptions.length === 2) {
    return descriptions[0] + ", " + descriptions[1] + ".";
  } else {
    const lastDesc = descriptions.pop();
    return descriptions.join(", ") + ", and " + lastDesc + ".";
  }
}

/**
 * Generates a workflow with streaming updates for real-time progress
 */
export async function* generateAutonomousWorkflowStreaming(
  options: WorkflowGenerationOptions
): AsyncGenerator<AgentStreamEvent> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  // Get conversation history from plan if available
  let conversationHistory: Array<{ role: string; content: string }> = [];
  if (options.workflowId) {
    try {
      const plan = await getWorkflowPlan(options.workflowId);
      if (plan && plan.conversationHistory && plan.conversationHistory.length > 0) {
        conversationHistory = plan.conversationHistory.slice(-10);
      }
    } catch (error) {
      console.error("Failed to load plan context:", error);
    }
  }

  // Build enhanced prompt
  const enhancedPrompt = options.workflowId
    ? `Update or enhance the existing workflow (ID: ${options.workflowId}) based on this request: ${options.prompt}`
    : `Create a new workflow: ${options.prompt}`;

  // Stream events from Claude Agent
  for await (const event of runAgentQuery({
    prompt: enhancedPrompt,
    userId: options.userId,
    workflowId: options.workflowId,
    conversationHistory,
    model: options.model,
    maxTurns: 20, // Allow more turns for complex workflows
  })) {
    yield event;
  }
}
