import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  fetchWebsite,
  fetchSitePage,
  fetchWebsiteBlogPosts,
} from "../../../_components/strapi-fetch";
import {
  RenderSections,
  SiteNavigation,
  SiteFooter,
  JsonLd,
  generatePageJsonLd,
} from "../../../_components/sections";

type Params = Promise<{ userId: string; slug: string; pageSlug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { userId, slug, pageSlug } = await params;
  const website = await fetchWebsite(userId, slug);
  if (!website) return { title: "Page Not Found" };

  const page = await fetchSitePage(website.documentId, pageSlug);
  if (!page) return { title: "Page Not Found" };

  const seo = page.seo || {};
  return {
    title: seo.metaTitle || `${page.title} | ${website.title}`,
    description: seo.metaDescription || "",
    keywords: seo.keywords,
    openGraph: {
      title: seo.ogTitle || seo.metaTitle || page.title,
      description: seo.ogDescription || seo.metaDescription || "",
      ...(seo.ogImage ? { images: [seo.ogImage] } : {}),
      type: (seo.ogType as any) || "website",
    },
    twitter: seo.twitterCard
      ? {
          card: seo.twitterCard as any,
          title: seo.twitterTitle || seo.metaTitle || page.title,
          description: seo.twitterDescription || seo.metaDescription || "",
          ...(seo.twitterImage ? { images: [seo.twitterImage] } : {}),
        }
      : undefined,
    robots: seo.robots || undefined,
    alternates: seo.canonicalUrl ? { canonical: seo.canonicalUrl } : undefined,
  };
}

export default async function WebsitePage({ params }: { params: Params }) {
  const { userId, slug, pageSlug } = await params;
  const website = await fetchWebsite(userId, slug);
  if (!website) notFound();

  const page = await fetchSitePage(website.documentId, pageSlug);
  if (!page) notFound();

  const sections = Array.isArray(page.sections) ? page.sections : [];
  const navigation = website.navigation || [];
  const basePath = `/pages/${userId}/${slug}`;

  const hasBlogListing = sections.some((s) => s.type === "blog-listing");
  const blogPosts = hasBlogListing ? await fetchWebsiteBlogPosts(website.documentId) : undefined;

  const seo = page.seo || {};
  const jsonLd = generatePageJsonLd({
    title: seo.metaTitle || page.title,
    description: seo.metaDescription,
    url: `${basePath}/${pageSlug}`,
    image: seo.ogImage,
  });

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <JsonLd data={jsonLd} />
      {navigation.length > 0 && (
        <SiteNavigation
          siteTitle={website.title}
          navigation={navigation}
          globalStyles={website.globalStyles}
          basePath={basePath}
          currentSlug={pageSlug}
        />
      )}
      <RenderSections sections={sections} blogPosts={blogPosts} basePath={basePath} />
      <SiteFooter />
    </main>
  );
}
