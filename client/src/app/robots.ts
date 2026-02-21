import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = "https://www.verxio.xyz";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/workflows/",
          "/connections/",
          "/credentials/",
          "/integrations/",
          "/skills/",
          "/sites/",
          "/templates/",
          "/vibe/",
          "/chat/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
