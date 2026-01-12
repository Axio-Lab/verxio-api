import { NodeType } from "@/lib/node-types";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export interface NodeConfigurationContext {
  workflowPurpose: string;
  previousNodes: Array<{
    id: string;
    type: string;
    variables?: string;
    data?: Record<string, unknown>;
  }>;
  currentNodeIndex: number;
  executionChain?: Array<{
    id: string;
    type: string;
    variables?: string;
  }>;
}

/**
 * Configure AI model node with appropriate model, system prompt, and user prompt
 */
export async function configureAIModelNode(
  node: { type: string; data: Record<string, unknown> },
  context: NodeConfigurationContext
): Promise<Record<string, unknown>> {
  const nodeType = node.type;
  const nodeData = { ...node.data };

  // Only configure AI model nodes
  if (
    nodeType !== NodeType.OPENAI &&
    nodeType !== NodeType.ANTHROPIC &&
    nodeType !== NodeType.GEMINI
  ) {
    return nodeData;
  }

  // Analyze workflow purpose to determine model and prompts
  const purpose = context.workflowPurpose.toLowerCase();
  const previousOutputs = getPreviousNodeOutputs(context.previousNodes);

  // Determine appropriate model based on task complexity
  let selectedModel: string;
  let needsSystemPrompt = false;

  // Complex tasks that need powerful models
  if (
    purpose.includes("analyze") ||
    purpose.includes("reason") ||
    purpose.includes("strategy") ||
    purpose.includes("plan") ||
    purpose.includes("code") ||
    purpose.includes("generate code") ||
    purpose.includes("complex") ||
    purpose.includes("detailed")
  ) {
    if (nodeType === NodeType.OPENAI) {
      selectedModel = "gpt-4o";
    } else if (nodeType === NodeType.ANTHROPIC) {
      selectedModel = "claude-3-5-sonnet-20241022";
    } else {
      selectedModel = "gemini-1.5-pro";
    }
    needsSystemPrompt = true;
  }
  // Long context tasks
  else if (
    purpose.includes("document") ||
    purpose.includes("long") ||
    purpose.includes("context") ||
    purpose.includes("read") ||
    purpose.includes("summarize")
  ) {
    if (nodeType === NodeType.OPENAI) {
      selectedModel = "gpt-4o";
    } else if (nodeType === NodeType.ANTHROPIC) {
      selectedModel = "claude-3-5-sonnet-20241022";
    } else {
      selectedModel = "gemini-1.5-pro";
    }
    needsSystemPrompt = true;
  }
  // Simple/fast tasks
  else {
    if (nodeType === NodeType.OPENAI) {
      selectedModel = "gpt-4o-mini";
    } else if (nodeType === NodeType.ANTHROPIC) {
      selectedModel = "claude-3-5-haiku-20241022";
    } else {
      selectedModel = "gemini-1.5-flash";
    }
    needsSystemPrompt = false;
  }

  // Set model if not already set
  if (!nodeData.model) {
    nodeData.model = selectedModel;
  }

  // Generate system prompt for complex tasks using Claude for autonomous generation
  if (needsSystemPrompt && !nodeData.systemPrompt) {
    // Use execution chain to get previous nodes for context
    const previousNodesForContext =
      context.executionChain ||
      context.previousNodes.map((n) => ({
        id: n.id,
        type: n.type,
        variables: n.variables,
      }));

    nodeData.systemPrompt = await generateSystemPromptWithClaude(
      context.workflowPurpose,
      nodeType,
      previousNodesForContext
    );
  }

  // Generate user prompt with templating
  if (!nodeData.userPrompt) {
    nodeData.userPrompt = generateUserPrompt(
      context.workflowPurpose,
      previousOutputs,
      nodeType,
      context.executionChain
    );
  }

  // Set variable name if not set
  if (!nodeData.variables) {
    const purposeWords = context.workflowPurpose
      .toLowerCase()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.replace(/[^a-z0-9]/g, ""));
    const varName = purposeWords.length > 0 ? purposeWords.join("") : "aiResponse";
    nodeData.variables = varName;
  }

  return nodeData;
}

/**
 * Generate system prompt using Claude to analyze workflow purpose
 * This provides autonomous, context-aware system prompt generation
 */
