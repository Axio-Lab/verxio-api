const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL || process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

function headers(): HeadersInit {
  return STRAPI_API_TOKEN ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` } : {};
}

async function strapiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${STRAPI_URL}/api${path}`, {
      headers: headers(),
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface StrapiPage {
  title: string;
  slug: string;
  userId: string;
  status: string;
  sections: any[];
  seo?: Record<string, any>;
  pageType?: string;
  order?: number;
  nextPageSlug?: string;
}

export interface StrapiWebsite {
  documentId: string;
  title: string;
  slug: string;
  userId: string;
  status: string;
  type: string;
  navigation: Array<{ label: string; pageSlug: string }> | null;
  globalStyles: Record<string, any> | null;
  pages?: StrapiPage[];
  blogPosts?: StrapiBlogPost[];
}

export interface StrapiBlogPost {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  author?: string;
  category?: string;
  tags?: string[];
  status: string;
  seo?: Record<string, any>;
  createdAt: string;
}

export async function fetchLandingPage(slug: string): Promise<StrapiPage | null> {
  const result = await strapiGet<{ data: StrapiPage[] }>(
    `/landing-pages?filters[slug][$eq]=${encodeURIComponent(slug)}&populate=*`
  );
  return result?.data?.[0] || null;
}

export async function fetchWebsite(
  userId: string,
  siteSlug: string
): Promise<StrapiWebsite | null> {
  const result = await strapiGet<{ data: StrapiWebsite[] }>(
    `/websites?filters[userId][$eq]=${encodeURIComponent(userId)}&filters[slug][$eq]=${encodeURIComponent(siteSlug)}&populate[pages][sort]=order:asc&populate[blogPosts][sort]=createdAt:desc`
  );
  return result?.data?.[0] || null;
}

export async function fetchSitePage(
  websiteDocumentId: string,
  pageSlug: string
): Promise<StrapiPage | null> {
  const result = await strapiGet<{ data: StrapiPage[] }>(
    `/pages?filters[website][documentId][$eq]=${encodeURIComponent(websiteDocumentId)}&filters[slug][$eq]=${encodeURIComponent(pageSlug)}&populate=*`
  );
  return result?.data?.[0] || null;
}

export async function fetchBlogPost(
  websiteDocumentId: string,
  postSlug: string
): Promise<StrapiBlogPost | null> {
  const result = await strapiGet<{ data: StrapiBlogPost[] }>(
    `/blog-posts?filters[website][documentId][$eq]=${encodeURIComponent(websiteDocumentId)}&filters[slug][$eq]=${encodeURIComponent(postSlug)}&populate=*`
  );
  return result?.data?.[0] || null;
}

export async function fetchWebsiteBlogPosts(websiteDocumentId: string): Promise<StrapiBlogPost[]> {
  const result = await strapiGet<{ data: StrapiBlogPost[] }>(
    `/blog-posts?filters[website][documentId][$eq]=${encodeURIComponent(websiteDocumentId)}&filters[status][$eq]=published&sort=createdAt:desc&populate=*`
  );
  return result?.data || [];
}
