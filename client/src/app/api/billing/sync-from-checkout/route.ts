import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * POST /api/billing/sync-from-checkout
 * Proxy to backend to sync subscription from checkout_id or customer_session_token (post-checkout fallback when webhooks don't run).
 */
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList,
    });

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const checkoutId = body.checkout_id as string | undefined;
    const token = (body.customer_session_token as string) || (body.customerSessionToken as string);

    if (!checkoutId && !token) {
      return NextResponse.json(
        { error: "checkout_id or customer_session_token is required" },
        { status: 400 }
      );
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const response = await fetch(`${apiUrl}/api/billing/sync-from-checkout`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-User-Email": session.user.email,
        Cookie: req.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        checkout_id: checkoutId || undefined,
        customer_session_token: token || undefined,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(data?.error ? { error: data.error } : { error: "Sync failed" }, {
        status: response.status,
      });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to sync subscription" }, { status: 500 });
  }
}
