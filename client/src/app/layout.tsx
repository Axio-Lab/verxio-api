import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ConditionalNavbar, ConditionalFooter } from "./app-components/ConditionalNavbar";
import { RouteGuard } from "./app-components/RouteGuard";
import Providers from "./providers";
import { DealProvider } from "./context/DealContext";
import { Toaster } from "@/components/ui/sonner";
import { NuqsProvider } from "@/lib/nuqs-adapter";

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
            <DealProvider>
              <RouteGuard>
                <ConditionalNavbar />
                {children}
                <ConditionalFooter />
              </RouteGuard>
              <Toaster />
            </DealProvider>
          </NuqsProvider>
        </Providers>
      </body>
    </html>
  );
}
