import { Router, Request, Response, NextFunction } from "express";
import * as skillService from "../services/skillService";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { AppError } from "../middleware/errorHandler";

export const skillRouter: Router = Router();

// Apply Better Auth middleware to all skill routes
skillRouter.use(betterAuthMiddleware);

/**
 * GET /skill
 * Get skills for the authenticated user with pagination
 */
skillRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await skillService.getSkills(user.id, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /skill
 * Create a new skill
 */
skillRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { name, description, url, content } = req.body;

    // If URL is provided, fetch content
    let skillContent = content;
    let skillName = name;
    let skillDescription = description;

    if (url && !content) {
      skillContent = await skillService.fetchSkillFromUrl(url);
      // Parse metadata from fetched content
      const metadata = skillService.parseSkillMetadata(skillContent);
      if (!skillName) {
        skillName = metadata.name;
      }
      if (!skillDescription) {
        skillDescription = metadata.description;
      }
    }

    if (!skillContent || skillContent.trim() === "") {
      throw new AppError("Skill content is required. Provide either 'content' or 'url'.", 400);
    }

    if (!skillName || skillName.trim() === "") {
      throw new AppError("Skill name is required", 400);
    }

    const skill = await skillService.createSkill({
      userId: user.id,
      name: skillName,
      description: skillDescription,
      url: url || undefined,
      content: skillContent,
    });

    res.status(201).json(skill);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /skill/:id
 * Get a single skill by ID
 */
skillRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const skill = await skillService.getSkill(user.id, id);
    res.json(skill);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /skill/:id
 * Update a skill
 */
skillRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { name, description, url, content } = req.body;

    // If URL is provided and content is not, fetch content
    let skillContent = content;
    let skillName = name;
    let skillDescription = description;

    if (url && !content) {
      skillContent = await skillService.fetchSkillFromUrl(url);
      // Parse metadata from fetched content
      const metadata = skillService.parseSkillMetadata(skillContent);
      if (!skillName) {
        skillName = metadata.name;
      }
      if (!skillDescription) {
        skillDescription = metadata.description;
      }
    }

    const updateData: any = {};
    if (skillName !== undefined) updateData.name = skillName;
    if (skillDescription !== undefined) updateData.description = skillDescription;
    if (url !== undefined) updateData.url = url;
    if (skillContent !== undefined) updateData.content = skillContent;

    const skill = await skillService.updateSkill(user.id, id, updateData);
    res.json(skill);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /skill/:id
 * Delete a skill
 */
skillRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    await skillService.deleteSkill(user.id, id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
