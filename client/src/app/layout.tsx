import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
// import { ConditionalNavbar, ConditionalFooter } from "./app-components/ConditionalNavbar";
import { RouteGuard } from "./app-components/RouteGuard";
import Providers from "./providers";
import { Toaster } from "@/components/ui/sonner";
import { NuqsProvider } from "@/lib/nuqs-adapter";
import { Provider as JotaiProvider } from "jotai";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://verxio.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Verxio — AI coworker platform for every team",
    template: "%s | Verxio",
  },
  description:
    "Verxio is an AI platform that turns any chat channel into an automation hub. Spin up AI agents, add custom skills, and deploy to Slack, Discord, Telegram, and WhatsApp in minutes.",
  keywords: [
    "AI agents",
    "chat automation",
    "Slack bot",
    "Discord bot",
    "Telegram bot",
    "WhatsApp bot",
    "workflow automation",
    "AI coworker",
    "chat integration",
    "automation platform",
    "AI assistant",
    "AI skills",
  ],
  authors: [{ name: "Verxio" }],
  creator: "Verxio",
  publisher: "Verxio",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Verxio",
    title: "Verxio — AI coworker platform for every team",
    description:
      "Turn any chat channel into an automation hub. Spin up AI agents, add custom skills, and deploy to Slack, Discord, Telegram, and WhatsApp.",
    images: [
      {
        url: `${siteUrl}/logo/verxioLogoMain.svg`,
        width: 1200,
        height: 630,
        alt: "Verxio — AI coworker platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Verxio — AI coworker platform for every team",
    description:
      "Turn any chat channel into an automation hub. Spin up AI agents, add custom skills, and deploy to Slack, Discord, Telegram, and WhatsApp.",
    images: [`${siteUrl}/logo/verxioLogoMain.svg`],
    creator: "@verxioprotocol",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [
      { url: "/logo/verxioIcon.svg", type: "image/svg+xml" },
      { url: "/logo/verxioIcon.svg", type: "image/svg+xml", sizes: "any" },
    ],
    apple: [{ url: "/logo/verxioIcon.svg", type: "image/svg+xml" }],
    shortcut: "/logo/verxioIcon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          <NuqsProvider>
            <RouteGuard>
              {/* <ConditionalNavbar /> */}
              <JotaiProvider>{children}</JotaiProvider>
              {/* <ConditionalFooter /> */}
            </RouteGuard>
            <Toaster />
          </NuqsProvider>
        </Providers>
      </body>
    </html>
  );
}
