import { SITE_URL } from "@/lib/constants";

/**
 * BreadcrumbList JSON-LD. Renders as a rich breadcrumb in Google
 * search results (the "Home > Movies > ..." trail under the title).
 * Boost CTR by 5-15% on browse pages.
 *
 * Usage:
 *   <BreadcrumbJsonLd items={[
 *     { name: "Home", path: "/" },
 *     { name: "Movies", path: "/movies" },
 *   ]} />
 */
export interface BreadcrumbItem {
  /** Display name (e.g. "Movies"). */
  name: string;
  /** Absolute path on the site (e.g. "/movies"). */
  path: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path.startsWith("/") ? "" : "/"}${item.path}`,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
