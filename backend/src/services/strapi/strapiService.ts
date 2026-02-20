/**
 * Strapi Service
 *
 * Handles all communication with the Strapi CMS for landing page management.
 * Provides CRUD operations for landing pages, section management, and media uploads.
 * Exports shared utilities used by websiteService and blogService.
 */

const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

function strapiHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${STRAPI_API_TOKEN}`,
  };
}

export function isStrapiConfigured(): boolean {
  return !!STRAPI_URL && !!STRAPI_API_TOKEN;
}

export type SectionType =
  | "hero"
  | "features"
  | "cta"
  | "testimonials"
  | "pricing"
  | "faq"
  | "video"
  | "gallery"
  | "form"
  | "checkout"
  | "blog-listing";

export interface SectionData {
  type: SectionType;
  heading?: string;
  subheading?: string;
  body?: string;
  media?: Array<{ url: string; alt?: string }>;
  buttons?: Array<{ label: string; url: string; variant?: "primary" | "secondary" | "outline" }>;
  items?: Array<Record<string, unknown>>;
}

export interface SeoData {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  robots?: string;
  structuredData?: Record<string, unknown>;
}

export interface LandingPageInput {
  title: string;
  slug?: string;
  sections: SectionData[];
  seo?: SeoData;
  status?: "draft" | "published";
}

export interface LandingPage {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  userId: string;
  status: "draft" | "published";
  sections: SectionData[];
  seo?: SeoData;
  createdAt: string;
  updatedAt: string;
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function strapiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${STRAPI_URL}/api${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...strapiHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Strapi API error (${response.status}): ${errorBody || response.statusText}`
    );
  }

  return response.json();
}

export async function createLandingPage(
  userId: string,
  input: LandingPageInput
): Promise<LandingPage> {
  const slug = input.slug || generateSlug(input.title);

  const result = await strapiRequest<{ data: LandingPage }>("/landing-pages", {
    method: "POST",
    body: JSON.stringify({
      data: {
        title: input.title,
        slug,
        userId,
        status: input.status || "draft",
        sections: input.sections,
        seo: input.seo || {},
      },
    }),
  });

  return result.data;
}

export async function updateLandingPage(
  documentId: string,
  input: Partial<LandingPageInput>
): Promise<LandingPage> {
  const updateData: Record<string, unknown> = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.slug !== undefined) updateData.slug = input.slug;
  if (input.sections !== undefined) updateData.sections = input.sections;
  if (input.seo !== undefined) updateData.seo = input.seo;
  if (input.status !== undefined) updateData.status = input.status;

  const result = await strapiRequest<{ data: LandingPage }>(
    `/landing-pages/${documentId}`,
    {
      method: "PUT",
      body: JSON.stringify({ data: updateData }),
    }
  );

  return result.data;
}

export async function getPageBySlug(slug: string): Promise<LandingPage | null> {
  const result = await strapiRequest<{ data: LandingPage[] }>(
    `/landing-pages?filters[slug][$eq]=${encodeURIComponent(slug)}&populate=*`
  );

  return result.data?.[0] || null;
}

export async function getPageById(documentId: string): Promise<LandingPage | null> {
  try {
    const result = await strapiRequest<{ data: LandingPage }>(
      `/landing-pages/${documentId}?populate=*`
    );
    return result.data || null;
  } catch {
    return null;
  }
}

export async function listUserPages(userId: string): Promise<LandingPage[]> {
  const result = await strapiRequest<{ data: LandingPage[] }>(
    `/landing-pages?filters[userId][$eq]=${encodeURIComponent(userId)}&sort=updatedAt:desc&populate=*`
  );

  return result.data || [];
}

export async function deletePage(documentId: string): Promise<void> {
  await strapiRequest(`/landing-pages/${documentId}`, { method: "DELETE" });
}

export async function uploadMedia(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ id: number; url: string }> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
  formData.append("files", blob, fileName);

  const url = `${STRAPI_URL}/api/upload`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Strapi upload failed (${response.status})`);
  }

  const result = await response.json();
  const file = result[0];
  return { id: file.id, url: `${STRAPI_URL}${file.url}` };
}

export function getPublicPageUrl(userId: string, slug: string): string {
  const pagesUrl = process.env.STRAPI_PAGES_URL || `${STRAPI_URL}/pages`;
  return `${pagesUrl}/${userId}/${slug}`;
}

export function getPublicSiteUrl(userId: string, siteSlug: string, pageSlug?: string): string {
  const pagesUrl = process.env.STRAPI_PAGES_URL || `${STRAPI_URL}/pages`;
  const base = `${pagesUrl}/${userId}/${siteSlug}`;
  return pageSlug ? `${base}/${pageSlug}` : base;
}
