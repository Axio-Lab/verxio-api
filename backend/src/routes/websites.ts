/**
 * Website Routes
 *
 * REST endpoints for managing multi-page websites, funnels, and their pages.
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  createWebsite,
  updateWebsite,
  getWebsiteById,
  listUserWebsites,
  deleteWebsite,
  addPageToWebsite,
  updateSitePage,
  listWebsitePages,
  deleteSitePage,
  countUserPages,
  setCustomDomain,
  getPublicSiteUrl,
} from "@/services/strapi/websiteService";
import { isStrapiConfigured } from "@/services/strapi/strapiService";
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

const PAGE_LIMITS: Record<string, number> = {
  basic: 5,
  pro: Infinity,
  "beta-tester": Infinity,
  business: Infinity,
};

function getPageLimit(planType: string | null | undefined): number {
  if (!planType) return 5;
  return PAGE_LIMITS[planType] ?? 5;
}

// POST /websites - Create a website
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.STRAPI_NODE);
    await consumePremiumQuota(userId, QUOTA_COST.STRAPI);

    const { title, type, navigation, globalStyles, status } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });

    const website = await createWebsite(userId, { title, type, navigation, globalStyles, status });
    res.json({ website, url: getPublicSiteUrl(userId, website.slug) });
  } catch (error) {
    next(error);
  }
});

// GET /websites - List user's websites
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const websites = await listUserWebsites(userId);
    res.json({ websites });
  } catch (error) {
    next(error);
  }
});

// GET /websites/:id - Get a website by documentId
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const website = await getWebsiteById(req.params.id);
    if (!website) return res.status(404).json({ error: "Website not found" });
    res.json({ website });
  } catch (error) {
    next(error);
  }
});

// PUT /websites/:id - Update a website
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.STRAPI_NODE);

    const { title, type, navigation, globalStyles, status } = req.body;
    const website = await updateWebsite(req.params.id, { title, type, navigation, globalStyles, status });
    res.json({ website, url: getPublicSiteUrl(userId, website.slug) });
  } catch (error) {
    next(error);
  }
});

// DELETE /websites/:id - Delete a website
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.STRAPI_NODE);
    await deleteWebsite(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /websites/:id/pages - Add a page to a website
router.post("/:id/pages", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.STRAPI_NODE);

    const planType = (req as any).planType || null;
    const limit = getPageLimit(planType);
    const currentCount = await countUserPages(userId);
    if (currentCount >= limit) {
      return res.status(403).json({
        error: `Page limit reached (${limit}). Upgrade your plan for more pages.`,
      });
    }

    await consumePremiumQuota(userId, QUOTA_COST.STRAPI);

    const { title, pageType, sections, seo, status, order, nextPageSlug } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });

    const page = await addPageToWebsite(userId, req.params.id, {
      title,
      pageType,
      sections: sections || [],
      seo,
      status,
      order,
      nextPageSlug,
    });

    const website = await getWebsiteById(req.params.id);
    const url = getPublicSiteUrl(userId, website?.slug || "", page.slug);

    res.json({ page, url });
  } catch (error) {
    next(error);
  }
});

// GET /websites/:id/pages - List pages of a website
router.get("/:id/pages", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pages = await listWebsitePages(req.params.id);
    res.json({ pages });
  } catch (error) {
    next(error);
  }
});

// PUT /websites/pages/:pageId - Update a page
router.put("/pages/:pageId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.STRAPI_NODE);
    await consumePremiumQuota(userId, QUOTA_COST.STRAPI);

    const { title, pageType, sections, seo, status, order, nextPageSlug } = req.body;
    const page = await updateSitePage(req.params.pageId, {
      title,
      pageType,
      sections,
      seo,
      status,
      order,
      nextPageSlug,
    });

    res.json({ page });
  } catch (error) {
    next(error);
  }
});

// DELETE /websites/pages/:pageId - Delete a page
router.delete("/pages/:pageId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.STRAPI_NODE);
    await deleteSitePage(req.params.pageId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /websites/:id/domain - Set custom domain (Business plan only)
router.post("/:id/domain", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.CUSTOM_DOMAIN);

    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: "domain is required" });

    const website = await setCustomDomain(req.params.id, domain);
    res.json({
      website,
      message: `Add a CNAME record pointing ${domain} to pages.verxio.xyz, then verify.`,
    });
  } catch (error) {
    next(error);
  }
});

// POST /websites/:id/domain/verify - Verify custom domain DNS
router.post("/:id/domain/verify", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.CUSTOM_DOMAIN);

    const { getWebsiteById, verifyCustomDomain } = await import("@/services/strapi/websiteService");
    const website = await getWebsiteById(req.params.id);
    if (!website) return res.status(404).json({ error: "Website not found" });
    if (!website.customDomain) {
      return res.status(400).json({ error: "No custom domain set for this website" });
    }

    const dns = await import("dns").then((m) => m.promises);
    try {
      const records = await dns.resolveCname(website.customDomain);
      const pointsToVerxio = records.some(
        (r) => r === "pages.verxio.xyz" || r.endsWith(".verxio.xyz")
      );

      if (!pointsToVerxio) {
        return res.status(400).json({
          error: `CNAME record does not point to pages.verxio.xyz. Found: ${records.join(", ")}`,
          verified: false,
        });
      }

      const updated = await verifyCustomDomain(req.params.id);
      res.json({ website: updated, verified: true, message: "Domain verified and active." });
    } catch (dnsError: any) {
      return res.status(400).json({
        error: `DNS verification failed: ${dnsError.code === "ENODATA" || dnsError.code === "ENOTFOUND" ? "No CNAME record found" : dnsError.message}`,
        verified: false,
      });
    }
  } catch (error) {
    next(error);
  }
});

export const websiteRouter = router;
