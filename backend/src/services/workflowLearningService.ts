/**
 * Workflow Learning Service
 *
 * Stores and retrieves workflow patterns to help the agent learn from
 * successful workflows and improve suggestions over time.
 */

import { basePrismaClient } from "@/lib/prisma";

// Use base client with any type to access all models
const prismaClient = basePrismaClient as any;

export interface WorkflowPattern {
  id: string;
  userId: string;
  description: string;
  nodeTypes: string[];
  nodeCount: number;
  triggerType?: string;
  hasAiNode: boolean;
  hasCodeBlock: boolean;
  integrations: string[];
  conversationSummary?: string;
  createdAt: Date;
  usageCount: number;
}

export interface LearningContext {
  similarWorkflows: Array<{
    description: string;
    nodes: string[];
    triggerType?: string;
  }>;
  frequentIntegrations: string[];
  preferredAiModel?: string;
}

// Extract integrations from node types
const NODE_TO_INTEGRATION: Record<string, string> = {
  TELEGRAM: "Telegram",
  TELEGRAM_TRIGGER: "Telegram",
  WHATSAPP: "WhatsApp",
  WHATSAPP_TRIGGER: "WhatsApp",
  GOOGLE_SHEETS: "Google Sheets",
  GOOGLE_DOCS: "Google Docs",
  GOOGLE_SLIDES: "Google Slides",
  GOOGLE_DRIVE: "Google Drive",
  GOOGLE_CALENDAR: "Google Calendar",
  GMAIL: "Gmail",
  SLACK: "Slack",
  DISCORD: "Discord",
  AIRTABLE: "Airtable",
  AIRTABLE_TRIGGER: "Airtable",
  STRIPE_TRIGGER: "Stripe",
  ANTHROPIC: "Claude AI",
  OPENAI: "OpenAI",
  GEMINI: "Gemini",
  FIRECRAWL: "Web Scraping",
  HTTP_REQUEST: "API Integration",
};

/**
 * Record a successful workflow pattern after generation
 */
export async function recordWorkflowPattern(options: {
  userId: string;
  workflowId: string;
  description: string;
  conversationSummary?: string;
}): Promise<WorkflowPattern | null> {
  try {
    // Get the workflow with its nodes
    const workflow = await prismaClient.workflow.findUnique({
      where: { id: options.workflowId },
      include: { nodes: true },
    });

    if (!workflow || workflow.nodes.length === 0) {
      return null;
    }

    const nodeTypes = workflow.nodes.map((n: any) => n.type);
    const uniqueTypes = [...new Set(nodeTypes)] as string[];

    // Find trigger type
    const triggerType = nodeTypes.find(
      (t: string) => t.includes("TRIGGER") || t === "WEBHOOK" || t === "MANUAL_INPUT"
    );

    // Check for AI and code nodes
    const hasAiNode = nodeTypes.some((t: string) => ["ANTHROPIC", "OPENAI", "GEMINI"].includes(t));
    const hasCodeBlock = nodeTypes.includes("CODE_BLOCK");

    // Extract integrations
    const integrations = uniqueTypes.map((t) => NODE_TO_INTEGRATION[t]).filter(Boolean);

    // Store the pattern using the WorkflowPattern model
    const storedPattern = await prismaClient.workflowPattern.upsert({
      where: { id: options.workflowId },
      update: {
        useCount: { increment: 1 },
        updatedAt: new Date(),
      },
      create: {
        id: options.workflowId,
        name: workflow.name || options.description,
        description: options.description,
        category: triggerType || "General",
        pattern: {
          nodeTypes: uniqueTypes,
          nodeCount: workflow.nodes.length,
          triggerType,
          hasAiNode,
          hasCodeBlock,
          integrations: [...new Set(integrations)],
          conversationSummary: options.conversationSummary,
        },
        tags: integrations,
        useCount: 1,
        successRate: 1.0,
        isTemplate: false,
      },
    });

    // Return in our interface format
    const pattern: WorkflowPattern = {
      id: storedPattern.id,
      userId: options.userId,
      description: storedPattern.description,
      nodeTypes: uniqueTypes,
      nodeCount: workflow.nodes.length,
      triggerType,
      hasAiNode,
      hasCodeBlock,
      integrations: [...new Set(integrations)],
      conversationSummary: options.conversationSummary,
      createdAt: storedPattern.createdAt,
      usageCount: storedPattern.useCount,
    };

    return pattern;
  } catch (error) {
    console.error("[Learning] Failed to record workflow pattern:", error);
    return null;
  }
}

/**
 * Get learning context for a user based on their workflow history
 */
