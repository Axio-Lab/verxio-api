import { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchLandingPage } from "../../_components/strapi-fetch";
import { RenderSections, SiteFooter } from "../../_components/sections";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchLandingPage(slug);
  if (!page) return { title: "Page Not Found" };

  const seo = page.seo || {};
  return {
    title: seo.metaTitle || page.title,
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

export default async function LandingPage({
  params,
}: {
  params: Promise<{ userId: string; slug: string }>;
}) {
  const { slug } = await params;
  const page = await fetchLandingPage(slug);

  if (!page) {
    notFound();
  }

  const sections = Array.isArray(page.sections) ? page.sections : [];

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <RenderSections sections={sections} />
      <SiteFooter />
    </main>
  );
}
