import { basePrismaClient } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { NODE_TYPE_TO_FEATURE } from "../config/subscription-features";
import { hasFeatureAccess } from "../config/subscription-features";
import { getPlanFeatures } from "../config/subscription-features";
import { getUserSubscription } from "./subscriptionService";

const prisma = basePrismaClient as any;

export interface WorkflowTemplateCreateInput {
  name: string;
  shortDescription: string;
  howItWorks: string;
  requirements?: string;
  pricing?: string;
  category: string;
  creatorUsername: string;
}

export interface WorkflowTemplateListItem {
  id: string;
  name: string;
  shortDescription: string;
  pricing: string;
  creatorUsername: string;
  category: string;
  downloadCount: number;
  createdAt: Date;
}

export interface WorkflowTemplateDetail extends WorkflowTemplateListItem {
  howItWorks: string;
  requirements: string | null;
  workflowId: string;
  workflowSnapshot: { nodes: unknown[]; connections: unknown[] };
}

export interface TemplateListResult {
  templates: WorkflowTemplateListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * List workflow templates with optional search (name, keywords, category) and pagination
 */
export async function listTemplates(
  opts: {
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<TemplateListResult> {
  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 10, 50);
  const skip = (page - 1) * limit;

  const where: any = {};
  if (opts.search && opts.search.trim()) {
    const term = opts.search.trim().toLowerCase();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { shortDescription: { contains: term, mode: "insensitive" } },
      { category: { contains: term, mode: "insensitive" } },
      { creatorUsername: { contains: term, mode: "insensitive" } },
    ];
  }
  if (opts.category && opts.category.trim()) {
    where.category = { contains: opts.category.trim(), mode: "insensitive" };
  }

  const [total, rows] = await Promise.all([
    prisma.workflowTemplate.count({ where }),
    prisma.workflowTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        shortDescription: true,
        pricing: true,
        creatorUsername: true,
        category: true,
        downloadCount: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    templates: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Get a single template by id
 */
export async function getTemplateById(id: string): Promise<WorkflowTemplateDetail | null> {
  const t = await prisma.workflowTemplate.findUnique({
    where: { id },
  });
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    shortDescription: t.shortDescription,
    howItWorks: t.howItWorks,
    requirements: t.requirements ?? null,
    pricing: t.pricing ?? "Free",
    creatorUsername: t.creatorUsername,
    category: t.category,
    downloadCount: (t as any).downloadCount ?? 0,
    createdAt: t.createdAt,
    workflowId: t.workflowId,
    workflowSnapshot: t.workflowSnapshot as { nodes: unknown[]; connections: unknown[] },
  };
}

/**
 * Create a template from an existing workflow. Caller must ensure user has export feature.
 */
export async function createFromWorkflow(
  userId: string,
  workflowId: string,
  input: WorkflowTemplateCreateInput
): Promise<WorkflowTemplateDetail> {
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, userId },
    include: {
      nodes: true,
      connections: true,
    },
  });
  if (!workflow) {
    throw new AppError("Workflow not found", 404);
  }

  const snapshot = {
    nodes: workflow.nodes.map((n: any) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      position: n.position,
      data: n.data ?? {},
    })),
    connections: (workflow.connections || []).map((c: any) => ({
      id: c.id,
      source: c.fromNodeId,
      target: c.toNodeId,
      sourceHandle: c.fromOutput ?? "main",
      targetHandle: c.toInput ?? "main",
    })),
  };

  const template = await prisma.workflowTemplate.create({
    data: {
      name: input.name,
      shortDescription: input.shortDescription,
      howItWorks: input.howItWorks,
      requirements: input.requirements ?? null,
      pricing: input.pricing ?? "Free",
      category: input.category,
      creatorUserId: userId,
      creatorUsername: input.creatorUsername,
      workflowId,
      workflowSnapshot: snapshot,
    },
  });

  return getTemplateById(template.id) as Promise<WorkflowTemplateDetail>;
}

/**
 * Return node types present in a workflow snapshot
 */
function getNodeTypesInSnapshot(snapshot: { nodes: { type: string }[] }): Set<string> {
  const types = new Set<string>();
  for (const n of snapshot?.nodes ?? []) {
    if (n?.type) types.add(n.type);
  }
  return types;
}

/**
 * Import a template: create a new workflow with the template's name and snapshot.
 * If the template contains premium node types, the user must have access to all of them;
 * otherwise returns an error indicating upgrade is required.
 */
export async function importTemplate(
  userId: string,
  templateId: string
): Promise<{ workflowId: string; name: string }> {
  const template = await getTemplateById(templateId);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  const snapshot = template.workflowSnapshot as { nodes: { type: string }[] };
  const nodeTypes = getNodeTypesInSnapshot(snapshot);

  const subscription = await getUserSubscription(userId);
  const features =
    subscription?.features ?? getPlanFeatures(subscription?.subscriptionPlan ?? null);

  for (const nodeType of nodeTypes) {
    const requiredFeature = NODE_TYPE_TO_FEATURE[nodeType];
    if (requiredFeature && !hasFeatureAccess(features, requiredFeature)) {
      throw new AppError(
        "Upgrade to a premium plan to import this template. This template contains premium nodes that require a subscription.",
        403
      );
    }
  }

  const workflow = await prisma.workflow.create({
    data: {
      name: template.name,
      userId,
    },
  });

  const nodes = (snapshot.nodes ?? []) as {
    id: string;
    name: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }[];
  const connections =
    (
      template.workflowSnapshot as {
        connections: {
          source: string;
          target: string;
          sourceHandle?: string;
          targetHandle?: string;
        }[];
      }
    ).connections ?? [];

  const oldToNewId: Record<string, string> = {};
  for (const n of nodes) {
    const created = await prisma.node.create({
      data: {
        workflowId: workflow.id,
        name: n.name,
        type: n.type,
        position: n.position ?? { x: 0, y: 0 },
        data: (n.data ?? {}) as any,
      },
    });
    oldToNewId[n.id] = created.id;
  }

  for (const c of connections) {
    const fromId = oldToNewId[c.source];
    const toId = oldToNewId[c.target];
    if (fromId && toId) {
      await prisma.connection.create({
        data: {
          workflowId: workflow.id,
          fromNodeId: fromId,
          toNodeId: toId,
          fromOutput: c.sourceHandle ?? "main",
          toInput: c.targetHandle ?? "main",
        },
      });
    }
  }

  await prisma.workflowTemplate.update({
    where: { id: templateId },
    data: { downloadCount: { increment: 1 } },
  });

  return { workflowId: workflow.id, name: workflow.name };
}
