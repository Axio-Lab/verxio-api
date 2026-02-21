/**
 * Strapi Landing Page Routes
 *
 * REST endpoints for managing landing pages via Strapi CMS.
 * All endpoints require Better Auth (X-User-Email from session).
 */

import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "@/middleware/betterAuth";
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
import { generateTextWithSystemPrompt } from "@/services/agent/agentService";

const router = Router();

router.use(betterAuthMiddleware);

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
    res.json({
      pages: pages.map((p) => ({ ...p, url: getPublicPageUrl(userId, p.slug) })),
    });
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
    await consumePremiumQuota(userId, QUOTA_COST.STRAPI);

    const { title, sections, seo, status } = req.body;
    const page = await updateLandingPage(req.params.id, { title, sections, seo, status });
    res.json({ page });
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

// POST /strapi/generate - AI-generate sections and SEO JSON (uses Claude Agent SDK)
router.post("/generate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.STRAPI_NODE);
    await consumePremiumQuota(userId, QUOTA_COST.AI_GENERATE);

    const { prompt, currentSections, currentSeo } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    let systemPrompt = `You are a professional landing page content generator. Create stunning, conversion-focused content that matches the user's business and audience.

**Quality rules (strict):**
- Write like a professional copywriter. No emojis in any heading, body, button label, or SEO field. No em dashes or AI-sounding filler. No generic "AI aesthetic" or purple/teal gradients; use solid, brand-appropriate styling.
- Match business branding: infer industry and audience; use punchy, benefit-led headlines and clear CTAs (e.g. "Get started", "Book a demo"). SEO metaTitle and metaDescription must be concise and keyword-aware.

**Output:**
1. "sections" - JSON array: [{"type": string, "heading"?: string, "subheading"?: string, "body"?: string, "buttons"?: [{"label": string, "url": string, "variant"?: "primary"|"secondary"|"outline"}], "items"?: [object], "media"?: [{"url": string, "alt"?: string}]}]
   Types: hero, features, cta, testimonials, pricing, faq, video, gallery, form, checkout, blog-listing
2. "seo" - JSON object: {"metaTitle": string, "metaDescription": string, "keywords": [string], "ogTitle": string, "ogDescription": string}

Output ONLY a JSON object with keys "sections" and "seo". No markdown, no explanation, no code fences.`;

    if (currentSections || currentSeo) {
      systemPrompt += `\n\nThe user has existing content. Use it as a starting point and apply their requested changes.`;
      if (currentSections) systemPrompt += `\nCurrent sections: ${currentSections}`;
      if (currentSeo) systemPrompt += `\nCurrent SEO: ${currentSeo}`;
    }

    const { text } = await generateTextWithSystemPrompt({ systemPrompt, userPrompt: prompt });

    let parsed: { sections?: any; seo?: any };
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({ error: "Failed to parse AI response" });
      }
    }

    res.json({
      sections: JSON.stringify(parsed.sections || [], null, 2),
      seo: JSON.stringify(parsed.seo || {}, null, 2),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
