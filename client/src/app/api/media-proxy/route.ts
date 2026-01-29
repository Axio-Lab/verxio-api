import { NextResponse } from "next/server";

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (!target || !isValidHttpUrl(target)) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  try {
    const headers: HeadersInit = {};
    if (target.includes("ngrok")) {
      headers["ngrok-skip-browser-warning"] = "true";
    }

    const response = await fetch(target, { headers });
    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const cacheControl = response.headers.get("cache-control") || "public, max-age=60";

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Proxy error" },
      { status: 502 }
    );
  }
}
