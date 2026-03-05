import { simpleAgentQuery } from "./agent/agentService";
import { prisma } from "../lib/prisma";

const ZAPIER_TO_VERXIO: Record<string, string> = {
  google_sheets: "GOOGLE_SHEETS",
  gmail: "GMAIL",
  slack: "SLACK",
  google_calendar: "GOOGLE_CALENDAR",
  airtable: "AIRTABLE",
  webhooks: "WEBHOOK",
  webhook: "WEBHOOK",
  http: "HTTP_REQUEST",
  filter: "DECIDER",
  google_drive: "GOOGLE_DRIVE",
  google_docs: "GOOGLE_DOCS",
  discord: "DISCORD",
  telegram: "TELEGRAM",
  openai: "OPENAI",
};

const MAKE_TO_VERXIO: Record<string, string> = {
  "google-sheets": "GOOGLE_SHEETS",
  gmail: "GMAIL",
  slack: "SLACK",
  "google-calendar": "GOOGLE_CALENDAR",
  airtable: "AIRTABLE",
  http: "HTTP_REQUEST",
  webhook: "WEBHOOK",
  filter: "DECIDER",
  "google-drive": "GOOGLE_DRIVE",
  "google-docs": "GOOGLE_DOCS",
  discord: "DISCORD",
  "telegram-bot": "TELEGRAM",
  "openai-gpt": "OPENAI",
};

interface MappedStep {
  name: string;
  sourceApp: string;
  sourceAction: string;
  verxioNodeType: string;
  config: Record<string, any>;
  position: number;
}

function detectFormat(json: any): "zapier" | "make" | "unknown" {
  if (json.steps || json.zap) return "zapier";
  if (json.flow || json.modules || json.name?.includes("scenario")) return "make";
  if (Array.isArray(json) && json[0]?.module) return "make";
  return "unknown";
}

function parseZapierExport(json: any): MappedStep[] {
  const steps: MappedStep[] = [];
  const rawSteps = json.steps || json.zap?.steps || [];

  for (let i = 0; i < rawSteps.length; i++) {
    const step = rawSteps[i];
    const app = (step.app || step.selected_api || "").toLowerCase();
    const action = step.action || step.action_type || "";

    steps.push({
      name: step.title || step.label || `Step ${i + 1}`,
      sourceApp: app,
      sourceAction: action,
      verxioNodeType: ZAPIER_TO_VERXIO[app] || "COMPOSIO_ACTION",
      config: step.params || step.data || {},
      position: i,
    });
  }

  return steps;
}

function parseMakeExport(json: any): MappedStep[] {
  const steps: MappedStep[] = [];
  const modules = json.flow?.modules || json.modules || (Array.isArray(json) ? json : []);

  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    const app = (mod.module || mod.type || "").toLowerCase().split(":")[0];

    steps.push({
      name: mod.metadata?.designer?.name || mod.label || `Module ${i + 1}`,
      sourceApp: app,
      sourceAction: mod.module || mod.type || "",
      verxioNodeType: MAKE_TO_VERXIO[app] || "COMPOSIO_ACTION",
      config: mod.mapper || mod.parameters || {},
      position: i,
    });
  }

  return steps;
}

