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
          "/templates/",
          "/vibe/",
          "/chat/",
          "/support/",
          "/tasks/",
          "/goals/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
