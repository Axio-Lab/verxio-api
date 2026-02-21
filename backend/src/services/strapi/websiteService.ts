/**
 * Website Service
 *
 * CRUD operations for multi-page websites, funnels, and blogs in Strapi.
 */

import {
  strapiRequest,
  generateSlug,
  getPublicSiteUrl,
  type SeoData,
  type SectionData,
} from "./strapiService";

export type WebsiteType = "website" | "funnel" | "blog";

export interface WebsiteInput {
  title: string;
  slug?: string;
  type?: WebsiteType;
  status?: "draft" | "published";
  navigation?: Array<{ label: string; pageSlug: string }>;
  globalStyles?: {
    brandColor?: string;
    fontFamily?: string;
    logoUrl?: string;
  };
}

export interface Website {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  userId: string;
  status: "draft" | "published";
  type: WebsiteType;
  navigation: Array<{ label: string; pageSlug: string }> | null;
  globalStyles: Record<string, unknown> | null;
  customDomain: string | null;
  domainVerified: boolean;
  pages?: SitePage[];
  blogPosts?: BlogPostSummary[];
  createdAt: string;
  updatedAt: string;
}

export type PageType =
  | "landing"
  | "about"
  | "contact"
  | "checkout"
  | "thankyou"
  | "upsell"
  | "downsell"
  | "form"
  | "blog-listing"
  | "custom";

export interface PageInput {
  title: string;
  slug?: string;
  pageType?: PageType;
  sections: SectionData[];
  seo?: SeoData;
  status?: "draft" | "published";
  order?: number;
  nextPageSlug?: string;
}

export interface SitePage {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  userId: string;
  status: "draft" | "published";
  pageType: PageType;
  sections: SectionData[];
  seo?: SeoData;
  order: number;
  nextPageSlug?: string;
  createdAt: string;
  updatedAt: string;
}

interface BlogPostSummary {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  status: "draft" | "published";
}

// ─── Website CRUD ────────────────────────────────────────────────────

export async function createWebsite(userId: string, input: WebsiteInput): Promise<Website> {
  const slug = input.slug || generateSlug(input.title);

  const result = await strapiRequest<{ data: Website }>("/websites", {
    method: "POST",
    body: JSON.stringify({
      data: {
        title: input.title,
        slug,
        userId,
        status: input.status || "draft",
        type: input.type || "website",
        navigation: input.navigation || [],
        globalStyles: input.globalStyles || {},
      },
    }),
  });

  return result.data;
}

export async function updateWebsite(
  documentId: string,
  input: Partial<WebsiteInput>
): Promise<Website> {
  const updateData: Record<string, unknown> = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.slug !== undefined) updateData.slug = input.slug;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.navigation !== undefined) updateData.navigation = input.navigation;
  if (input.globalStyles !== undefined) updateData.globalStyles = input.globalStyles;

  const result = await strapiRequest<{ data: Website }>(`/websites/${documentId}`, {
    method: "PUT",
    body: JSON.stringify({ data: updateData }),
  });

  return result.data;
}

export async function getWebsiteById(documentId: string): Promise<Website | null> {
  try {
    const result = await strapiRequest<{ data: Website }>(
      `/websites/${documentId}?populate[pages][sort]=order:asc&populate[blogPosts][sort]=createdAt:desc`
    );
    return result.data || null;
  } catch {
    return null;
  }
}

export async function getWebsiteBySlug(userId: string, slug: string): Promise<Website | null> {
  const result = await strapiRequest<{ data: Website[] }>(
    `/websites?filters[userId][$eq]=${encodeURIComponent(userId)}&filters[slug][$eq]=${encodeURIComponent(slug)}&populate[pages][sort]=order:asc&populate[blogPosts][sort]=createdAt:desc`
  );

  return result.data?.[0] || null;
}

export async function listUserWebsites(userId: string): Promise<Website[]> {
  const result = await strapiRequest<{ data: Website[] }>(
    `/websites?filters[userId][$eq]=${encodeURIComponent(userId)}&sort=updatedAt:desc&populate[pages][fields][0]=title&populate[pages][fields][1]=slug&populate[pages][fields][2]=status`
  );

  return result.data || [];
}

