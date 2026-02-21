/**
 * Blog Routes
 *
 * REST endpoints for managing blog posts within websites.
 * All routes require Better Auth (X-User-Email from session).
 */

import { Router, Request, Response, NextFunction } from "express";
import { betterAuthMiddleware } from "@/middleware/betterAuth";
import {
  createBlogPost,
  updateBlogPost,
  getBlogPostById,
  listWebsiteBlogPosts,
  listUserBlogPosts,
  deleteBlogPost,
} from "@/services/strapi/blogService";
import { isStrapiConfigured } from "@/services/strapi/strapiService";
import { checkFeatureAccess } from "@/services/subscriptionCheck";
import { SUBSCRIPTION_FEATURES } from "@/config/subscription-features";
import { consumePremiumQuota } from "@/services/subscriptionService";
import { QUOTA_COST } from "@/config/rate-limits";

const router = Router();

router.use(betterAuthMiddleware);

function ensureStrapiConfigured(_req: Request, res: Response, next: NextFunction) {
  if (!isStrapiConfigured()) {
    return res.status(503).json({ error: "Strapi CMS is not configured" });
  }
  next();
}

router.use(ensureStrapiConfigured);

// POST /blog/posts - Create a blog post
router.post("/posts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.STRAPI_NODE);
    await consumePremiumQuota(userId, QUOTA_COST.STRAPI_BLOG);

    const { websiteId, title, content, excerpt, featuredImage, author, category, tags, seo, status } = req.body;
    if (!websiteId) return res.status(400).json({ error: "websiteId is required" });
    if (!title) return res.status(400).json({ error: "title is required" });
    if (!content) return res.status(400).json({ error: "content is required" });

    const post = await createBlogPost(userId, websiteId, {
      title,
      content,
      excerpt,
      featuredImage,
      author,
      category,
      tags,
      seo,
      status,
    });

    res.json({ post });
  } catch (error) {
    next(error);
  }
});

// GET /blog/posts - List user's blog posts
router.get("/posts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { websiteId, status } = req.query as { websiteId?: string; status?: "draft" | "published" };

    let posts;
    if (websiteId) {
      posts = await listWebsiteBlogPosts(websiteId, { status });
    } else {
      posts = await listUserBlogPosts(userId);
    }

    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

// GET /blog/posts/:id - Get a blog post
router.get("/posts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const post = await getBlogPostById(req.params.id);
    if (!post) return res.status(404).json({ error: "Blog post not found" });
    res.json({ post });
  } catch (error) {
    next(error);
  }
});

// PUT /blog/posts/:id - Update a blog post
router.put("/posts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.STRAPI_NODE);
    await consumePremiumQuota(userId, QUOTA_COST.STRAPI_BLOG);

    const { title, content, excerpt, featuredImage, author, category, tags, seo, status } = req.body;
    const post = await updateBlogPost(req.params.id, {
      title,
      content,
      excerpt,
      featuredImage,
      author,
      category,
      tags,
      seo,
      status,
    });

    res.json({ post });
  } catch (error) {
    next(error);
  }
});

// DELETE /blog/posts/:id - Delete a blog post
router.delete("/posts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await checkFeatureAccess(userId, SUBSCRIPTION_FEATURES.STRAPI_NODE);
    await deleteBlogPost(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export const blogRouter = router;
