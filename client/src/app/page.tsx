import { Navbar } from "./home/_components/navbar";
import { Hero } from "./home/_components/hero";
import { Features } from "./home/_components/features";
import { IntegrationsOrbit } from "./home/_components/integrations-orbit";
import { HowItWorks } from "./home/_components/how-it-works";
import { Pricing } from "./home/_components/pricing";
import { CTA } from "./home/_components/cta";
import { Footer } from "./home/_components/footer";
import type { Metadata } from "next";

const siteUrl = "https://www.verxio.xyz";

export const metadata: Metadata = {
  title: "Verxio — AI coworker platform for every team",
  description:
    "Spin up AI agents that automate workflows, build websites and funnels, manage blogs, and deploy to Slack, Discord, Telegram, and WhatsApp. 10,000+ actions. 800+ apps. One platform.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "Verxio — AI coworker platform for every team",
    description:
      "Spin up AI agents that automate workflows, build websites and funnels, manage blogs, and deploy to Slack, Discord, Telegram, and WhatsApp. 10,000+ actions. 800+ apps.",
    url: siteUrl,
    siteName: "Verxio",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${siteUrl}/logo/verxioLogoMain.svg`,
        width: 1200,
        height: 630,
        alt: "Verxio — AI coworker platform for every team",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Verxio — AI coworker platform for every team",
    description:
      "Spin up AI agents that automate workflows, build websites and funnels, manage blogs, and deploy to Slack, Discord, Telegram, and WhatsApp.",
    images: [`${siteUrl}/logo/verxioLogoMain.svg`],
  },
};

export default function Home() {
  const siteUrl = "https://www.verxio.xyz";

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Verxio",
      url: siteUrl,
      description:
        "AI coworker platform that automates workflows, builds websites and funnels, manages blogs, and deploys agents to Slack, Discord, Telegram, and WhatsApp.",
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Verxio",
      url: siteUrl,
      logo: `${siteUrl}/logo/verxioLogoMain.svg`,
      sameAs: ["https://twitter.com/verxioprotocol", "https://blog.verxio.xyz"],
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Verxio",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "9",
        highPrice: "500",
        priceCurrency: "USD",
        offerCount: "4",
      },
      description:
        "AI coworker platform that automates workflows, builds websites and funnels, manages blogs, and deploys agents to Slack, Discord, Telegram, and WhatsApp. 10,000+ actions across 800+ apps.",
      url: siteUrl,
      featureList:
        "AI Agents, Visual Workflow Builder, AI Website Builder, AI Funnel Builder, AI Blog Manager, Slack Integration, Discord Integration, Telegram Integration, WhatsApp Integration, 10000+ Actions, 800+ App Integrations, Custom Skills, Agent Personality, Custom Domains",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Verxio Blog",
      url: "https://blog.verxio.xyz",
      description:
        "Articles, guides, and insights on AI automation, workflow building, website creation, and growth strategies from the Verxio team.",
      isPartOf: {
        "@type": "WebSite",
        name: "Verxio",
        url: siteUrl,
      },
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="min-h-screen bg-white">
        <Navbar />
        <Hero />
        <Features />
        <IntegrationsOrbit />
        <HowItWorks />
        <Pricing />
        <CTA />
        <Footer />
      </div>
    </>
  );
}
