/**
 * Blog Service
 *
 * CRUD operations for blog posts in Strapi.
 */

import { strapiRequest, generateSlug, type SeoData } from "./strapiService";

export interface BlogPostInput {
  title: string;
  slug?: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  author?: string;
  category?: string;
  tags?: string[];
  seo?: SeoData;
  status?: "draft" | "published";
}

export interface BlogPost {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  userId: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  author?: string;
  category?: string;
  tags?: string[];
  status: "draft" | "published";
  seo?: SeoData;
  createdAt: string;
  updatedAt: string;
}

export async function createBlogPost(
  userId: string,
  websiteDocumentId: string,
  input: BlogPostInput
): Promise<BlogPost> {
  const slug = input.slug || generateSlug(input.title);

  const result = await strapiRequest<{ data: BlogPost }>("/blog-posts", {
    method: "POST",
    body: JSON.stringify({
      data: {
        title: input.title,
        slug,
        userId,
        content: input.content,
        excerpt: input.excerpt || "",
        featuredImage: input.featuredImage || null,
        author: input.author || "",
        category: input.category || "",
        tags: input.tags || [],
        status: input.status || "draft",
        seo: input.seo || {},
        website: websiteDocumentId,
      },
    }),
  });

  return result.data;
}

export async function updateBlogPost(
  documentId: string,
  input: Partial<BlogPostInput>
): Promise<BlogPost> {
  const updateData: Record<string, unknown> = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.slug !== undefined) updateData.slug = input.slug;
  if (input.content !== undefined) updateData.content = input.content;
  if (input.excerpt !== undefined) updateData.excerpt = input.excerpt;
  if (input.featuredImage !== undefined) updateData.featuredImage = input.featuredImage;
  if (input.author !== undefined) updateData.author = input.author;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.seo !== undefined) updateData.seo = input.seo;
  if (input.status !== undefined) updateData.status = input.status;

  const result = await strapiRequest<{ data: BlogPost }>(
    `/blog-posts/${documentId}`,
    {
      method: "PUT",
      body: JSON.stringify({ data: updateData }),
    }
  );

  return result.data;
}

export async function getBlogPostBySlug(
  websiteDocumentId: string,
  postSlug: string
): Promise<BlogPost | null> {
  const result = await strapiRequest<{ data: BlogPost[] }>(
    `/blog-posts?filters[website][documentId][$eq]=${encodeURIComponent(websiteDocumentId)}&filters[slug][$eq]=${encodeURIComponent(postSlug)}&populate=*`
  );

  return result.data?.[0] || null;
}

export async function getBlogPostById(documentId: string): Promise<BlogPost | null> {
  try {
    const result = await strapiRequest<{ data: BlogPost }>(
      `/blog-posts/${documentId}?populate=*`
    );
    return result.data || null;
  } catch {
    return null;
  }
}

export async function listWebsiteBlogPosts(
  websiteDocumentId: string,
  options?: { status?: "draft" | "published"; limit?: number }
): Promise<BlogPost[]> {
  let url = `/blog-posts?filters[website][documentId][$eq]=${encodeURIComponent(websiteDocumentId)}&sort=createdAt:desc&populate=*`;

  if (options?.status) {
    url += `&filters[status][$eq]=${options.status}`;
  }
  if (options?.limit) {
    url += `&pagination[pageSize]=${options.limit}`;
  }

  const result = await strapiRequest<{ data: BlogPost[] }>(url);
  return result.data || [];
}

export async function listUserBlogPosts(userId: string): Promise<BlogPost[]> {
  const result = await strapiRequest<{ data: BlogPost[] }>(
    `/blog-posts?filters[userId][$eq]=${encodeURIComponent(userId)}&sort=createdAt:desc&populate=*`
  );

  return result.data || [];
}

export async function deleteBlogPost(documentId: string): Promise<void> {
  await strapiRequest(`/blog-posts/${documentId}`, { method: "DELETE" });
}
