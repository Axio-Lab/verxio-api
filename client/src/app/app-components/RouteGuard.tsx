"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { VerxioLoader } from "./VerxioLoader";

/**
 * RouteGuard - Protects all routes except public routes
 * - Redirects authenticated users from landing page to /workflows
 * - Redirects unauthenticated users from protected routes to landing page (/)
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, user, isEmailVerified } = useAuth();
  // Routes that don't require authentication
  const publicRoutes = [
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
  const isPublicRoute = publicRoutes.some((route) => {
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
  }, [isAuthenticated, isLoading, isPublicRoute, pathname, router, user, isEmailVerified]);

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
