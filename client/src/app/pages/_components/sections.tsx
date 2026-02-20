import React from "react";

export interface SectionData {
  type: string;
  heading?: string;
  subheading?: string;
  body?: string;
  media?: Array<{ url: string; alt?: string }>;
  buttons?: Array<{ label: string; url: string; variant?: string }>;
  items?: Array<Record<string, any>>;
}

export interface NavItem {
  label: string;
  pageSlug: string;
}

export interface GlobalStyles {
  brandColor?: string;
  fontFamily?: string;
  logoUrl?: string;
}

export interface BlogPostSummary {
  title: string;
  slug: string;
  excerpt?: string;
  featuredImage?: string;
  author?: string;
  category?: string;
  createdAt: string;
}

function HeroSection({ section }: { section: SectionData }) {
  return (
    <section className="relative py-20 px-6 sm:py-28 sm:px-8 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="max-w-4xl mx-auto text-center">
        {section.heading && (
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white">
            {section.heading}
          </h1>
        )}
        {section.subheading && (
          <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {section.subheading}
          </p>
        )}
        {section.body && (
          <p className="mt-4 text-base text-gray-500 dark:text-gray-400">{section.body}</p>
        )}
        {section.buttons && section.buttons.length > 0 && (
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {section.buttons.map((btn, i) => (
              <a
                key={i}
                href={btn.url}
                className={`px-6 py-3 rounded-lg text-sm font-medium transition-colors ${
                  btn.variant === "outline"
                    ? "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    : btn.variant === "secondary"
                      ? "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                      : "bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                }`}
              >
                {btn.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FeaturesSection({ section }: { section: SectionData }) {
  return (
    <section className="py-16 px-6 sm:py-24 sm:px-8">
      <div className="max-w-6xl mx-auto">
        {section.heading && (
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">{section.heading}</h2>
        )}
        {section.subheading && (
          <p className="mt-4 text-center text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">{section.subheading}</p>
        )}
        {section.items && (
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {section.items.map((item, i) => (
              <div key={i} className="p-6 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                {(item.title as string) && (
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{item.title as string}</h3>
                )}
                {(item.description as string) && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{item.description as string}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CTASection({ section }: { section: SectionData }) {
  return (
    <section className="py-16 px-6 sm:py-24 sm:px-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto text-center">
        {section.heading && (
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{section.heading}</h2>
        )}
        {section.body && (
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">{section.body}</p>
        )}
        {section.buttons && section.buttons.length > 0 && (
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {section.buttons.map((btn, i) => (
              <a
                key={i}
                href={btn.url}
                className="px-6 py-3 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
              >
                {btn.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TestimonialsSection({ section }: { section: SectionData }) {
  return (
    <section className="py-16 px-6 sm:py-24 sm:px-8">
      <div className="max-w-6xl mx-auto">
        {section.heading && (
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">{section.heading}</h2>
        )}
        {section.items && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {section.items.map((item, i) => (
              <div key={i} className="p-6 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                {(item.quote as string) && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 italic">&ldquo;{item.quote as string}&rdquo;</p>
                )}
                <div className="mt-4">
                  {(item.name as string) && (
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name as string}</p>
                  )}
                  {(item.role as string) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.role as string}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PricingSection({ section }: { section: SectionData }) {
  return (
    <section className="py-16 px-6 sm:py-24 sm:px-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        {section.heading && (
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">{section.heading}</h2>
        )}
        {section.subheading && (
          <p className="mt-4 text-center text-gray-600 dark:text-gray-300">{section.subheading}</p>
        )}
        {section.items && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {section.items.map((plan, i) => (
              <div key={i} className="p-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 flex flex-col">
                {(plan.name as string) && (
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{plan.name as string}</h3>
                )}
                {(plan.price as string) && (
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{plan.price as string}</p>
                )}
                {(plan.description as string) && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{plan.description as string}</p>
                )}
                {Array.isArray(plan.features) && (
                  <ul className="mt-6 space-y-2 flex-1">
                    {(plan.features as string[]).map((f, j) => (
                      <li key={j} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">&#10003;</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FAQSection({ section }: { section: SectionData }) {
  return (
    <section className="py-16 px-6 sm:py-24 sm:px-8">
      <div className="max-w-3xl mx-auto">
        {section.heading && (
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">{section.heading}</h2>
        )}
        {section.items && (
          <div className="mt-12 space-y-6">
            {section.items.map((faq, i) => (
              <div key={i} className="border-b border-gray-200 dark:border-gray-800 pb-6">
                {(faq.question as string) && (
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">{faq.question as string}</h3>
                )}
                {(faq.answer as string) && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{faq.answer as string}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function VideoSection({ section }: { section: SectionData }) {
  return (
    <section className="py-16 px-6 sm:py-24 sm:px-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto text-center">
        {section.heading && (
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">{section.heading}</h2>
        )}
        {section.media?.[0]?.url && (
          <div className="aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800">
            <iframe
              src={section.media[0].url}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {section.body && (
          <p className="mt-6 text-gray-600 dark:text-gray-300">{section.body}</p>
        )}
      </div>
    </section>
  );
}

function GallerySection({ section }: { section: SectionData }) {
  return (
    <section className="py-16 px-6 sm:py-24 sm:px-8">
      <div className="max-w-6xl mx-auto">
        {section.heading && (
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-10">{section.heading}</h2>
        )}
        {section.media && section.media.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {section.media.map((img, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img
                  src={img.url}
                  alt={img.alt || ""}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FormSection({ section }: { section: SectionData }) {
  return (
    <section className="py-16 px-6 sm:py-24 sm:px-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-xl mx-auto">
        {section.heading && (
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">{section.heading}</h2>
        )}
        {section.subheading && (
          <p className="mt-4 text-center text-gray-600 dark:text-gray-300">{section.subheading}</p>
        )}
        <form className="mt-8 space-y-4" onSubmit={(e) => e.preventDefault()}>
          {section.items?.map((field, i) => (
            <div key={i}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {(field.label as string) || `Field ${i + 1}`}
              </label>
              {(field.type as string) === "textarea" ? (
                <textarea
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white"
                  rows={4}
                  placeholder={(field.placeholder as string) || ""}
                  required={!!field.required}
                />
              ) : (
                <input
                  type={(field.type as string) || "text"}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white"
                  placeholder={(field.placeholder as string) || ""}
                  required={!!field.required}
                />
              )}
            </div>
          ))}
          {section.buttons?.[0] && (
            <button
              type="submit"
              className="w-full px-6 py-3 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
            >
              {section.buttons[0].label}
            </button>
          )}
        </form>
      </div>
    </section>
  );
}

function CheckoutSection({ section }: { section: SectionData }) {
  return (
    <section className="py-16 px-6 sm:py-24 sm:px-8">
      <div className="max-w-2xl mx-auto">
        {section.heading && (
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">{section.heading}</h2>
        )}
        {section.body && (
          <p className="mt-4 text-center text-lg text-gray-600 dark:text-gray-300">{section.body}</p>
        )}
        {section.items && section.items.length > 0 && (
          <div className="mt-8 space-y-3">
            {section.items.map((bump, i) => (
              <label
                key={i}
                className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              >
                <input type="checkbox" className="mt-1 rounded border-gray-300" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{(bump.title as string) || "Add-on"}</p>
                  {(bump.description as string) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{bump.description as string}</p>
                  )}
                  {(bump.price as string) && (
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{bump.price as string}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
        {section.buttons && section.buttons.length > 0 && (
          <div className="mt-8 flex flex-col gap-3">
            {section.buttons.map((btn, i) => (
              <a
                key={i}
                href={btn.url}
                className="block w-full text-center px-6 py-4 rounded-lg text-base font-semibold bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
              >
                {btn.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function BlogListingSection({
  section,
  blogPosts,
  basePath,
}: {
  section: SectionData;
  blogPosts?: BlogPostSummary[];
  basePath?: string;
}) {
  return (
    <section className="py-16 px-6 sm:py-24 sm:px-8">
      <div className="max-w-6xl mx-auto">
        {section.heading && (
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">{section.heading}</h2>
        )}
        {section.subheading && (
          <p className="mt-4 text-center text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">{section.subheading}</p>
        )}
        {blogPosts && blogPosts.length > 0 ? (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post, i) => (
              <a
                key={i}
                href={basePath ? `${basePath}/blog/${post.slug}` : `blog/${post.slug}`}
                className="group block rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:shadow-lg transition-shadow"
              >
                {post.featuredImage && (
                  <div className="aspect-video bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <img src={post.featuredImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                )}
                <div className="p-5">
                  {post.category && (
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{post.category}</span>
                  )}
                  <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{post.excerpt}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                    {post.author && <span>{post.author}</span>}
                    {post.author && post.createdAt && <span>&middot;</span>}
                    {post.createdAt && <time>{new Date(post.createdAt).toLocaleDateString()}</time>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-12 text-center text-gray-500 dark:text-gray-400">No blog posts yet.</p>
        )}
      </div>
    </section>
  );
}

function GenericSection({ section }: { section: SectionData }) {
  return (
    <section className="py-16 px-6 sm:py-24 sm:px-8">
      <div className="max-w-4xl mx-auto text-center">
        {section.heading && (
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{section.heading}</h2>
        )}
        {section.subheading && (
          <p className="mt-4 text-gray-600 dark:text-gray-300">{section.subheading}</p>
        )}
        {section.body && (
          <div className="mt-6 text-gray-600 dark:text-gray-400 prose dark:prose-invert mx-auto">
            <p>{section.body}</p>
          </div>
        )}
      </div>
    </section>
  );
}

const sectionComponents: Record<string, React.FC<{ section: SectionData }>> = {
  hero: HeroSection,
  features: FeaturesSection,
  cta: CTASection,
  testimonials: TestimonialsSection,
  pricing: PricingSection,
  faq: FAQSection,
  video: VideoSection,
  gallery: GallerySection,
  form: FormSection,
  checkout: CheckoutSection,
};

export function SiteNavigation({
  siteTitle,
  navigation,
  globalStyles,
  basePath,
  currentSlug,
}: {
  siteTitle: string;
  navigation: NavItem[];
  globalStyles?: GlobalStyles | null;
  basePath: string;
  currentSlug?: string;
}) {
  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href={basePath} className="flex items-center gap-2">
          {globalStyles?.logoUrl && (
            <img src={globalStyles.logoUrl} alt="" className="h-7 w-auto" />
          )}
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{siteTitle}</span>
        </a>
        {navigation.length > 0 && (
          <nav className="hidden sm:flex items-center gap-6">
            {navigation.map((item) => (
              <a
                key={item.pageSlug}
                href={`${basePath}/${item.pageSlug}`}
                className={`text-sm transition-colors ${
                  currentSlug === item.pageSlug
                    ? "text-gray-900 dark:text-white font-medium"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

export function RenderSections({
  sections,
  blogPosts,
  basePath,
}: {
  sections: SectionData[];
  blogPosts?: BlogPostSummary[];
  basePath?: string;
}) {
  return (
    <>
      {sections.map((section, i) => {
        if (section.type === "blog-listing") {
          return <BlogListingSection key={i} section={section} blogPosts={blogPosts} basePath={basePath} />;
        }
        const Component = sectionComponents[section.type] || GenericSection;
        return <Component key={i} section={section} />;
      })}
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="py-8 px-6 border-t border-gray-100 dark:border-gray-800">
      <p className="text-center text-xs text-gray-400 dark:text-gray-600">
        Built with Verxio
      </p>
    </footer>
  );
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function generatePageJsonLd(opts: {
  title: string;
  description?: string;
  url: string;
  type?: string;
  image?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": opts.type === "article" ? "Article" : "WebPage",
    name: opts.title,
    description: opts.description || "",
    url: opts.url,
    ...(opts.image ? { image: opts.image } : {}),
  };
}

export function generateBlogPostJsonLd(opts: {
  title: string;
  description?: string;
  url: string;
  image?: string;
  author?: string;
  datePublished?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: opts.title,
    description: opts.description || "",
    url: opts.url,
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.author ? { author: { "@type": "Person", name: opts.author } } : {}),
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
  };
}
