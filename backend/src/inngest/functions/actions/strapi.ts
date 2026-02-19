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
  const sectionsJson = data.sections as string | undefined;
  const seoJson = data.seo as string | undefined;
  const pageId = data.pageId as string | undefined;
  const variablesKey = (data.variables as string) || "strapi";

  if (action === "create" && !pageTitle) {
    throw new NonRetriableError("STRAPI node requires 'pageTitle' for create action.");
  }
  if ((action === "update" || action === "delete") && !pageId) {
    throw new NonRetriableError(`STRAPI node requires 'pageId' for ${action} action.`);
  }

  // Premium: check subscription and consume credits
  const { checkNodeAccess } = await import("@/services/subscriptionCheck");
  await checkNodeAccess(userId, "STRAPI");

  const { consumePremiumQuota } = await import("@/services/subscriptionService");
  const { QUOTA_COST } = await import("@/config/rate-limits");
  try {
    await step.run(`strapi-consume-quota-${nodeId}`, async () => {
      await consumePremiumQuota(userId, QUOTA_COST.STRAPI);
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
        getPublicPageUrl,
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
