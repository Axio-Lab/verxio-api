/**
 * Strapi Landing Page Routes
 *
 * REST endpoints for managing landing pages via Strapi CMS.
 * All endpoints require authentication.
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  createLandingPage,
  updateLandingPage,
  getPageBySlug,
  listUserPages,
  deletePage,
  getPublicPageUrl,
  isStrapiConfigured,
} from "@/services/strapi/strapiService";
import { checkFeatureAccess } from "@/services/subscriptionCheck";
import { SUBSCRIPTION_FEATURES } from "@/config/subscription-features";
import { consumePremiumQuota } from "@/services/subscriptionService";
import { QUOTA_COST } from "@/config/rate-limits";

const router = Router();

function ensureStrapiConfigured(_req: Request, res: Response, next: NextFunction) {
  if (!isStrapiConfigured()) {
    return res.status(503).json({ error: "Strapi CMS is not configured" });
  }
  next();
}

router.use(ensureStrapiConfigured);

// POST /strapi/pages - Create a landing page
router.post("/pages", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.STRAPI_NODE);
    await consumePremiumQuota(userId, QUOTA_COST.STRAPI);

    const { title, sections, seo, status } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });

    const page = await createLandingPage(userId, { title, sections: sections || [], seo, status });
    const url = getPublicPageUrl(userId, page.slug);

    res.json({ page, url });
  } catch (error) {
    next(error);
  }
});

// GET /strapi/pages - List user's pages
router.get("/pages", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const pages = await listUserPages(userId);
    res.json({ pages });
  } catch (error) {
    next(error);
  }
});

// GET /strapi/pages/:slug - Get page by slug
router.get("/pages/:slug", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = await getPageBySlug(req.params.slug);
    if (!page) return res.status(404).json({ error: "Page not found" });
    res.json({ page });
  } catch (error) {
    next(error);
  }
});

// PUT /strapi/pages/:id - Update a page
router.put("/pages/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.STRAPI_NODE);

    const { title, sections, seo, status } = req.body;
    const page = await updateLandingPage(req.params.id, { title, sections, seo, status });
    const url = getPublicPageUrl(userId, page.slug);

    res.json({ page, url });
  } catch (error) {
    next(error);
  }
});

// DELETE /strapi/pages/:id - Delete a page
router.delete("/pages/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.STRAPI_NODE);
    await deletePage(req.params.id);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
