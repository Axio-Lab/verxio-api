"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { VerxioLoader } from "./VerxioLoader";

const DEFAULT_FIRST_PARTY_HOSTS = [
  "localhost",
  "127.0.0.1",
  "verxio.xyz",
  "www.verxio.xyz",
  "pages.verxio.xyz",
];

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, "").split(":")[0] || "";
}

function hostnameFromUrl(value?: string): string {
  if (!value) return "";
  try {
    return normalizeHost(new URL(value).hostname);
  } catch {
    return "";
  }
}

function isFirstPartyHost(hostname: string): boolean {
  if (!hostname) return true;

  const firstParty = new Set(DEFAULT_FIRST_PARTY_HOSTS);
  const customHosts = (process.env.NEXT_PUBLIC_FIRST_PARTY_HOSTS || "")
    .split(",")
    .map((item) => normalizeHost(item.trim()))
    .filter(Boolean);

  for (const host of customHosts) {
    firstParty.add(host);
  }

  const siteHost = hostnameFromUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const pagesHost = hostnameFromUrl(process.env.NEXT_PUBLIC_PAGES_URL);
  const appHost = hostnameFromUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (siteHost) firstParty.add(siteHost);
  if (pagesHost) firstParty.add(pagesHost);
  if (appHost) firstParty.add(appHost);

  return firstParty.has(normalizeHost(hostname));
}

/**
 * RouteGuard - Protects all routes except public routes
 * - Redirects authenticated users from landing page to /workflows
 * - Redirects unauthenticated users from protected routes to landing page (/)
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, user, isEmailVerified } = useAuth();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const customDomainRequest = hostname ? !isFirstPartyHost(hostname) : false;

  // Routes that don't require authentication
  const publicRoutes = [
    "/pages",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/check-email",
    "/chat", // Shareable workflow chat (no auth)
    "/privacy",
    "/terms-of-service",
    "/",
  ];
  const isPublicRoute = customDomainRequest || publicRoutes.some((route) => {
    if (route === "/") {
      // Exact match for home page
      return pathname === "/";
    }
    // For other routes, check if pathname starts with the route
    return pathname?.startsWith(route);
  });

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) {
      return;
    }

    // Public custom-domain pages should never be forced through app auth redirects.
    if (customDomainRequest) {
      return;
    }

    // Check if user has session but email is not verified
    if (user && !isEmailVerified) {
      // User is logged in but email not verified - redirect to login with message
      router.replace("/login");
      return;
    }

    // If authenticated and on landing page, redirect to workflows
    if (isAuthenticated && pathname === "/") {
      router.replace("/workflows");
      return;
    }

    // If authenticated and on other public auth routes (login, signup), redirect to workflows
    if (isAuthenticated && (pathname === "/login" || pathname === "/signup")) {
      router.replace("/workflows");
      return;
    }

    // Redirect to landing page if not authenticated and trying to access protected route
    if (!isAuthenticated && !isPublicRoute) {
      router.replace("/");
    }
  }, [customDomainRequest, isAuthenticated, isLoading, isPublicRoute, pathname, router, user, isEmailVerified]);

  // Show loader while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <VerxioLoader size="md" />
      </div>
    );
  }

  // If not authenticated and not on a public route, don't render children
  // (redirect will happen via useEffect)
  if (!isAuthenticated && !isPublicRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <VerxioLoader size="md" />
      </div>
    );
  }

  return <>{children}</>;
}
