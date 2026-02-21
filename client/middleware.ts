import { NextRequest, NextResponse } from "next/server";

type DomainWebsite = {
  userId: string;
  slug: string;
};

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

function getDomainCandidates(hostname: string): string[] {
  if (!hostname) return [];
  if (hostname.startsWith("www.")) {
    return [hostname, hostname.replace(/^www\./, "")];
  }
  return [hostname, `www.${hostname}`];
}

async function fetchWebsiteByDomain(hostname: string): Promise<DomainWebsite | null> {
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || process.env.STRAPI_URL;
  if (!strapiUrl) return null;

  const token = process.env.STRAPI_API_TOKEN || "";
  const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;

  for (const domain of getDomainCandidates(hostname)) {
    const query = new URLSearchParams();
    query.set("filters[customDomain][$eq]", domain);
    query.set("filters[domainVerified][$eq]", "true");
    query.set("fields[0]", "userId");
    query.set("fields[1]", "slug");
    query.set("pagination[pageSize]", "1");

    try {
      const response = await fetch(`${strapiUrl}/api/websites?${query.toString()}`, {
        headers: authHeader,
        cache: "no-store",
      });

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as { data?: DomainWebsite[] };
      const website = payload?.data?.[0];

      if (website?.userId && website?.slug) {
        return website;
      }
    } catch {
      // Ignore lookup failures and let request continue normally.
    }
  }

  return null;
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

  if (pathname.startsWith("/pages/")) {
    return NextResponse.next();
  }

  const website = await fetchWebsiteByDomain(hostname);
  if (!website) {
    return NextResponse.next();
  }

  const rewritePath =
    pathname === "/"
      ? `/pages/${website.userId}/${website.slug}`
      : `/pages/${website.userId}/${website.slug}${pathname}`;

  const rewriteUrl = new URL(rewritePath, request.url);
  rewriteUrl.search = request.nextUrl.search;

  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|robots\\.txt|sitemap\\.xml|favicon\\.ico).*)"],
};
