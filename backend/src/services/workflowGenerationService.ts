import Anthropic from "@anthropic-ai/sdk";
import { generateCustomCode } from "./codeGenerationService";
import { validateWorkflowBlueprint } from "./workflowValidationService";
import { calculateWorkflowPositions } from "./nodePositionCalculator";
import { ensureExecutionChain } from "./workflowConnectionService";
import { generateSetupInstructions } from "./setupInstructionsService";
import { getAllOutputSchemas } from "./nodeOutputSchemaService";
import {
  configureAIModelNode,
  enhanceVariableNames,
  addTemplatingToNodes,
  type NodeConfigurationContext,
} from "./nodeConfigurationService";
import { NodeType } from "@/lib/node-types";
import { getWorkflowPlan } from "./planningService";
import { getWorkflowSchema } from "./workflowSchemaService";
import { createId } from "@paralleldrive/cuid2";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

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

export interface WorkflowGenerationResult {
  nodes: GeneratedNode[];
  connections: GeneratedConnection[];
  customCodeBlocks?: Array<{
    nodeId: string;
    code: string;
    dependencies?: string[];
  }>;
  setupInstructions?: SetupInstruction[];
}

// Available node types and their descriptions
const AVAILABLE_NODE_TYPES = {
  [NodeType.MANUAL_INPUT]: "Manual Input: Collect user input during workflow execution",
  [NodeType.GOOGLE_DRIVE]: "Google Drive: Upload, download, list, search files and folders",
  [NodeType.GOOGLE_CALENDAR]: "Google Calendar: Create, update, delete events, list calendars",
  [NodeType.GOOGLE_SHEETS]: "Google Sheets: Read, write, update cells, create sheets",
  [NodeType.GOOGLE_DOCS]: "Google Docs: Create, update, read documents",
  [NodeType.GOOGLE_MEET]: "Google Meet: Create meeting links, send invites",
  [NodeType.GOOGLE_SLIDES]: "Google Slides: Create, update presentations",
  [NodeType.GMAIL]: "Gmail: Send emails, search, read messages",
  [NodeType.AIRTABLE]: "Airtable: Create, read, update, delete records",
  [NodeType.OPENAI]: "OpenAI: Generate text using GPT models",
  [NodeType.ANTHROPIC]: "Anthropic: Generate text using Claude models",
  [NodeType.GEMINI]: "Google Gemini: Generate text using Gemini models",
  [NodeType.SLACK]: "Slack: Send messages, create channels, interact with Slack",
  [NodeType.DISCORD]: "Discord: Send messages, interact with Discord servers",
  [NodeType.TELEGRAM]: "Telegram: Send messages, interact with Telegram",
  [NodeType.WHATSAPP]: "WhatsApp: Send messages via WhatsApp",
  [NodeType.FIRECRAWL]: "Firecrawl: Scrape, crawl, map websites, search web",
  [NodeType.APIFY]: "Apify: Run actors, get datasets, manage runs",
  [NodeType.ELEVENLABS]: "ElevenLabs: Generate speech from text",
  [NodeType.HTTP_REQUEST]: "HTTP Request: Make custom HTTP requests",
  [NodeType.DECIDER]: "Decider: Conditional logic and branching",
};

/**
 * Generates an autonomous workflow blueprint using Claude
 */
