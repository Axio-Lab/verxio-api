import { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchWebsite, fetchBlogPost } from "../../../../_components/strapi-fetch";
import { SiteNavigation, SiteFooter, JsonLd, generateBlogPostJsonLd } from "../../../../_components/sections";

type Params = Promise<{ userId: string; slug: string; postSlug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { userId, slug, postSlug } = await params;
  const website = await fetchWebsite(userId, slug);
  if (!website) return { title: "Post Not Found" };

  const post = await fetchBlogPost(website.documentId, postSlug);
  if (!post) return { title: "Post Not Found" };

  const seo = post.seo || {};
  return {
    title: seo.metaTitle || `${post.title} | ${website.title}`,
    description: seo.metaDescription || post.excerpt || "",
    keywords: seo.keywords,
    openGraph: {
      title: seo.ogTitle || post.title,
      description: seo.ogDescription || post.excerpt || "",
      ...(post.featuredImage ? { images: [post.featuredImage] } : {}),
      type: "article",
    },
    twitter: {
      card: (seo.twitterCard as any) || "summary_large_image",
      title: seo.twitterTitle || post.title,
      description: seo.twitterDescription || post.excerpt || "",
      ...(post.featuredImage ? { images: [post.featuredImage] } : {}),
    },
    robots: seo.robots || undefined,
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { userId, slug, postSlug } = await params;
  const website = await fetchWebsite(userId, slug);
  if (!website) notFound();

  const post = await fetchBlogPost(website.documentId, postSlug);
  if (!post) notFound();

  const navigation = website.navigation || [];
  const basePath = `/pages/${userId}/${slug}`;

  const jsonLd = generateBlogPostJsonLd({
    title: post.title,
    description: post.excerpt,
    url: `${basePath}/blog/${post.slug}`,
    image: post.featuredImage,
    author: post.author,
    datePublished: post.createdAt,
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
        />
      )}

      <article className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        {post.category && (
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {post.category}
          </span>
        )}
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
          {post.title}
        </h1>
        <div className="mt-4 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          {post.author && <span>{post.author}</span>}
          {post.author && post.createdAt && <span>&middot;</span>}
          {post.createdAt && <time>{new Date(post.createdAt).toLocaleDateString()}</time>}
        </div>

        {post.featuredImage && (
          <div className="mt-8 rounded-xl overflow-hidden">
            <img src={post.featuredImage} alt={post.title} className="w-full h-auto" />
          </div>
        )}

        <div
          className="mt-10 prose prose-gray dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.tags && post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {post.tags.map((tag, i) => (
              <span
                key={i}
                className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </article>

      <SiteFooter />
    </main>
  );
}
