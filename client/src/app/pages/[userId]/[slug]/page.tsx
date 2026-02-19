import { Metadata } from "next";
import { notFound } from "next/navigation";

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

interface SectionData {
  type: string;
  heading?: string;
  subheading?: string;
  body?: string;
  media?: Array<{ url: string; alt?: string }>;
  buttons?: Array<{ label: string; url: string; variant?: string }>;
  items?: Array<Record<string, any>>;
}

interface PageData {
  title: string;
  slug: string;
  sections: SectionData[];
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
    keywords?: string[];
  };
}

async function fetchPage(slug: string): Promise<PageData | null> {
  try {
    const res = await fetch(
      `${STRAPI_URL}/api/landing-pages?filters[slug][$eq]=${encodeURIComponent(slug)}&populate=*`,
      {
        headers: STRAPI_API_TOKEN
          ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` }
          : {},
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.[0] || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPage(slug);
  if (!page) return { title: "Page Not Found" };
  return {
    title: page.seo?.metaTitle || page.title,
    description: page.seo?.metaDescription || "",
    keywords: page.seo?.keywords,
    openGraph: page.seo?.ogImage ? { images: [page.seo.ogImage] } : undefined,
  };
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
};

export default async function LandingPage({
  params,
}: {
  params: Promise<{ userId: string; slug: string }>;
}) {
  const { slug } = await params;
  const page = await fetchPage(slug);

  if (!page) {
    notFound();
  }

  const sections = Array.isArray(page.sections) ? page.sections : [];

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      {sections.map((section, i) => {
        const Component = sectionComponents[section.type] || GenericSection;
        return <Component key={i} section={section} />;
      })}

      <footer className="py-8 px-6 border-t border-gray-100 dark:border-gray-800">
        <p className="text-center text-xs text-gray-400 dark:text-gray-600">
          Built with Verxio
        </p>
      </footer>
    </main>
  );
}