export async function getLearningContext(
  userId: string,
  currentDescription?: string
): Promise<LearningContext> {
  try {
    // Get user's recent successful workflows
    const recentWorkflows = await prismaClient.workflow.findMany({
      where: {
        userId,
        nodes: { some: {} }, // Has at least one node
      },
      include: { nodes: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    // Extract patterns
    const patterns: Array<{
      description: string;
      nodes: string[];
      triggerType?: string;
    }> = [];

    const integrationCounts: Record<string, number> = {};
    const aiModelCounts: Record<string, number> = {};

    for (const workflow of recentWorkflows) {
      const nodeTypes: string[] = workflow.nodes.map((n: any) => n.type as string);
      const uniqueTypes: string[] = [...new Set(nodeTypes)];

      // Track this pattern
      patterns.push({
        description: workflow.name || "Unnamed workflow",
        nodes: uniqueTypes,
        triggerType: nodeTypes.find((t: string) => t.includes("TRIGGER") || t === "WEBHOOK"),
      });

      // Count integrations
      for (const type of uniqueTypes) {
        const integration = NODE_TO_INTEGRATION[type];
        if (integration) {
          integrationCounts[integration] = (integrationCounts[integration] || 0) + 1;
        }

        // Track AI model preferences
        if (["ANTHROPIC", "OPENAI", "GEMINI"].includes(type)) {
          aiModelCounts[type] = (aiModelCounts[type] || 0) + 1;
        }
      }
    }

    // Find similar workflows if description provided
    let similarWorkflows = patterns;
    if (currentDescription) {
      const descWords = currentDescription.toLowerCase().split(/\s+/);
      similarWorkflows = patterns
        .filter((p) => {
          const patternWords = p.description.toLowerCase().split(/\s+/);
          const commonWords = descWords.filter((w) =>
            patternWords.some((pw) => pw.includes(w) || w.includes(pw))
          );
          return commonWords.length > 0;
        })
        .slice(0, 5);
    }

    // Get top integrations
    const frequentIntegrations = Object.entries(integrationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name]) => name);

    // Get preferred AI model
    const preferredAiModel = Object.entries(aiModelCounts).sort(([, a], [, b]) => b - a)[0]?.[0];

    return {
      similarWorkflows: similarWorkflows.slice(0, 5),
      frequentIntegrations,
      preferredAiModel,
    };
  } catch (error) {
    console.error("[Learning] Failed to get learning context:", error);
    return {
      similarWorkflows: [],
      frequentIntegrations: [],
    };
  }
}

/**
 * Get workflow insights for a user
 */
export async function getWorkflowInsights(userId: string): Promise<{
  totalWorkflows: number;
  mostUsedTrigger: string | null;
  mostUsedIntegrations: string[];
  preferredAiModel: string | null;
  averageNodeCount: number;
}> {
  try {
    const workflows = await prismaClient.workflow.findMany({
      where: { userId },
      include: { nodes: true },
    });

    if (workflows.length === 0) {
      return {
        totalWorkflows: 0,
        mostUsedTrigger: null,
        mostUsedIntegrations: [],
        preferredAiModel: null,
        averageNodeCount: 0,
      };
    }

    const triggerCounts: Record<string, number> = {};
    const integrationCounts: Record<string, number> = {};
    const aiModelCounts: Record<string, number> = {};
    let totalNodes = 0;

    for (const workflow of workflows) {
      totalNodes += workflow.nodes.length;

      for (const node of workflow.nodes) {
        const type = (node as any).type;

        // Count triggers
        if (type.includes("TRIGGER") || type === "WEBHOOK") {
          triggerCounts[type] = (triggerCounts[type] || 0) + 1;
        }

        // Count integrations
        const integration = NODE_TO_INTEGRATION[type];
        if (integration) {
          integrationCounts[integration] = (integrationCounts[integration] || 0) + 1;
        }

        // Count AI models
        if (["ANTHROPIC", "OPENAI", "GEMINI"].includes(type)) {
          aiModelCounts[type] = (aiModelCounts[type] || 0) + 1;
        }
      }
    }

    return {
      totalWorkflows: workflows.length,
      mostUsedTrigger: Object.entries(triggerCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || null,
      mostUsedIntegrations: Object.entries(integrationCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name]) => name),
      preferredAiModel: Object.entries(aiModelCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || null,
      averageNodeCount: Math.round(totalNodes / workflows.length),
    };
  } catch (error) {
    console.error("[Learning] Failed to get workflow insights:", error);
    return {
      totalWorkflows: 0,
      mostUsedTrigger: null,
      mostUsedIntegrations: [],
      preferredAiModel: null,
      averageNodeCount: 0,
    };
  }
}