export async function deleteWebsite(documentId: string): Promise<void> {
  await strapiRequest(`/websites/${documentId}`, { method: "DELETE" });
}

// ─── Page CRUD (within a Website) ────────────────────────────────────

export async function addPageToWebsite(
  userId: string,
  websiteDocumentId: string,
  input: PageInput
): Promise<SitePage> {
  const slug = input.slug || generateSlug(input.title);

  const result = await strapiRequest<{ data: SitePage }>("/pages", {
    method: "POST",
    body: JSON.stringify({
      data: {
        title: input.title,
        slug,
        userId,
        status: input.status || "draft",
        pageType: input.pageType || "landing",
        sections: input.sections,
        seo: input.seo || {},
        order: input.order ?? 0,
        nextPageSlug: input.nextPageSlug || null,
        website: websiteDocumentId,
      },
    }),
  });

  return result.data;
}

export async function updateSitePage(
  documentId: string,
  input: Partial<PageInput>
): Promise<SitePage> {
  const updateData: Record<string, unknown> = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.slug !== undefined) updateData.slug = input.slug;
  if (input.pageType !== undefined) updateData.pageType = input.pageType;
  if (input.sections !== undefined) updateData.sections = input.sections;
  if (input.seo !== undefined) updateData.seo = input.seo;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.order !== undefined) updateData.order = input.order;
  if (input.nextPageSlug !== undefined) updateData.nextPageSlug = input.nextPageSlug;

  const result = await strapiRequest<{ data: SitePage }>(`/pages/${documentId}`, {
    method: "PUT",
    body: JSON.stringify({ data: updateData }),
  });

  return result.data;
}

export async function getSitePageBySlug(
  websiteDocumentId: string,
  pageSlug: string
): Promise<SitePage | null> {
  const result = await strapiRequest<{ data: SitePage[] }>(
    `/pages?filters[website][documentId][$eq]=${encodeURIComponent(websiteDocumentId)}&filters[slug][$eq]=${encodeURIComponent(pageSlug)}&populate=*`
  );

  return result.data?.[0] || null;
}

export async function listWebsitePages(websiteDocumentId: string): Promise<SitePage[]> {
  const result = await strapiRequest<{ data: SitePage[] }>(
    `/pages?filters[website][documentId][$eq]=${encodeURIComponent(websiteDocumentId)}&sort=order:asc&populate=*`
  );

  return result.data || [];
}

export async function deleteSitePage(documentId: string): Promise<void> {
  await strapiRequest(`/pages/${documentId}`, { method: "DELETE" });
}

// ─── User page count (for plan limits) ──────────────────────────────

export async function countUserPages(userId: string): Promise<number> {
  const result = await strapiRequest<{ data: unknown[]; meta: { pagination: { total: number } } }>(
    `/pages?filters[userId][$eq]=${encodeURIComponent(userId)}&pagination[pageSize]=1`
  );

  return result.meta?.pagination?.total || 0;
}

// ─── Custom domain ──────────────────────────────────────────────────

export async function setCustomDomain(documentId: string, domain: string | null): Promise<Website> {
  const result = await strapiRequest<{ data: Website }>(`/websites/${documentId}`, {
    method: "PUT",
    body: JSON.stringify({
      data: {
        customDomain: domain,
        domainVerified: false,
      },
    }),
  });

  return result.data;
}

export async function verifyCustomDomain(documentId: string): Promise<Website> {
  const result = await strapiRequest<{ data: Website }>(`/websites/${documentId}`, {
    method: "PUT",
    body: JSON.stringify({ data: { domainVerified: true } }),
  });

  return result.data;
}

export function getWebsitePublicUrl(
  userId: string,
  website: { slug: string; customDomain?: string | null; domainVerified?: boolean }
): string {
  if (website.customDomain && website.domainVerified) {
    const domain = String(website.customDomain)
      .replace(/^https?:\/\//, "")
      .split("/")[0];
    return `https://${domain}`;
  }
  return getPublicSiteUrl(userId, website.slug);
}

export { getPublicSiteUrl };