async function refineWithAI(
  userId: string,
  steps: MappedStep[],
  sourceFormat: string
): Promise<MappedStep[]> {
  const stepsSummary = steps.map((s) => ({
    name: s.name,
    sourceApp: s.sourceApp,
    sourceAction: s.sourceAction,
    mappedTo: s.verxioNodeType,
    config: Object.keys(s.config).slice(0, 5),
  }));

  const prompt = `You are helping migrate a ${sourceFormat} automation to Verxio.

Here are the mapped steps:
${JSON.stringify(stepsSummary, null, 2)}

Available Verxio node types: MANUAL_TRIGGER, HTTP_REQUEST, WEBHOOK, ANTHROPIC, GEMINI, OPENAI, DISCORD, SLACK, WHATSAPP, TELEGRAM, DECIDER, GOOGLE_DRIVE, GOOGLE_CALENDAR, GOOGLE_SHEETS, GOOGLE_DOCS, GOOGLE_MEET, GOOGLE_SLIDES, GMAIL, AIRTABLE, CODE_BLOCK, COMPOSIO_ACTION, DESIGN, VEO, AGENT_TEAM

Review and fix any incorrect mappings. The first step should have a trigger node type (MANUAL_TRIGGER, WEBHOOK, etc.) if it's a trigger.

Return ONLY a JSON array of objects with fields: name, verxioNodeType, configSuggestion (a short text describing what config is needed).
No explanation, just the JSON array.`;

  try {
    const result = await simpleAgentQuery({
      prompt,
      userId,
      maxTurns: 3,
    });

    const responseText = result.result || "";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const refined = JSON.parse(jsonMatch[0]);
      return steps.map((step, i) => {
        const r = refined[i];
        if (r) {
          return {
            ...step,
            name: r.name || step.name,
            verxioNodeType: r.verxioNodeType || step.verxioNodeType,
          };
        }
        return step;
      });
    }
  } catch (err) {
    console.error("[Migration] AI refinement failed, using direct mapping:", err);
  }

  return steps;
}

export async function importWorkflow(
  userId: string,
  exportJson: any
): Promise<{ workflowId: string; stepsImported: number; setupInstructions: string[] }> {
  const format = detectFormat(exportJson);
  if (format === "unknown") {
    throw new Error("Unrecognized export format. Please upload a Zapier or Make.com JSON export.");
  }

  let steps = format === "zapier" ? parseZapierExport(exportJson) : parseMakeExport(exportJson);

  if (steps.length === 0) {
    throw new Error("No steps found in the export file.");
  }

  // AI refinement
  steps = await refineWithAI(userId, steps, format);

  // Ensure first step is a trigger
  if (
    steps.length > 0 &&
    !steps[0].verxioNodeType.includes("TRIGGER") &&
    steps[0].verxioNodeType !== "WEBHOOK"
  ) {
    steps[0].verxioNodeType = "MANUAL_TRIGGER";
  }

  // Create workflow via Prisma directly
  const workflowName = exportJson.name || exportJson.title || `Imported from ${format}`;
  const workflow = await prisma.workflow.create({
    data: { name: workflowName, userId },
  });

  // Add nodes
  const nodeIds: string[] = [];
  const setupInstructions: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const node = await prisma.node.create({
      data: {
        workflowId: workflow.id,
        name: step.name,
        type: step.verxioNodeType as any,
        position: { x: 200 + i * 300, y: 200 },
        data: { variables: step.name.toLowerCase().replace(/\s+/g, "_") },
      },
    });
    nodeIds.push(node.id);

    if (step.verxioNodeType === "COMPOSIO_ACTION") {
      setupInstructions.push(
        `Step "${step.name}" (${step.sourceApp}): Configure Composio action for ${step.sourceAction}`
      );
    } else if (
      [
        "GMAIL",
        "GOOGLE_SHEETS",
        "GOOGLE_DRIVE",
        "GOOGLE_CALENDAR",
        "GOOGLE_DOCS",
        "GOOGLE_SLIDES",
        "GOOGLE_MEET",
      ].includes(step.verxioNodeType)
    ) {
      setupInstructions.push(`Step "${step.name}": Connect your Google account credential`);
    } else if (step.verxioNodeType === "SLACK") {
      setupInstructions.push(`Step "${step.name}": Connect your Slack credential`);
    } else if (step.verxioNodeType === "AIRTABLE") {
      setupInstructions.push(`Step "${step.name}": Connect your Airtable credential`);
    }
  }

  // Connect nodes sequentially
  for (let i = 0; i < nodeIds.length - 1; i++) {
    await prisma.connection.create({
      data: {
        workflowId: workflow.id,
        fromNodeId: nodeIds[i],
        toNodeId: nodeIds[i + 1],
      },
    });
  }

  return {
    workflowId: workflow.id,
    stepsImported: steps.length,
    setupInstructions:
      setupInstructions.length > 0 ? setupInstructions : ["No additional setup required."],
  };
}