async function generateSystemPromptWithClaude(
  workflowPurpose: string,
  nodeType: string,
  previousNodes: Array<{ id: string; type: string; variables?: string }>
): Promise<string> {
  // If no API key, fall back to rule-based generation
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateSystemPromptFallback(workflowPurpose, nodeType);
  }

  try {
    // Build context about previous nodes in the workflow
    const previousNodesContext =
      previousNodes.length > 0
        ? `\n\nPrevious nodes in the workflow:\n${previousNodes
            .map(
              (n, i) =>
                `  ${i + 1}. ${n.type}${n.variables ? ` (outputs to variable: ${n.variables})` : ""}`
            )
            .join("\n")}`
        : "";

    const prompt = `You are an expert workflow architect and AI prompt engineer. Analyze the following workflow task and generate a highly optimized, context-aware system prompt for an AI model node (${nodeType}).

Workflow Task: "${workflowPurpose}"${previousNodesContext}

CRITICAL REQUIREMENTS - Inspect and optimize for best results:
1. **Role Definition**: Define the AI's role and expertise precisely based on the workflow task. Consider the specific domain (design, marketing, analysis, writing, coding, etc.)
2. **Context Awareness**: If there are previous nodes, understand what data/context will be available and ensure the system prompt aligns with that context
3. **Result-Driven Focus**: Emphasize result-driven approaches, metrics, and outcomes when applicable (especially for business, marketing, or design tasks)
4. **Quality Standards**: Set clear quality expectations and professional standards
5. **Task Alignment**: Ensure the prompt directly supports the workflow's end goal
6. **Conciseness**: Keep it concise (1-2 sentences, maximum 3 sentences) but impactful
7. **Actionability**: Make it actionable and focused on delivering high-quality, production-ready outputs

INSPECTION CHECKLIST:
- Does the prompt clearly define expertise relevant to the task?
- Will this prompt help the AI deliver the best possible result for this specific workflow?
- Is the prompt aligned with the workflow's business/technical goals?
- Does it account for any previous node outputs or context?

Generate ONLY the optimized system prompt text, without any explanations or markdown formatting.`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022", // Use fast model for system prompt generation
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const systemPrompt = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Validate and return, fallback if empty
    if (systemPrompt && systemPrompt.length > 10) {
      return systemPrompt;
    }

    // Fallback to rule-based if Claude response is invalid
    return generateSystemPromptFallback(workflowPurpose, nodeType);
  } catch (error) {
    console.error("Error generating system prompt with Claude:", error);
    // Fallback to rule-based generation on error
    return generateSystemPromptFallback(workflowPurpose, nodeType);
  }
}

/**
 * Fallback rule-based system prompt generation
 * Used when Claude API is unavailable or fails
 */
function generateSystemPromptFallback(workflowPurpose: string, nodeType: string): string {
  const purpose = workflowPurpose.toLowerCase();

  // Design, branding, social media, marketing contexts
  if (
    purpose.includes("design") ||
    purpose.includes("brand") ||
    purpose.includes("social media") ||
    purpose.includes("marketing") ||
    purpose.includes("digital marketing") ||
    purpose.includes("content") ||
    purpose.includes("visual") ||
    purpose.includes("image") ||
    purpose.includes("graphic") ||
    purpose.includes("creative")
  ) {
    if (purpose.includes("social media") || purpose.includes("marketing")) {
      return "You are a brand designer with extensive experience in social media and digital marketing, with a focus on result-driven metrics. You create compelling, engaging content that drives engagement and conversions.";
    }
    return "You are an expert brand designer with experience in social media and digital marketing. You create visually appealing, result-driven content.";
  }

  if (purpose.includes("email") || purpose.includes("send")) {
    return "You are an expert email writer. Write clear, professional, and concise emails.";
  }

  if (purpose.includes("analyze") || purpose.includes("analysis")) {
    return "You are a data analyst. Provide thorough, data-driven analysis with clear insights.";
  }

  if (purpose.includes("code") || purpose.includes("generate code")) {
    return "You are an expert software engineer. Write clean, well-documented, production-ready code.";
  }

  if (purpose.includes("summarize") || purpose.includes("summary")) {
    return "You are a content summarizer. Create concise, accurate summaries that capture key points.";
  }

  if (purpose.includes("translate")) {
    return "You are a professional translator. Provide accurate, natural translations.";
  }

  // Default system prompt
  return "You are a helpful AI assistant. Provide accurate, useful, and well-structured responses.";
}

/**
 * Generate user prompt with Handlebars templating
 * Uses execution chain to properly reference previous nodes
 *
 * CONTEXT ACCUMULATION PATTERN:
 * - Each node's output is merged into context and available to ALL subsequent nodes
 * - Example: Manual Trigger → HTTP (testflow) → HTTP (testflow2)
 *   * After Node 2: { testflow: { httpResponse: { data: {...}, status: 200 } } }
 *   * After Node 3: { testflow: {...}, testflow2: { httpResponse: { data: [...], status: 200 } } }
 * - HTTP nodes: { variableName: { httpResponse: { data, status, statusText } } }
 * - AI nodes: { variableName: { text, ... } }
 * - Previous outputs are ALWAYS preserved, not overwritten
 */
