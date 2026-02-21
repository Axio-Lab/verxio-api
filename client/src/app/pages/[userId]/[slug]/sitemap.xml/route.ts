import { NextResponse } from "next/server";

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL || process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";
const PAGES_URL = process.env.NEXT_PUBLIC_PAGES_URL || "https://verxio.xyz/pages";

function headers(): HeadersInit {
  return STRAPI_API_TOKEN ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` } : {};
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string; slug: string }> }
) {
  const { userId, slug } = await params;

  try {
    const siteRes = await fetch(
      `${STRAPI_URL}/api/websites?filters[userId][$eq]=${encodeURIComponent(userId)}&filters[slug][$eq]=${encodeURIComponent(slug)}&populate[pages][fields][0]=slug&populate[pages][fields][1]=updatedAt&populate[blogPosts][fields][0]=slug&populate[blogPosts][fields][1]=updatedAt`,
      { headers: headers(), next: { revalidate: 300 } }
    );

    if (!siteRes.ok) {
      return new NextResponse("Not found", { status: 404 });
    }

    const json = await siteRes.json();
    const website = json.data?.[0];
    if (!website) {
      return new NextResponse("Not found", { status: 404 });
    }

    const basePath = `${PAGES_URL}/${userId}/${slug}`;
    const pages: Array<{ slug: string; updatedAt?: string }> = website.pages || [];
    const blogPosts: Array<{ slug: string; updatedAt?: string }> = website.blogPosts || [];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    for (const page of pages) {
      xml += `  <url>\n`;
      xml += `    <loc>${basePath}/${page.slug}</loc>\n`;
      if (page.updatedAt) {
        xml += `    <lastmod>${new Date(page.updatedAt).toISOString().split("T")[0]}</lastmod>\n`;
      }
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `  </url>\n`;
    }

    for (const post of blogPosts) {
      xml += `  <url>\n`;
      xml += `    <loc>${basePath}/blog/${post.slug}</loc>\n`;
      if (post.updatedAt) {
        xml += `    <lastmod>${new Date(post.updatedAt).toISOString().split("T")[0]}</lastmod>\n`;
      }
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    return new NextResponse("Error generating sitemap", { status: 500 });
  }
}
