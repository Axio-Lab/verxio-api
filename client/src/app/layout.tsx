import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ConditionalNavbar, ConditionalFooter } from "./app-components/ConditionalNavbar";
import { RouteGuard } from "./app-components/RouteGuard";
import Providers from "./providers";
import { Toaster } from "@/components/ui/sonner";
import { NuqsProvider } from "@/lib/nuqs-adapter";
import { Provider as JotaiProvider } from 'jotai';

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

export const metadata: Metadata = {
  title: "Verxio Deals",
  description:
    "Discover unbeatable deals, collect and trade vouchers from merchants worldwide with Verxio Deals built on the Verxio Loyalty API.",
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
                <ConditionalNavbar />
                <JotaiProvider>
                {children}
                </JotaiProvider>
                <ConditionalFooter />
              </RouteGuard>
              <Toaster />
          </NuqsProvider>
        </Providers>
      </body>
    </html>
  );
}