function generateUserPrompt(
  workflowPurpose: string,
  previousOutputs: Array<{ nodeId: string; variables: string; type: string }>,
  nodeType: string,
  executionChain?: Array<{ id: string; type: string; variables?: string }>
): string {
  // If we have an execution chain, use it to find the most relevant previous node
  let relevantPreviousNode: { nodeId: string; variables: string; type: string } | undefined;

  if (executionChain && executionChain.length > 0) {
    // Find the current node in the execution chain
    const currentNodeInChain =
      executionChain.find((n) => previousOutputs.some((p) => p.nodeId === n.id)) ||
      executionChain[executionChain.length - 1];

    // Get the node before current in execution chain
    const currentIndex = executionChain.findIndex((n) => n.id === currentNodeInChain.id);
    if (currentIndex > 0) {
      const prevNodeInChain = executionChain[currentIndex - 1];
      relevantPreviousNode = previousOutputs.find((p) => p.nodeId === prevNodeInChain.id);
    }
  }

  // Fallback to last output if execution chain didn't help
  if (!relevantPreviousNode && previousOutputs.length > 0) {
    relevantPreviousNode = previousOutputs[previousOutputs.length - 1];
  }

  // If there are previous nodes, reference their outputs
  // IMPORTANT: Context accumulates, so we can reference ANY previous node's output
  if (relevantPreviousNode) {
    // For HTTP nodes, access the data property: {{variableName.httpResponse.data}}
    // For AI nodes, access directly: {{variableName}} or {{variableName.text}}
    let templateVar = `{{${relevantPreviousNode.variables}}}`;

    // If it's an HTTP node, suggest accessing the data property
    if (relevantPreviousNode.type === "HTTP_REQUEST") {
      templateVar = `{{${relevantPreviousNode.variables}.httpResponse.data}}`;
    }

    // Build prompt based on workflow purpose
    if (workflowPurpose.toLowerCase().includes("analyze")) {
      return `Analyze the following data: ${templateVar}. Provide insights and recommendations.`;
    }

    if (workflowPurpose.toLowerCase().includes("summarize")) {
      return `Summarize the following content: ${templateVar}`;
    }

    if (
      workflowPurpose.toLowerCase().includes("format") ||
      workflowPurpose.toLowerCase().includes("formatting")
    ) {
      return `Format the following data: ${templateVar}. Make it clear and well-structured.`;
    }

    if (
      workflowPurpose.toLowerCase().includes("email") ||
      workflowPurpose.toLowerCase().includes("send")
    ) {
      return `Based on this information: ${templateVar}, write a professional email.`;
    }

    // Generic prompt with template
    return `${workflowPurpose}\n\nUse this data: ${templateVar}`;
  }

  // No previous nodes, use workflow purpose directly
  return workflowPurpose;
}

/**
 * Get previous node outputs for templating
 */
function getPreviousNodeOutputs(
  previousNodes: Array<{
    id: string;
    type: string;
    variables?: string;
    data?: Record<string, unknown>;
  }>
): Array<{ nodeId: string; variables: string; type: string }> {
  return previousNodes
    .map((node) => {
      const variables = (node.variables ||
        node.data?.variables ||
        node.type.toLowerCase()) as string;
      return {
        nodeId: node.id,
        variables,
        type: node.type,
      };
    })
    .filter((output) => output.variables);
}

/**
 * Enhance node variable names based on context
 */
export function enhanceVariableNames(
  nodes: Array<{ id?: string; type: string; data: Record<string, unknown> }>,
  workflowPurpose: string
): Array<{ id?: string; type: string; data: Record<string, unknown> }> {
  return nodes.map((node) => {
    const nodeData = { ...node.data };

    // If variable name is generic, make it more descriptive
    if (!nodeData.variables || nodeData.variables === "result" || nodeData.variables === "output") {
      const nodeType = node.type;
      const label = (nodeData.label as string) || nodeType;

      // Generate descriptive variable name
      const words = label
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .slice(0, 2);
      const varName = words.length > 0 ? words.join("") : nodeType.toLowerCase();
      nodeData.variables = varName;
    }

    return {
      ...node,
      data: nodeData,
    };
  });
}

