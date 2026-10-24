import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /api/ and /admin/ are not content. The account and search
        // routes are deliberately NOT disallowed: they carry a `noindex`
        // directive on the page itself, and a crawler has to be able to
        // fetch a URL to read that directive.
        disallow: ["/api/", "/admin/"],
      },
    ],
    // The index points at both child sitemaps. Listing it here as well
    // means a crawler that only reads robots.txt still discovers the
    // sitemap set.
    sitemap: [`${SITE_URL}/sitemap-index.xml`, `${SITE_URL}/sitemap.xml`],
  };
}
