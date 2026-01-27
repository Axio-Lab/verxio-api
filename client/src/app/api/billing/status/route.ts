import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * GET /api/billing/status
 * Proxy to backend billing status endpoint
 */
export async function GET(req: NextRequest) {
  try {
    // Get session to extract user email for backend authentication
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList,
    });

    if (!session?.user?.email) {
      return NextResponse.json({
        subscriptionStatus: null,
        subscriptionPlan: null,
        subscriptionExpiresAt: null,
        rateLimitRemaining: 0,
        rateLimitTotal: 0,
        rateLimitResetAt: null,
        features: [],
        isSubscribed: false,
        planDisplayName: "Free",
      });
    }

    // Forward request to backend with X-User-Email header
    // The backend uses betterAuthMiddleware which expects X-User-Email header
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const response = await fetch(`${apiUrl}/api/billing/status`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-User-Email": session.user.email,
        Cookie: req.headers.get("cookie") || "",
      },
    });

    if (!response.ok) {
      // If backend returns error, return default free plan
      if (response.status === 404 || response.status >= 500) {
        return NextResponse.json({
          subscriptionStatus: null,
          subscriptionPlan: null,
          subscriptionExpiresAt: null,
          rateLimitRemaining: 0,
          rateLimitTotal: 0,
          rateLimitResetAt: null,
          features: [],
          isSubscribed: false,
          planDisplayName: "Free",
        });
      }
      return NextResponse.json(
        { error: "Failed to fetch subscription status" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    // Return default free plan on error
    return NextResponse.json({
      subscriptionStatus: null,
      subscriptionPlan: null,
      subscriptionExpiresAt: null,
      rateLimitRemaining: 0,
      rateLimitTotal: 0,
      rateLimitResetAt: null,
      features: [],
      isSubscribed: false,
      planDisplayName: "Free",
    });
  }
}
