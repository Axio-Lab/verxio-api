import { Router, Request, Response, NextFunction } from "express";
import * as workflowTemplateService from "../services/workflowTemplateService";
import { generateTemplateMetadataForWorkflow } from "../services/agent/agentService";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { requireFeature } from "../middleware/subscriptionAuth";
import { SUBSCRIPTION_FEATURES } from "../config/subscription-features";
import { AppError } from "../middleware/errorHandler";

export const workflowTemplateRouter: Router = Router();

workflowTemplateRouter.use(betterAuthMiddleware);

/**
 * GET /workflow-template - List templates with optional search and pagination
 * Query: search, category, page, limit
 */
workflowTemplateRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = (req.query.search as string) || undefined;
    const category = (req.query.category as string) || undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const result = await workflowTemplateService.listTemplates({ search, category, page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /workflow-template/generate-metadata - Generate template metadata from workflow via agent
 * Body: { workflowId }
 * Requires export-workflow-as-template feature.
 */
workflowTemplateRouter.post(
  "/generate-metadata",
  requireFeature(SUBSCRIPTION_FEATURES.EXPORT_WORKFLOW_AS_TEMPLATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { workflowId } = req.body;

      if (!workflowId) {
        throw new AppError("workflowId is required", 400);
      }

      const result = await generateTemplateMetadataForWorkflow(user.id, workflowId);

      if (!result.success) {
        throw new AppError(result.error || "Failed to generate metadata", 500);
      }

      res.json({
        name: result.name ?? "",
        shortDescription: result.shortDescription ?? "",
        howItWorks: result.howItWorks ?? "",
        requirements: result.requirements ?? "",
        category: result.category ?? "",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /workflow-template - Create a template from an existing workflow
 * Body: { workflowId, name, shortDescription, howItWorks, requirements?, pricing?, category, creatorUsername }
 * Requires export-workflow-as-template feature.
 */
workflowTemplateRouter.post(
  "/",
  requireFeature(SUBSCRIPTION_FEATURES.EXPORT_WORKFLOW_AS_TEMPLATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const {
        workflowId,
        name,
        shortDescription,
        howItWorks,
        requirements,
        pricing,
        category,
        creatorUsername,
      } = req.body;

      if (
        !workflowId ||
        !name ||
        !shortDescription ||
        !howItWorks ||
        !category ||
        !creatorUsername
      ) {
        throw new AppError(
          "workflowId, name, shortDescription, howItWorks, category, and creatorUsername are required",
          400
        );
      }

      const template = await workflowTemplateService.createFromWorkflow(user.id, workflowId, {
        name,
        shortDescription,
        howItWorks,
        requirements,
        pricing: pricing ?? "Free",
        category,
        creatorUsername,
      });

      res.status(201).json(template);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /workflow-template/:id - Get template detail by id
 */
workflowTemplateRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const template = await workflowTemplateService.getTemplateById(id);

    if (!template) {
      throw new AppError("Template not found", 404);
    }

    res.json(template);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /workflow-template/:id/import - Import a template as a new workflow
 * Returns { workflowId, name }. If template contains premium nodes and user lacks access, returns 403.
 */
workflowTemplateRouter.post(
  "/:id/import",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      const result = await workflowTemplateService.importTemplate(user.id, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
