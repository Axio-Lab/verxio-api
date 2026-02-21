import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";
import { NodeExecutor } from "../types";
import { strapiChannel } from "@/inngest/channels/strapi";

export const strapiExecutor: NodeExecutor = async ({
  data,
  nodeId,
  context,
  step,
  publish,
  userId,
}) => {
  const action = (data.action as string) || "create";
  const pageTitle = data.pageTitle as string | undefined;
  const websitePrompt = (data.websitePrompt as string) || "";
  const sectionsJson = data.sections as string | undefined;
  const seoJson = data.seo as string | undefined;
  const pageId = data.pageId as string | undefined;
  const websiteId = data.websiteId as string | undefined;
  const pageType = data.pageType as string | undefined;
  const blogContent = data.blogContent as string | undefined;
  const variablesKey = (data.variables as string) || "strapi";

  if (action === "create" && !pageTitle) {
    throw new NonRetriableError("STRAPI node requires 'pageTitle' for create action.");
  }
  if ((action === "update" || action === "delete") && !pageId) {
    throw new NonRetriableError(`STRAPI node requires 'pageId' for ${action} action.`);
  }
  const createWebsiteWithPrompt = action === "create-website" && websitePrompt.trim().length > 0;
  if (action === "create-website" && !createWebsiteWithPrompt) {
    throw new NonRetriableError(
      "STRAPI node create-website requires a description (prompt) of the website or funnel you want."
    );
  }
  if (action === "add-page" && (!websiteId || !pageTitle)) {
    throw new NonRetriableError("STRAPI node requires 'websiteId' and 'pageTitle' for add-page action.");
  }
  if (action === "create-blog-post" && (!websiteId || !pageTitle || !blogContent)) {
    throw new NonRetriableError("STRAPI node requires 'websiteId', 'pageTitle', and 'blogContent' for create-blog-post.");
  }

  // Premium: check subscription and consume credits (create-website-from-prompt consumes after creation)
  const { checkNodeAccess } = await import("@/services/subscriptionCheck");
  await checkNodeAccess(userId, "STRAPI");

  const { consumePremiumQuota } = await import("@/services/subscriptionService");
  const { QUOTA_COST } = await import("@/config/rate-limits");
  const isBlogAction = action.includes("blog");
  const creditCost = isBlogAction ? QUOTA_COST.STRAPI_BLOG : QUOTA_COST.STRAPI;
  const skipInitialConsume = createWebsiteWithPrompt;

  if (!skipInitialConsume) {
    try {
      await step.run(`strapi-consume-quota-${nodeId}`, async () => {
        await consumePremiumQuota(userId, creditCost);
        return { consumed: true };
      });
    } catch (quotaError) {
      await publish(strapiChannel().status({ nodeId, status: "error" }));
      const err = new NonRetriableError(
        quotaError instanceof Error
          ? quotaError.message
          : "Rate limit exceeded. Upgrade or wait for reset."
      );
      await publish(
        strapiChannel().output({
          nodeId,
          output: { ...context, error: { message: err.message } },
        })
      );
      throw err;
    }
  }

  // Compile Handlebars templates
  const compile = (template: string) => {
    try {
      return Handlebars.compile(template)(context);
    } catch {
      return template;
    }
  };

  const compiledTitle = pageTitle ? compile(pageTitle) : undefined;
  const compiledPageId = pageId ? compile(pageId) : undefined;

  let sections: any[] = [];
  if (sectionsJson) {
    try {
      sections = JSON.parse(compile(sectionsJson));
    } catch {
      sections = [];
    }
  }

  let seo: Record<string, unknown> = {};
  if (seoJson) {
    try {
      seo = JSON.parse(compile(seoJson));
    } catch {
      seo = {};
    }
  }

  await publish(strapiChannel().status({ nodeId, status: "loading" }));

  try {
    const result = await step.run(`strapi-${action}-${nodeId}`, async () => {
      const {
        createLandingPage,
        updateLandingPage,
        deletePage,
        listUserPages,
        getPublicPageUrl,
        getPublicSiteUrl,
        isStrapiConfigured,
      } = await import("@/services/strapi/strapiService");

      if (!isStrapiConfigured()) {
        throw new Error("Strapi is not configured. Set STRAPI_URL and STRAPI_API_TOKEN.");
      }

      switch (action) {
        case "create": {
          const page = await createLandingPage(userId, {
            title: compiledTitle!,
            sections,
            seo: seo as any,
            status: (data.publishStatus as "draft" | "published") || "draft",
          });
          return {
            action: "create",
            pageId: page.documentId || page.id,
            title: page.title,
            slug: page.slug,
            url: getPublicPageUrl(userId, page.slug),
            status: page.status,
          };
        }
        case "update": {
          const page = await updateLandingPage(compiledPageId!, {
            title: compiledTitle,
            sections: sections.length > 0 ? sections : undefined,
            seo: Object.keys(seo).length > 0 ? (seo as any) : undefined,
            status: (data.publishStatus as "draft" | "published") || undefined,
          });
          return {
            action: "update",
            pageId: page.documentId || page.id,
            title: page.title,
            slug: page.slug,
            url: getPublicPageUrl(userId, page.slug),
            status: page.status,
          };
        }
        case "delete": {
          await deletePage(compiledPageId!);
          return { action: "delete", pageId: compiledPageId, deleted: true };
        }
        case "list": {
          const pages = await listUserPages(userId);
          return {
            action: "list",
            pages: pages.map((p) => ({
              pageId: p.documentId || p.id,
              title: p.title,
              slug: p.slug,
              status: p.status,
              url: getPublicPageUrl(userId, p.slug),
            })),
            total: pages.length,
          };
        }
        case "create-website": {
          const compiledPrompt = compile(websitePrompt.trim());
          const { createWebsiteFromPrompt } = await import(
            "@/services/strapi/websiteFromPromptService"
          );
          const { website, pages: createdPages } = await step.run(
            `strapi-create-website-from-prompt-${nodeId}`,
            async () => createWebsiteFromPrompt(userId, compiledPrompt)
          );
          const totalCredits = 1 + createdPages.length;
          await step.run(`strapi-consume-quota-prompt-${nodeId}`, async () => {
            for (let i = 0; i < totalCredits; i++) {
              await consumePremiumQuota(userId, QUOTA_COST.STRAPI);
            }
            return { consumed: totalCredits };
          });
          return {
            action: "create-website",
            websiteId: website.documentId || website.id,
            title: website.title,
            slug: website.slug,
            type: website.type,
            url: getPublicSiteUrl(userId, website.slug),
            status: website.status,
            pagesCreated: createdPages.length,
            pageIds: createdPages.map((p) => p.documentId || p.id),
          };
        }
        case "add-page": {
          const compiledWebsiteId = websiteId ? compile(websiteId) : "";
          const { addPageToWebsite, getWebsiteById } = await import("@/services/strapi/websiteService");
          const page = await addPageToWebsite(userId, compiledWebsiteId, {
            title: compiledTitle!,
            pageType: (pageType as any) || "landing",
            sections,
            seo: seo as any,
            status: (data.publishStatus as "draft" | "published") || "draft",
          });
          const website = await getWebsiteById(compiledWebsiteId);
          return {
            action: "add-page",
            pageId: page.documentId || page.id,
            title: page.title,
            slug: page.slug,
            pageType: page.pageType,
            url: getPublicSiteUrl(userId, website?.slug || "", page.slug),
            status: page.status,
          };
        }
        case "create-blog-post": {
          const compiledWebsiteId = websiteId ? compile(websiteId) : "";
          const compiledContent = blogContent ? compile(blogContent) : "";
          const { createBlogPost } = await import("@/services/strapi/blogService");
          const post = await createBlogPost(userId, compiledWebsiteId, {
            title: compiledTitle!,
            content: compiledContent,
            seo: seo as any,
            status: (data.publishStatus as "draft" | "published") || "draft",
          });
          return {
            action: "create-blog-post",
            postId: post.documentId || post.id,
            title: post.title,
            slug: post.slug,
            status: post.status,
          };
        }
        case "update-blog-post": {
          const { updateBlogPost } = await import("@/services/strapi/blogService");
          const compiledContent = blogContent ? compile(blogContent) : undefined;
          const post = await updateBlogPost(compiledPageId!, {
            title: compiledTitle,
            content: compiledContent,
            seo: Object.keys(seo).length > 0 ? (seo as any) : undefined,
            status: (data.publishStatus as "draft" | "published") || undefined,
          });
          return {
            action: "update-blog-post",
            postId: post.documentId || post.id,
            title: post.title,
            slug: post.slug,
            status: post.status,
          };
        }
        case "delete-blog-post": {
          const { deleteBlogPost } = await import("@/services/strapi/blogService");
          await deleteBlogPost(compiledPageId!);
          return { action: "delete-blog-post", postId: compiledPageId, deleted: true };
        }
        default:
          throw new Error(`Unknown Strapi action: ${action}`);
      }
    });

    const output = { [variablesKey]: result };
    await publish(strapiChannel().status({ nodeId, status: "success" }));
    await publish(strapiChannel().output({ nodeId, output: { ...context, ...output } }));
    return { ...context, ...output };
  } catch (error: unknown) {
    await publish(strapiChannel().status({ nodeId, status: "error" }));
    const message = error instanceof Error ? error.message : "Strapi execution failed";
    const errorOutput = { [variablesKey]: { error: { message } } };
    await publish(
      strapiChannel().output({ nodeId, output: { ...context, ...errorOutput } })
    );
    throw new NonRetriableError(message);
  }
};
