import { Navbar } from "./home/_components/navbar";
import { Hero } from "./home/_components/hero";
import { Features } from "./home/_components/features";
import { HowItWorks } from "./home/_components/how-it-works";
import { Pricing } from "./home/_components/pricing";
import { CTA } from "./home/_components/cta";
import { Footer } from "./home/_components/footer";
import type { Metadata } from "next";

const siteUrl = "https://www.verxio.xyz";

export const metadata: Metadata = {
  title: "Verxio — AI coworker platform for every team",
  description:
    "Turn any chat channel into an automation hub. Spin up AI agents, add custom skills, and deploy to Slack, Discord, Telegram, and WhatsApp in minutes.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "Verxio — AI coworker platform for every team",
    description:
      "Turn any chat channel into an automation hub. Spin up AI agents, add custom skills, and deploy to Slack, Discord, Telegram, and WhatsApp.",
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
      "Turn any chat channel into an automation hub. Spin up AI agents, add custom skills, and deploy to Slack, Discord, Telegram, and WhatsApp.",
    images: [`${siteUrl}/logo/verxioLogoMain.svg`],
  },
};

export default function Home() {
  const siteUrl = "https://www.verxio.xyz";

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Verxio",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "9",
      priceCurrency: "USD",
    },
    description:
      "AI coworker platform that turns any chat channel into an automation hub. Deploy AI agents to Slack, Discord, Telegram, and WhatsApp.",
    url: siteUrl,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "127",
    },
  };

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
        <HowItWorks />
        <Pricing />
        <CTA />
        <Footer />
      </div>
    </>
  );
}
