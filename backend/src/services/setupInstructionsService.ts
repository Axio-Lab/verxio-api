import { NodeType } from "@/lib/node-types";
import { getCredentials } from "./credentialService";
import { getGoogleOAuthToken } from "./googleOAuthService";
import { prisma } from "@/lib/prisma";

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

/**
 * Analyzes generated workflow nodes and generates setup instructions
 */
export async function generateSetupInstructions(
  nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>,
  userId: string
): Promise<SetupInstruction[]> {
  const instructions: SetupInstruction[] = [];

  // Get user's existing credentials
  const userCredentials = await getCredentials(userId, 1, 1000);
  const credentialMap = new Map(userCredentials.credentials.map((cred) => [cred.type, cred]));

  // Check each node for setup requirements
  for (const node of nodes) {
    const nodeType = node.type;
    const nodeData = node.data || {};
    const nodeLabel = (nodeData.label as string) || nodeType;

    // Check credential requirements
    const credentialInstructions = await checkCredentialRequirements(
      nodeType,
      nodeData,
      node.id,
      nodeLabel,
      credentialMap
    );
    instructions.push(...credentialInstructions);

    // Check node configuration requirements
    const configInstructions = checkNodeConfiguration(nodeType, nodeData, node.id, nodeLabel);
    instructions.push(...configInstructions);

    // Check OAuth requirements
    const oauthInstructions = await checkOAuthRequirements(
      nodeType,
      nodeData,
      node.id,
      nodeLabel,
      userId
    );
    instructions.push(...oauthInstructions);
  }

  // Sort by priority (high first)
  return instructions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Check if node requires credentials and if user has them
 */
async function checkCredentialRequirements(
  nodeType: string,
  nodeData: Record<string, unknown>,
  nodeId: string,
  nodeLabel: string,
  credentialMap: Map<string, { id: string; name: string; type: string }>
): Promise<SetupInstruction[]> {
  const instructions: SetupInstruction[] = [];

  // AI Model nodes require credentials
  if (nodeType === NodeType.OPENAI) {
    const credentialId = nodeData.credentialId as string | undefined;
    if (!credentialId) {
      const hasCredential = credentialMap.has("OPENAI");
      if (!hasCredential) {
        instructions.push({
          type: "credential",
          nodeId,
          nodeType,
          nodeLabel,
          message: "Add OpenAI API key to credentials (type: OPENAI)",
          priority: "high",
          action: {
            type: "add_credential",
            credentialType: "OPENAI",
          },
        });
      } else {
        instructions.push({
          type: "configuration",
          nodeId,
          nodeType,
          nodeLabel,
          message: "Open OpenAI node and select a credential",
          priority: "medium",
          action: {
            type: "open_node",
            nodeId,
          },
        });
      }
    }
  }

  if (nodeType === NodeType.ANTHROPIC) {
    const credentialId = nodeData.credentialId as string | undefined;
    if (!credentialId) {
      const hasCredential = credentialMap.has("ANTHROPIC");
      if (!hasCredential) {
        instructions.push({
          type: "credential",
          nodeId,
          nodeType,
          nodeLabel,
          message: "Add Anthropic API key to credentials (type: ANTHROPIC)",
          priority: "high",
          action: {
            type: "add_credential",
            credentialType: "ANTHROPIC",
          },
        });
      } else {
        instructions.push({
          type: "configuration",
          nodeId,
          nodeType,
          nodeLabel,
          message: "Open Anthropic node and select a credential",
          priority: "medium",
          action: {
            type: "open_node",
            nodeId,
          },
        });
      }
    }
  }

  if (nodeType === NodeType.GEMINI) {
    const credentialId = nodeData.credentialId as string | undefined;
    if (!credentialId) {
      const hasCredential = credentialMap.has("GEMINI");
      if (!hasCredential) {
        instructions.push({
          type: "credential",
          nodeId,
          nodeType,
          nodeLabel,
          message: "Add Gemini API key to credentials (type: GEMINI)",
          priority: "high",
          action: {
            type: "add_credential",
            credentialType: "GEMINI",
          },
        });
      } else {
        instructions.push({
          type: "configuration",
          nodeId,
          nodeType,
          nodeLabel,
          message: "Open Gemini node and select a credential",
          priority: "medium",
          action: {
            type: "open_node",
            nodeId,
          },
        });
      }
    }
  }

  // Airtable nodes require credentials
  if (nodeType === NodeType.AIRTABLE || nodeType === NodeType.AIRTABLE_TRIGGER) {
    const credentialId = nodeData.credentialId as string | undefined;
    if (!credentialId) {
      const hasCredential = credentialMap.has("AIRTABLE");
      if (!hasCredential) {
        instructions.push({
          type: "credential",
          nodeId,
          nodeType,
          nodeLabel,
          message: "Add Airtable Personal Access Token to credentials (type: AIRTABLE)",
          priority: "high",
          action: {
            type: "add_credential",
            credentialType: "AIRTABLE",
          },
        });
      } else {
        instructions.push({
          type: "configuration",
          nodeId,
          nodeType,
          nodeLabel,
          message: "Open Airtable node and select a credential",
          priority: "medium",
          action: {
            type: "open_node",
            nodeId,
          },
        });
      }
    }
  }

  // Telegram nodes require credentials
  if (nodeType === NodeType.TELEGRAM || nodeType === NodeType.TELEGRAM_TRIGGER) {
    const credentialId = nodeData.credentialId as string | undefined;
    if (!credentialId) {
      const hasCredential = credentialMap.has("TELEGRAM");
      if (!hasCredential) {
        instructions.push({
          type: "credential",
          nodeId,
          nodeType,
          nodeLabel,
          message: "Add Telegram Bot Token to credentials (type: TELEGRAM)",
          priority: "high",
          action: {
            type: "add_credential",
            credentialType: "TELEGRAM",
          },
        });
      } else {
        instructions.push({
          type: "configuration",
          nodeId,
          nodeType,
          nodeLabel,
          message: "Open Telegram node and select a credential",
          priority: "medium",
          action: {
            type: "open_node",
            nodeId,
          },
        });
      }
    }
  }

  // CODE_BLOCK nodes may need custom credentials
  if (nodeType === NodeType.CODE_BLOCK) {
    const credentialIds = (nodeData.credentialIds as string[] | undefined) || [];
    const code = (nodeData.code as string) || "";

    // Check if code mentions API keys that might need custom credentials
    const apiKeyPatterns = [
      /api[_-]?key/gi,
      /apikey/gi,
      /secret[_-]?key/gi,
      /access[_-]?token/gi,
      /bearer[_-]?token/gi,
    ];

    const needsApiKey = apiKeyPatterns.some((pattern) => pattern.test(code));

    if (needsApiKey && credentialIds.length === 0) {
      // Try to extract API key name from code comments
      const credentialNameMatch =
        code.match(/\/\/.*[Cc]redential[:\s]+(\w+)/i) ||
        code.match(/\/\/.*[Aa][Pp][Ii][\s_-]?[Kk]ey[:\s]+(\w+)/i);
      const suggestedName = credentialNameMatch ? credentialNameMatch[1] : "API_KEY";

      instructions.push({
        type: "credential",
        nodeId,
        nodeType,
        nodeLabel,
        message: `Add custom API key "${suggestedName}" to credentials (type: custom)`,
        priority: "high",
        action: {
          type: "add_credential",
          credentialType: "custom",
          credentialName: suggestedName,
        },
      });
    }
  }

  return instructions;
}

/**
 * Check if node needs additional configuration
 */
function checkNodeConfiguration(
  nodeType: string,
  nodeData: Record<string, unknown>,
  nodeId: string,
  nodeLabel: string
): SetupInstruction[] {
  const instructions: SetupInstruction[] = [];

  // Gmail sendEmail action requires 'to' field
  if (nodeType === NodeType.GMAIL) {
    const action = nodeData.action as string | undefined;
    if (action === "sendEmail" || action === "sendEmailWithAttachment") {
      const to = nodeData.to as string | undefined;
      if (!to || to.trim() === "") {
        instructions.push({
          type: "configuration",
          nodeId,
          nodeType,
          nodeLabel,
          message: "Open Gmail node and set recipient email address (to field)",
          priority: "high",
          action: {
            type: "open_node",
            nodeId,
          },
        });
      }
    }
  }

  // HTTP Request requires endpoint
  if (nodeType === NodeType.HTTP_REQUEST) {
    const endpoint = nodeData.endpoint as string | undefined;
    if (!endpoint || endpoint.trim() === "") {
      instructions.push({
        type: "configuration",
        nodeId,
        nodeType,
        nodeLabel,
        message: "Open HTTP Request node and set endpoint URL",
        priority: "high",
        action: {
          type: "open_node",
          nodeId,
        },
      });
    }
  }

  // Airtable action nodes require baseId and tableId
  if (nodeType === NodeType.AIRTABLE) {
    const action = nodeData.action as string | undefined;
    if (action && action !== "listBases") {
      const baseId = nodeData.baseId as string | undefined;
      const tableId = nodeData.tableId as string | undefined;

      if (!baseId || baseId.trim() === "") {
        instructions.push({
          type: "configuration",
          nodeId,
          nodeType,
          nodeLabel,
          message: "Open Airtable node and set base ID",
          priority: "high",
          action: {
            type: "open_node",
            nodeId,
          },
        });
      }
      if (!tableId || tableId.trim() === "") {
        instructions.push({
          type: "configuration",
          nodeId,
          nodeType,
          nodeLabel,
          message: "Open Airtable node and set table ID/name",
          priority: "high",
          action: {
            type: "open_node",
            nodeId,
          },
        });
      }
    }
  }

  // Google Sheets requires spreadsheetId
  if (nodeType === NodeType.GOOGLE_SHEETS) {
    const spreadsheetId = nodeData.spreadsheetId as string | undefined;
    if (!spreadsheetId || spreadsheetId.trim() === "") {
      instructions.push({
        type: "configuration",
        nodeId,
        nodeType,
        nodeLabel,
        message: "Open Google Sheets node and set spreadsheet ID",
        priority: "high",
        action: {
          type: "open_node",
          nodeId,
        },
      });
    }
  }

  // Google Calendar requires calendarId for some actions
  if (nodeType === NodeType.GOOGLE_CALENDAR) {
    const action = nodeData.action as string | undefined;
    if (action && action !== "listCalendars") {
      const calendarId = nodeData.calendarId as string | undefined;
      if (!calendarId || calendarId.trim() === "") {
        instructions.push({
          type: "configuration",
          nodeId,
          nodeType,
          nodeLabel,
          message:
            "Open Google Calendar node and set calendar ID (use 'primary' for default calendar)",
          priority: "medium",
          action: {
            type: "open_node",
            nodeId,
          },
        });
      }
    }
  }

  return instructions;
}

/**
 * Check if node requires OAuth connections
 */
async function checkOAuthRequirements(
  nodeType: string,
  nodeData: Record<string, unknown>,
  nodeId: string,
  nodeLabel: string,
  userId: string
): Promise<SetupInstruction[]> {
  const instructions: SetupInstruction[] = [];

  // Google services require OAuth
  const googleNodeTypes = [
    NodeType.GOOGLE_DRIVE,
    NodeType.GOOGLE_CALENDAR,
    NodeType.GOOGLE_SHEETS,
    NodeType.GOOGLE_DOCS,
    NodeType.GOOGLE_MEET,
    NodeType.GOOGLE_SLIDES,
    NodeType.GMAIL,
  ];

  if (googleNodeTypes.includes(nodeType as any)) {
    try {
      const token = await getGoogleOAuthToken(userId);
      if (!token) {
        instructions.push({
          type: "oauth",
          nodeId,
          nodeType,
          nodeLabel,
          message: `Connect your Google account for ${nodeLabel} access`,
          priority: "high",
          action: {
            type: "connect_oauth",
          },
        });
      }
    } catch (error) {
      // If error getting token, assume OAuth is needed
      instructions.push({
        type: "oauth",
        nodeId,
        nodeType,
        nodeLabel,
        message: `Connect your Google account for ${nodeLabel} access`,
        priority: "high",
        action: {
          type: "connect_oauth",
        },
      });
    }
  }

  return instructions;
}
