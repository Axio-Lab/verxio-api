import { NextRequest, NextResponse } from "next/server";

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

function getFirstPartyHosts(): Set<string> {
  const hosts = new Set(DEFAULT_FIRST_PARTY_HOSTS);

  const envHosts = (process.env.NEXT_PUBLIC_FIRST_PARTY_HOSTS || "")
    .split(",")
    .map((item) => normalizeHost(item.trim()))
    .filter(Boolean);

  for (const envHost of envHosts) {
    hosts.add(envHost);
  }

  const siteHost = hostnameFromUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const pagesHost = hostnameFromUrl(process.env.NEXT_PUBLIC_PAGES_URL);
  const appHost = hostnameFromUrl(process.env.NEXT_PUBLIC_APP_URL);

  if (siteHost) hosts.add(siteHost);
  if (pagesHost) hosts.add(pagesHost);
  if (appHost) hosts.add(appHost);

  return hosts;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  const hostname = normalizeHost(request.headers.get("host") || "");
  if (!hostname) return NextResponse.next();

  const firstPartyHosts = getFirstPartyHosts();
  if (firstPartyHosts.has(hostname)) {
    return NextResponse.next();
  }

  // Non-first-party hosts: no custom domain rewrite; continue normally
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|robots\\.txt|sitemap\\.xml|favicon\\.ico).*)"],
};
