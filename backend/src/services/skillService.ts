import { basePrismaClient } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { getSharedResourceIds, canAccessResource } from "./organizationService";
import ky from "ky";

const prismaClient = basePrismaClient as any;

export interface CreateSkillData {
  name: string;
  description?: string;
  url?: string;
  content: string;
  userId: string;
}

export interface UpdateSkillData {
  name?: string;
  description?: string;
  url?: string;
  content?: string;
}

export interface SkillResponse {
  id: string;
  name: string;
  description?: string;
  url?: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillsListResponse {
  skills: SkillResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Parse skill metadata from markdown content
 * Extracts name from first # heading or frontmatter
 * Extracts description from first paragraph or frontmatter
 */
export function parseSkillMetadata(content: string): { name: string; description?: string } {
  // Try to extract from frontmatter first
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (nameMatch) {
      let description = descMatch?.[1]?.trim();
      // Enforce 50 character limit on frontmatter description
      if (description && description.length > 50) {
        description = description.slice(0, 50);
      }
      return {
        name: nameMatch[1].trim(),
        description,
      };
    }
  }

  // Extract name from first # heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  const name = headingMatch ? headingMatch[1].trim() : "Untitled Skill";

  // Extract description from first paragraph after heading
  const afterHeading = content.replace(/^#\s+.*$/m, "").trim();
  const firstParagraph = afterHeading.split(/\n\n/)[0]?.trim();
  let description = firstParagraph && firstParagraph.length < 200 ? firstParagraph : undefined;

  // Enforce 50 character limit on parsed description
  if (description && description.length > 50) {
    description = description.slice(0, 50);
  }

  return { name, description };
}

/**
 * Fetch skill content from URL using ky
 */
export async function fetchSkillFromUrl(url: string): Promise<string> {
  try {
    // Validate URL
    const urlObj = new URL(url);
    if (urlObj.protocol !== "https:" && urlObj.protocol !== "http:") {
      throw new AppError("URL must use HTTP or HTTPS protocol", 400);
    }

    // Fetch content
    const response = await ky.get(url, {
      timeout: 10000, // 10 second timeout
      headers: {
        Accept: "text/markdown, text/plain, text/*",
      },
    });

    const content = await response.text();

    if (!content || content.trim().length === 0) {
      throw new AppError("Fetched content is empty", 400);
    }

    // Basic validation - check if it looks like markdown
    if (content.length > 1000000) {
      // 1MB limit
      throw new AppError("Skill file is too large (max 1MB)", 400);
    }

    return content;
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new AppError("Request timed out. Please check the URL and try again.", 408);
    }
    if (error.response) {
      throw new AppError(
        `Failed to fetch skill: ${error.response.status} ${error.response.statusText}`,
        400
      );
    }
    throw new AppError(`Failed to fetch skill: ${error.message || "Unknown error"}`, 400);
  }
}

/**
 * Create a new skill
 */
export const createSkill = async (data: CreateSkillData): Promise<SkillResponse> => {
  if (!data.name || data.name.trim() === "") {
    throw new AppError("Skill name is required", 400);
  }

  if (!data.content || data.content.trim() === "") {
    throw new AppError("Skill content is required", 400);
  }

  if (!data.userId) {
    throw new AppError("User ID is required", 400);
  }

  // Verify user exists
  const user = await prismaClient.user.findUnique({
    where: { id: data.userId },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Parse metadata if not provided
  let name = data.name.trim();
  let description = data.description?.trim();

  if (!description) {
    const metadata = parseSkillMetadata(data.content);
    if (name === "Untitled Skill" || name === "") {
      name = metadata.name;
    }
    description = metadata.description;
  }

  // Enforce 50 character limit on description
  if (description && description.length > 50) {
    description = description.slice(0, 50);
  }

  const skill = await prismaClient.userSkill.create({
    data: {
      name,
      description: description || null,
      url: data.url?.trim() || null,
      content: data.content.trim(),
      userId: data.userId,
    },
  });

  return {
    id: skill.id,
    name: skill.name,
    description: skill.description || undefined,
    url: skill.url || undefined,
    content: skill.content,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  };
};

/**
 * Get skills for a user with pagination
 */
export const getSkills = async (
  userId: string,
  page: number = 1,
  limit: number = 10
): Promise<SkillsListResponse> => {
  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  if (page < 1) {
    throw new AppError("Page must be greater than 0", 400);
  }

  if (limit < 1 || limit > 100) {
    throw new AppError("Limit must be between 1 and 100", 400);
  }

  const skip = (page - 1) * limit;

  const sharedIds = await getSharedResourceIds(userId, "SKILL");
  const where: any =
    sharedIds.length > 0 ? { OR: [{ userId }, { id: { in: sharedIds } }] } : { userId };

  const [skills, total] = await Promise.all([
    prismaClient.userSkill.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        name: true,
        description: true,
        url: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prismaClient.userSkill.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    skills: skills.map((skill: any) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description || undefined,
      url: skill.url || undefined,
      content: skill.content,
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
    })),
    total,
    page,
    limit,
    totalPages,
  };
};

/**
 * Get a single skill by ID
 */
export const getSkill = async (userId: string, skillId: string): Promise<SkillResponse> => {
  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  if (!skillId) {
    throw new AppError("Skill ID is required", 400);
  }

  let skill = await prismaClient.userSkill.findFirst({
    where: { id: skillId, userId },
  });

  if (!skill) {
    const access = await canAccessResource(userId, "SKILL", skillId);
    if (access.hasAccess) {
      skill = await prismaClient.userSkill.findUnique({ where: { id: skillId } });
    }
  }

  if (!skill) {
    throw new AppError("Skill not found", 404);
  }

  return {
    id: skill.id,
    name: skill.name,
    description: skill.description || undefined,
    url: skill.url || undefined,
    content: skill.content,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  };
};

/**
 * Update a skill
 */
export const updateSkill = async (
  userId: string,
  skillId: string,
  data: UpdateSkillData
): Promise<SkillResponse> => {
  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  if (!skillId) {
    throw new AppError("Skill ID is required", 400);
  }

  // Verify skill exists and belongs to user
  const existingSkill = await prismaClient.userSkill.findFirst({
    where: {
      id: skillId,
      userId,
    },
  });

  if (!existingSkill) {
    throw new AppError("Skill not found", 404);
  }

  // Parse metadata if content is being updated
  let name = data.name?.trim();
  let description = data.description?.trim();

  if (data.content && (!name || !description)) {
    const metadata = parseSkillMetadata(data.content);
    if (!name) {
      name = metadata.name;
    }
    if (!description) {
      description = metadata.description;
    }
  }

  // Enforce 50 character limit on description
  if (description && description.length > 50) {
    description = description.slice(0, 50);
  }

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description || null;
  if (data.url !== undefined) updateData.url = data.url?.trim() || null;
  if (data.content !== undefined) updateData.content = data.content.trim();

  const skill = await prismaClient.userSkill.update({
    where: { id: skillId },
    data: updateData,
  });

  return {
    id: skill.id,
    name: skill.name,
    description: skill.description || undefined,
    url: skill.url || undefined,
    content: skill.content,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  };
};

/**
 * Delete a skill
 */
export const deleteSkill = async (userId: string, skillId: string): Promise<void> => {
  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  if (!skillId) {
    throw new AppError("Skill ID is required", 400);
  }

  // Verify skill exists and belongs to user
  const existingSkill = await prismaClient.userSkill.findFirst({
    where: {
      id: skillId,
      userId,
    },
  });

  if (!existingSkill) {
    throw new AppError("Skill not found", 404);
  }

  await prismaClient.userSkill.delete({
    where: { id: skillId },
  });
};
