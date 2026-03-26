import { basePrismaClient } from "../lib/prisma";

const prisma = basePrismaClient as any;

export interface CreateSubagentInput {
  name: string;
  description: string;
  prompt: string;
  skillIds?: string[];
  tools?: string[];
  model?: string;
  maxTurns?: number;
}

export interface UpdateSubagentInput {
  name?: string;
  description?: string;
  prompt?: string;
  skillIds?: string[];
  tools?: string[];
  model?: string;
  maxTurns?: number;
  isActive?: boolean;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const ALLOWED_TOOLS = ["Read", "Glob", "Grep", "Edit", "Bash", "WebSearch", "WebFetch", "Agent"];

function validateTools(tools: string[]): string[] {
  return tools.filter((t) => ALLOWED_TOOLS.includes(t));
}

export async function createSubagent(userId: string, data: CreateSubagentInput) {
  const slug = toSlug(data.name);

  const existing = await prisma.customSubagent.findUnique({
    where: { userId_slug: { userId, slug } },
  });
  if (existing) {
    throw new Error(`A subagent with slug "${slug}" already exists. Choose a different name.`);
  }

  if (data.skillIds?.length) {
    const skills = await prisma.userSkill.findMany({
      where: { id: { in: data.skillIds }, userId },
      select: { id: true },
    });
    data.skillIds = skills.map((s: { id: string }) => s.id);
  }

  return prisma.customSubagent.create({
    data: {
      userId,
      name: data.name,
      slug,
      description: data.description,
      prompt: data.prompt,
      skillIds: data.skillIds || [],
      tools: data.tools
        ? validateTools(data.tools)
        : ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
      model: data.model || "sonnet",
      maxTurns: data.maxTurns || 8,
    },
  });
}

export async function updateSubagent(
  userId: string,
  subagentId: string,
  data: UpdateSubagentInput
) {
  const existing = await prisma.customSubagent.findFirst({
    where: { id: subagentId, userId },
  });
  if (!existing) throw new Error("Subagent not found");

  const updateData: any = { ...data };

  if (data.name) {
    updateData.slug = toSlug(data.name);
    const conflict = await prisma.customSubagent.findUnique({
      where: { userId_slug: { userId, slug: updateData.slug } },
    });
    if (conflict && conflict.id !== subagentId) {
      throw new Error(`A subagent with slug "${updateData.slug}" already exists.`);
    }
  }

  if (data.skillIds?.length) {
    const skills = await prisma.userSkill.findMany({
      where: { id: { in: data.skillIds }, userId },
      select: { id: true },
    });
    updateData.skillIds = skills.map((s: { id: string }) => s.id);
  }

  if (data.tools) {
    updateData.tools = validateTools(data.tools);
  }

  return prisma.customSubagent.update({
    where: { id: subagentId },
    data: updateData,
  });
}

export async function deleteSubagent(userId: string, subagentId: string) {
  const existing = await prisma.customSubagent.findFirst({
    where: { id: subagentId, userId },
  });
  if (!existing) throw new Error("Subagent not found");

  return prisma.customSubagent.delete({ where: { id: subagentId } });
}

export async function listSubagents(userId: string) {
  return prisma.customSubagent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSubagent(userId: string, subagentId: string) {
  return prisma.customSubagent.findFirst({
    where: { id: subagentId, userId },
  });
}

export async function getActiveSubagents(userId: string) {
  return prisma.customSubagent.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function loadSubagentWithSkills(userId: string, subagentId: string) {
  const subagent = await prisma.customSubagent.findFirst({
    where: { id: subagentId, userId },
  });
  if (!subagent) return null;

  let skillContent = "";
  if (subagent.skillIds.length > 0) {
    const skills = await prisma.userSkill.findMany({
      where: { id: { in: subagent.skillIds }, userId },
      select: { name: true, content: true },
    });
    if (skills.length > 0) {
      skillContent = skills
        .map((s: { name: string; content: string }) => `## Skill: ${s.name}\n${s.content}`)
        .join("\n\n---\n\n");
    }
  }

  return { ...subagent, skillContent };
}
