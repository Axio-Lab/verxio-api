"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { VerxioLoader } from "./VerxioLoader";

/**
 * RouteGuard - Protects all routes except auth routes
 * Redirects unauthenticated users to login page
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  // Routes that don't require authentication
  const publicRoutes = ["/login", "/signup", "/"];
  const isPublicRoute = publicRoutes.some((route) => {
    if (route === "/") {
      // Exact match for home page
      return pathname === "/";
    }
    // For other routes, check if pathname starts with the route
    return pathname?.startsWith(route);
  });

  useEffect(() => {
    // Don't redirect if we're on a public route or still loading
    if (isLoading || isPublicRoute) {
      return;
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, isPublicRoute, pathname, router]);

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