/**
 * Add Handlebars templating to node inputs based on previous node outputs
 * Uses execution chain to properly reference the correct previous node
 */
export function addTemplatingToNodes(
  nodes: Array<{ id?: string; type: string; data: Record<string, unknown> }>,
  connections: Array<{ source: string; target: string }>
): Array<{ id?: string; type: string; data: Record<string, unknown> }> {
  // Build execution chain to understand node order
  const buildExecutionChain = (): Array<{ id: string; variables: string }> => {
    const incomingMap = new Map<string, string>();
    connections.forEach((conn) => {
      incomingMap.set(conn.target, conn.source);
    });

    const triggerNodes = nodes.filter((n) => {
      const nodeId = n.id || "";
      return !incomingMap.has(nodeId);
    });

    if (triggerNodes.length === 0) return [];

    const chain: Array<{ id: string; variables: string }> = [];
    const visited = new Set<string>();

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = nodes.find((n) => (n.id || "") === nodeId);
      if (node) {
        const variables = (node.data.variables || node.type.toLowerCase()) as string;
        chain.push({ id: nodeId, variables });
      }

      connections.filter((conn) => conn.source === nodeId).forEach((conn) => traverse(conn.target));
    };

    const firstTriggerId = triggerNodes[0].id || "";
    traverse(firstTriggerId);

    return chain;
  };

  const executionChain = buildExecutionChain();
  const nodeOutputMap = new Map<string, string>();
  executionChain.forEach((node) => {
    nodeOutputMap.set(node.id, node.variables);
  });

  // Build connection graph for direct connections
  const incomingConnections = new Map<string, string[]>();
  connections.forEach((conn) => {
    if (!incomingConnections.has(conn.target)) {
      incomingConnections.set(conn.target, []);
    }
    incomingConnections.get(conn.target)!.push(conn.source);
  });

  // Add templating to nodes based on their inputs
  return nodes.map((node, index) => {
    const nodeId = node.id || `node-${index}`;
    const nodeData = { ...node.data };
    const incoming = incomingConnections.get(nodeId) || [];

    if (incoming.length > 0) {
      // Find the source node in execution chain to get proper variable name
      const sourceNodeId = incoming[0];
      const sourceVariables =
        nodeOutputMap.get(sourceNodeId) ||
        (nodes.find((n) => (n.id || "") === sourceNodeId)?.data.variables as string) ||
        sourceNodeId.toLowerCase();

      if (sourceVariables) {
        // Add templating based on node type
        if (node.type === NodeType.GMAIL) {
          const action = nodeData.action as string | undefined;
          if (action === "sendEmail" || action === "sendEmailWithAttachment") {
            if (!nodeData.subject || (nodeData.subject as string).trim() === "") {
              nodeData.subject = `{{${sourceVariables}.text}}`;
            }
            if (!nodeData.body || (nodeData.body as string).trim() === "") {
              nodeData.body = `{{${sourceVariables}.text}}`;
            }
          }
        }

        if (node.type === NodeType.HTTP_REQUEST) {
          if (!nodeData.body || (nodeData.body as string).trim() === "") {
            nodeData.body = `{{${sourceVariables}}}`;
          }
        }

        if (
          node.type === NodeType.OPENAI ||
          node.type === NodeType.ANTHROPIC ||
          node.type === NodeType.GEMINI
        ) {
          // User prompt already handled in configureAIModelNode, but ensure it uses correct variable
          // Also fix array access syntax to use {{get}} helper
          if (nodeData.userPrompt && typeof nodeData.userPrompt === "string") {
            let updatedPrompt = nodeData.userPrompt;

            // Fix array access syntax: convert {{var.array[0].prop}} to {{get var.array 0 prop}}
            updatedPrompt = updatedPrompt.replace(
              /\{\{([^}]+)\[(\d+)\]([^}]*)\}\}/g,
              (match, basePath, index, remainingPath) => {
                const pathParts = remainingPath.split(".").filter((p: string) => p);
                if (pathParts.length > 0) {
                  return `{{get ${basePath.trim()} ${index} ${pathParts.join(" ")}}}`;
                }
                return `{{get ${basePath.trim()} ${index}}}`;
              }
            );

            // Replace generic variable references with specific ones from execution chain
            updatedPrompt = updatedPrompt.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
              // If it's a generic reference, replace with specific variable from chain
              if (varName === "data" || varName === "result" || varName === "output") {
                return `{{${sourceVariables}}}`;
              }
              return match;
            });

            nodeData.userPrompt = updatedPrompt;
          }
        }
      }
    }

    return {
      ...node,
      data: nodeData,
    };
  });
}
