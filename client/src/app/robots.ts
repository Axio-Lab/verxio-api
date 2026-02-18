import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = "https://www.verxio.xyz";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/workflows/", "/editor/", "/settings/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