export const generateAutonomousWorkflow = async (
  options: WorkflowGenerationOptions
): Promise<WorkflowGenerationResult> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  // Get WorkflowPlan context if workflowId is provided
  let planContext = "";
  let workflowSchemaContext = "";
  if (options.workflowId) {
    try {
      const plan = await getWorkflowPlan(options.workflowId);
      if (plan && plan.conversationHistory && plan.conversationHistory.length > 0) {
        const conversationSummary = plan.conversationHistory
          .slice(-10) // Last 10 messages for context
          .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
          .join("\n\n");
        planContext = `\n\nPLANNING CONTEXT (from previous conversations):
${conversationSummary}

Use this planning context to better understand the user's requirements and generate a workflow that aligns with their planning discussions.`;
      }

      // Include workflow schema for better node selection
      const schema = getWorkflowSchema();
      workflowSchemaContext = `\n\nWORKFLOW SCHEMA (comprehensive node documentation):
${JSON.stringify(schema, null, 2)}

Use this schema to understand available nodes, their capabilities, workflow patterns, and best practices for non-technical task automation.`;
    } catch (error) {
      console.error("Failed to load plan context:", error);
      // Continue without plan context
    }
  }

  const systemPrompt = `You are an expert software architect, full-stack engineer with 10+ years of experience, and business developer. Think like a business owner who understands both technical implementation and business value. Your task is to generate accurate, production-ready workflow blueprints for the Verxio platform.

CRITICAL: At every step, inspect and ensure the best result is achieved:
1. **Node Selection**: Choose the most appropriate node types for each task
2. **Configuration**: Configure every node with optimal settings, prompts, and parameters
3. **Data Flow**: Ensure proper data flow between nodes using correct variable names and templating
4. **Connections**: Create all necessary connections to ensure proper execution order
5. **Quality**: Every node should be production-ready and properly configured
6. **Context Awareness**: Use context from previous nodes appropriately
7. **Best Practices**: Follow best practices for each node type and integration

YOUR ROLE:
- **Architect**: Design workflows that are scalable, maintainable, and follow best practices
- **Full-Stack Engineer**: Understand data flow, API integrations, and proper node configuration
- **Business Developer**: Ensure workflows solve real business problems and deliver value

AVAILABLE NODE TYPES:
${Object.entries(AVAILABLE_NODE_TYPES)
  .map(([type, desc]) => `- ${type}: ${desc}`)
  .join("\n")}${workflowSchemaContext}${planContext}

DECISION GUIDELINES:
1. Use existing node types when functionality matches the requirement
2. Create CODE_BLOCK nodes for:
   - Integrations not in the available list (e.g., Jira, Notion, custom APIs)
   - Complex business logic or data transformations
   - Custom operations requiring specific code
   - New services or APIs not yet integrated

WORKFLOW FORMAT:
Return a JSON object with this exact structure:
{
  "nodes": [
    {
      "id": "node-1",
      "type": "NODE_TYPE_OR_CODE_BLOCK",
      "data": {
        "label": "Node Display Name",
        "variables": "variableName",
        // For existing nodes: include action-specific fields
        // For CODE_BLOCK: include "code", "language": "typescript", "dependencies" (optional)
      }
    }
  ],
  "connections": [
    {
      "id": "conn-1",
      "source": "node-1",
      "target": "node-2",
      "fromOutput": "main",
      "toInput": "main"
    }
  ]
}

EXECUTION FLOW REQUIREMENTS (CRITICAL):
1. Every workflow MUST have at least one trigger node to start execution:
   - Trigger node types: MANUAL_TRIGGER, MANUAL_INPUT, TIMED_TRIGGER, WEBHOOK, INITIAL, GOOGLE_FORM_TRIGGER, STRIPE_TRIGGER, WHATSAPP_TRIGGER, TELEGRAM_TRIGGER, AIRTABLE_TRIGGER
   - If the user's prompt doesn't specify a trigger, use MANUAL_TRIGGER as the default starting node
   - Use MANUAL_INPUT when the workflow needs to collect user input during execution
2. Trigger nodes MUST connect to the first action node in the workflow
3. Action nodes MUST be connected sequentially in execution order:
   - Each action node should connect to the next action node
   - Format: trigger → action1 → action2 → action3 → ... → final action
   - All action nodes must be part of the execution chain (no isolated nodes)
4. DECIDER nodes (conditional logic):
   - Can have multiple output connections (for true/false or multiple branches)
   - Ensure all branches reconnect to action nodes or end properly
5. All nodes MUST be reachable from the trigger node(s)
   - No orphaned or disconnected nodes
   - Every action node should have at least one incoming connection (except the first action after trigger)

NODE CONFIGURATION REQUIREMENTS (CRITICAL):
1. **AI Model Nodes (OPENAI, ANTHROPIC, GEMINI)**:
   - Always include "model" field with appropriate model selection:
     * GPT-4/GPT-4o for complex reasoning, analysis, code generation, strategic planning
     * GPT-3.5-turbo/GPT-4o-mini for simple text generation, summarization, quick responses
     * Claude Sonnet for long context, document analysis, detailed writing
     * Claude Haiku for fast, simple tasks, quick responses
   - Always include "systemPrompt" for complex tasks requiring specific behavior or constraints
   - Always include "userPrompt" that:
     * Uses Handlebars templating ({{variableName}}) to reference previous node outputs
     * Is context-aware based on workflow purpose
     * Provides clear instructions for the AI
   - Set "variables" to a descriptive name (e.g., "aiResponse", "analysis", "summary")

2. **Variable Naming**:
   - Use descriptive, business-meaningful names (e.g., "emailContent", "analysisResult", "formattedData")
   - Avoid generic names like "result", "data", "output" unless contextually appropriate
   - Match variable names to the node's purpose and output

3. **Handlebars Templating** (CRITICAL - Follow these rules exactly):
   - **Simple property access**: {{variableName}} or {{variableName.property}}
   - **Array access**: Use {{get variableName.arrayProperty index propertyName}} helper
     * Example: {{get parsedContent result contentPieces 0 imageDescription}}
     * DO NOT use: {{parsedContent.result.contentPieces[0].imageDescription}} (this causes parsing errors)
   - **Nested objects**: {{variableName.nested.property}} works fine
   - **Object stringification**: Use {{json variableName}} to stringify entire objects
   - **Variable names**: Use exact variable names from previous nodes in execution chain
   - **Safe access**: Always reference variables that exist in the execution chain context

4. **Context Accumulation Pattern** (CRITICAL - Understand how data flows):
   - **Context accumulates**: Each node's output is merged into context and available to ALL subsequent nodes
   - **Example workflow**: Manual Trigger → HTTP Request (testflow) → HTTP Request (testflow2)
     * After Node 2: Context = { testflow: { httpResponse: { data: {...}, status: 200 } } }
     * After Node 3: Context = { testflow: {...}, testflow2: { httpResponse: { data: [...], status: 200 } } }
   - **HTTP Node output structure**: { variableName: { httpResponse: { data, status, statusText } } }
   - **AI Node output structure**: { variableName: { text, ... } } or { variableName: { ... } }
   - **CODE_BLOCK output structure**: { variableName: { ... } } + properties spread directly into context
   - **Accessing previous outputs**: 
     * For HTTP nodes: {{testflow.httpResponse.data}} or {{testflow2.httpResponse.data}}
     * For AI nodes: {{aiResponse.text}} or {{aiResponse}}
     * For CODE_BLOCK: {{result.propertyName}} or {{propertyName}} (if spread)
   - **Preservation**: Previous node outputs are ALWAYS preserved in context, not overwritten

4. **Node-Specific Configuration**:
   - **Gmail sendEmail**: Always include "to", "subject", "body" fields (use templates when appropriate)
   - **HTTP Request**: Include "endpoint", "method" fields
   - **Airtable**: Include "baseId", "tableId" for actions that need them
   - **Google Sheets**: Include "spreadsheetId" when needed
   - **Google Calendar**: Include "calendarId" (use "primary" for default calendar)

5. **Credential Requirements**:
   - AI nodes (OPENAI, ANTHROPIC, GEMINI) require credentialId - you can omit this, user will be prompted
   - Airtable nodes require credentialId - you can omit this, user will be prompted
   - Google nodes require OAuth connection - you can omit this, user will be prompted

INSPECTION & QUALITY CHECKLIST - Verify at every step:
1. **Node Configuration**: Every node must have all required fields properly configured
2. **AI Model Nodes**: Must include appropriate model, system prompt, and user prompt with proper templating
3. **Variable Names**: Use descriptive, meaningful variable names (not generic "result" or "data")
4. **Data Templating**: Use Handlebars syntax ({{variableName}}) to reference previous node outputs correctly
5. **Connections**: Every node must be properly connected in execution order (trigger → action1 → action2 → ...)
6. **Node Types**: Use existing node types when possible, CODE_BLOCK only when necessary
7. **Context Usage**: Reference data from previous nodes using correct variable names from execution chain
8. **Production Ready**: Every node should be configured to work immediately without manual fixes

IMPORTANT:
- For CODE_BLOCK nodes, provide a detailed description of what the code should do in the "data.description" field
- You will generate the actual code separately based on this description
- Ensure connections make logical sense (data flow)
- Use descriptive labels and variable names
- Position fields will be calculated automatically, so omit them
- CONNECTIONS ARE MANDATORY: Include all connections in the "connections" array to ensure proper execution flow
- THINK LIKE A BUSINESS OWNER: Generate workflows that solve real problems, not just technical exercises
- INSPECT EVERY NODE: Before finalizing, verify each node is optimally configured for the best result

Generate a workflow that accomplishes the user's request. Use existing nodes when possible, and create CODE_BLOCK nodes for custom functionality.`;

  const isEditMode = !!(options.existingNodes && options.existingNodes.length > 0);

  // Get node output schemas to help Claude understand data flow
  const outputSchemas = getAllOutputSchemas();
  const schemasDescription = outputSchemas
    .map((schema) => {
      const structure = Object.entries(schema.outputStructure)
        .map(([varName, desc]) => `  - ${varName}: ${desc.description} (${desc.type})`)
        .join("\n");
      return `- ${schema.nodeType}:\n${structure}`;
    })
    .join("\n");

  const userPrompt = isEditMode
    ? `Update the existing workflow based on the following requirement. IMPORTANT: Return the COMPLETE workflow with ALL nodes (both existing and new/modified). Do NOT deduplicate nodes - include every node that should be in the final workflow.

${options.prompt}

Existing nodes in the workflow:
${JSON.stringify(
  (options.existingNodes || []).map((n) => ({
    type: n.type,
    variables: n.data?.variables,
    label: n.data?.label,
  })),
  null,
  2
)}

NODE OUTPUT STRUCTURES (for data flow and templating):
${schemasDescription}

HANDLEBARS TEMPLATING RULES (CRITICAL - MUST FOLLOW):
1. **Simple property access**: {{variableName}} or {{variableName.property}}
2. **Array access**: Use {{get variableName.arrayProperty index propertyName}} helper
   - CORRECT: {{get parsedContent result contentPieces 0 imageDescription}}
   - WRONG: {{parsedContent.result.contentPieces[0].imageDescription}} (causes parsing errors)
   - The get helper syntax: {{get basePath arrayIndex propertyName}}
3. **Nested objects**: {{variableName.nested.property}} works fine
4. **Object stringification**: Use {{json variableName}} to stringify entire objects
5. **Safe access**: Always use proper variable names from execution chain
6. **Variable referencing**: Reference variables from previous nodes using their exact variable names from the execution chain

AUTONOMOUS ERROR DEBUGGING & FIXING:
- **Inspect existing nodes**: Compare the existing workflow structure with the requirement
- **Fix templating errors**: If you see array access like [0], convert to {{get}} helper syntax
- **Fix variable references**: Ensure all variable names match the execution chain
- **Compare results**: When editing, ensure the updated workflow produces better results than the original
- **Validate connections**: Ensure all node connections are valid and follow execution order
- **Check node configuration**: Verify all required fields are properly set

CRITICAL: Return the COMPLETE workflow with ALL nodes. Include:
- All existing nodes that should remain (with their current IDs or new IDs if modified)
- All new nodes that should be added
- All modified nodes (with updated configurations)
- Do NOT deduplicate - if a node appears in both existing and new, include it once with the final desired configuration
- FIX any templating errors: Use {{get}} helper for array access, not [0] syntax
- IMPROVE the workflow: Ensure the updated workflow is better than the original

Return only valid JSON with the complete updated workflow. Do not include markdown code blocks or explanations.`
    : `Generate a workflow for the following requirement:

${options.prompt}

NODE OUTPUT STRUCTURES (for data flow and templating):
${schemasDescription}

Return only valid JSON. Do not include markdown code blocks or explanations.`;

  try {
    const selectedModel = options.model || "claude-sonnet-4-5-20250929";

    const message = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    let workflowJson = "";
    if (message.content[0].type === "text") {
      workflowJson = message.content[0].text;
    }

    // Extract JSON from response (remove markdown if present)
    workflowJson = workflowJson
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Parse workflow blueprint
    let blueprint = JSON.parse(workflowJson) as {
      nodes: Array<{
        id?: string;
        type: string;
        data: Record<string, unknown>;
      }>;
      connections: Array<{
        id?: string;
        source: string;
        target: string;
        fromOutput?: string;
        toInput?: string;
      }>;
    };

    // Ensure proper execution chain (add trigger if missing, fix connections)
    const chainResult = ensureExecutionChain(blueprint);
    blueprint = {
      nodes: chainResult.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        data: (n.data || {}) as Record<string, unknown>,
      })),
      connections: chainResult.connections,
    };

    // Log any fixes applied
    if (chainResult.addedTrigger) {
      console.log("Added MANUAL_TRIGGER node to workflow (no trigger found)");
    }
    if (chainResult.addedConnections > 0) {
      console.log(
        `Added ${chainResult.addedConnections} connection(s) to ensure proper execution chain`
      );
    }

    // Validate blueprint structure (but skip code validation for CODE_BLOCK nodes - code will be generated)
    const validation = validateWorkflowBlueprint(blueprint);
    // Filter out code validation errors for CODE_BLOCK nodes - they'll be generated next
    const codeValidationErrors = validation.errors.filter((err) => err.includes("missing code"));
    const otherErrors = validation.errors.filter((err) => !err.includes("missing code"));

    if (otherErrors.length > 0) {
      throw new Error(`Invalid workflow blueprint: ${otherErrors.join(", ")}`);
    }

    // Log warnings about missing code (will be generated)
    if (codeValidationErrors.length > 0 || validation.warnings.length > 0) {
      console.log(`Code generation needed for ${codeValidationErrors.length} CODE_BLOCK node(s)`);
    }

    // Generate custom code for CODE_BLOCK nodes
    const customCodeBlocks: Array<{
      nodeId: string;
      code: string;
      dependencies?: string[];
    }> = [];

    for (const node of blueprint.nodes) {
      if (node.type === NodeType.CODE_BLOCK) {
        const nodeId = node.id || createId();
        // Use existing code if available, otherwise use description to generate
        const existingCode = node.data.code as string | undefined;
        const description = (node.data.description as string) || "Custom code block";

        // If code already exists, use it; otherwise generate
        if (existingCode && typeof existingCode === "string" && existingCode.trim().length > 0) {
          // Code already exists, just ensure it's set in node data
          node.data.code = existingCode;
          node.data.language = node.data.language || "typescript";
          customCodeBlocks.push({
            nodeId,
            code: existingCode,
            dependencies: node.data.dependencies as string[] | undefined,
          });
          console.log(`Using existing code for CODE_BLOCK node ${nodeId}`);
        } else {
          // Generate code from description
          try {
            const codeResult = await generateCustomCode({
              requirement: description,
              context: {},
              existingNodes: blueprint.nodes.filter((n) => n.type !== NodeType.CODE_BLOCK),
              inputSchema: node.data.inputSchema as Record<string, unknown> | undefined,
              outputSchema: node.data.outputSchema as Record<string, unknown> | undefined,
              model: options.model || "claude-sonnet-4-5-20250929",
            });

            // Update node data with generated code
            node.data.code = codeResult.code;
            node.data.language = "typescript";
            if (codeResult.dependencies) {
              node.data.dependencies = codeResult.dependencies;
            }

            customCodeBlocks.push({
              nodeId,
              code: codeResult.code,
              dependencies: codeResult.dependencies,
            });
            console.log(`Generated code for CODE_BLOCK node ${nodeId}`);
          } catch (error) {
            console.error(`Failed to generate code for CODE_BLOCK node ${nodeId}:`, error);
            // Add placeholder code to prevent validation errors
            node.data.code = `// Failed to generate code: ${error instanceof Error ? error.message : String(error)}\nexport default async function execute(input: any) {\n  return { error: "Code generation failed" };\n}`;
            node.data.language = "typescript";
            // Continue with other nodes even if one fails
          }
        }
      }
    }

    // Build execution chain from connections to properly reference previous nodes
    const buildExecutionChain = (
      nodes: Array<{ id?: string; type: string; data: Record<string, unknown> }>,
      connections: Array<{ source: string; target: string }>
    ): Array<{ id: string; type: string; variables?: string }> => {
      // Build a map of incoming connections
      const incomingMap = new Map<string, string>();
      connections.forEach((conn) => {
        incomingMap.set(conn.target, conn.source);
      });

      // Find trigger nodes (nodes with no incoming connections)
      const triggerNodes = nodes.filter((n) => {
        const nodeId = n.id || "";
        return !incomingMap.has(nodeId);
      });

      if (triggerNodes.length === 0) return [];

      // Build chain starting from first trigger node
      const chain: Array<{ id: string; type: string; variables?: string }> = [];
      const visited = new Set<string>();

      const traverse = (nodeId: string) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const node = nodes.find((n) => (n.id || "") === nodeId);
        if (node) {
          chain.push({
            id: nodeId,
            type: node.type,
            variables: (node.data.variables as string) || undefined,
          });
        }

        // Find all nodes this node connects to
        connections
          .filter((conn) => conn.source === nodeId)
          .forEach((conn) => traverse(conn.target));
      };

      // Start from first trigger node
      const firstTriggerId = triggerNodes[0].id || "";
      traverse(firstTriggerId);

      return chain;
    };

    // Post-generation node configuration
    // 1. Enhance variable names
    let enhancedNodes = enhanceVariableNames(
      blueprint.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        data: n.data,
      })),
      options.prompt
    );

    // Build execution chain for proper node referencing
    const executionChain = buildExecutionChain(enhancedNodes, blueprint.connections);

    // 2. Configure AI model nodes (async - uses Claude for system prompt generation)
    const configuredNodesPromises = enhancedNodes.map(async (node, index) => {
      const nodeId = node.id || "";

      // Find previous nodes in execution chain
      const currentNodeIndexInChain = executionChain.findIndex((n) => n.id === nodeId);
      const previousNodesInChain =
        currentNodeIndexInChain > 0 ? executionChain.slice(0, currentNodeIndexInChain) : [];

      // Also include all previous nodes in array order as fallback
      const previousNodes = enhancedNodes.slice(0, index);

      const context: NodeConfigurationContext = {
        workflowPurpose: options.prompt,
        previousNodes: previousNodes.map((n) => ({
          id: n.id || "",
          type: n.type,
          variables: (n.data.variables as string) || undefined,
          data: n.data,
        })),
        currentNodeIndex: index,
        executionChain: previousNodesInChain.length > 0 ? previousNodesInChain : undefined,
      };

      const configuredData = await configureAIModelNode(node, context);
      return {
        ...node,
        data: configuredData,
      };
    });

    const configuredNodes = await Promise.all(configuredNodesPromises);

    // 3. Add templating to nodes based on connections
    const nodesWithTemplating = addTemplatingToNodes(configuredNodes, blueprint.connections);

    // Calculate positions for all nodes
    const positions = calculateWorkflowPositions({
      nodes: nodesWithTemplating.map((n, i) => ({
        id: n.id || `node-${i}`,
        type: n.type,
      })),
      connections: blueprint.connections,
    });

    // Build final result with positions
    const nodes: GeneratedNode[] = nodesWithTemplating.map((node, index) => {
      const nodeId = node.id || `node-${index}`;
      const position = positions.get(nodeId) || { x: 100 + index * 250, y: 100 };

      return {
        id: nodeId,
        type: node.type,
        data: node.data,
        position,
      };
    });

    // Ensure all connections have IDs and proper format
    const connections: GeneratedConnection[] = blueprint.connections.map((conn, index) => ({
      id: conn.id || createId(),
      source: conn.source,
      target: conn.target,
      fromOutput: conn.fromOutput || "main",
      toInput: conn.toInput || "main",
    }));

    // Log connections for debugging
    console.log(
      `Generated workflow with ${nodes.length} nodes and ${connections.length} connections`
    );
    if (connections.length > 0) {
      console.log("Connections:", connections.map((c) => `${c.source} -> ${c.target}`).join(", "));
    }

    // Generate setup instructions
    const setupInstructions = await generateSetupInstructions(nodes, options.userId);

    return {
      nodes,
      connections,
      customCodeBlocks: customCodeBlocks.length > 0 ? customCodeBlocks : undefined,
      setupInstructions: setupInstructions.length > 0 ? setupInstructions : undefined,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Failed to parse workflow JSON: ${error.message}. This might indicate Claude returned invalid JSON.`
      );
    }
    throw new Error(
      `Failed to generate workflow: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};
