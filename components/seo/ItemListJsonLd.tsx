import { SITE_URL } from "@/lib/constants";

/**
 * ItemList JSON-LD — a **ranked** list of titles.
 *
 * This is the structured data behind the "Top picks" / "Top 10" rich result
 * in Google, and it is the single most valuable piece of markup on a
 * rankings page: it states, in a machine-readable way, that this title is
 * number one, this one is number two, and so on.
 *
 * It is equally the piece that answers a **generative** engine. An assistant
 * asked "what are the best K-dramas on Movbox" has a ranked list with
 * explicit positions to quote — a flat grid of posters gives it nothing to
 * rank by.
 *
 * Usage:
 *   <ItemListJsonLd
 *     name="Top K-Drama on Movbox"
 *     description="..."
 *     items={[{ name: "Squid Game", url: "/tv/squid-game", image: "…" }]}
 *   />
 */
export interface ItemListEntry {
  /** The title of the ranked item. */
  name: string;
  /** Site-relative path (e.g. "/tv/squid-game") or an absolute URL. */
  url: string;
  /** Absolute or site-relative preview image. */
  image?: string | null;
}

export interface ItemListJsonLdProps {
  /** The list's own name — the heading of the ranked block. */
  name: string;
  /** One or two sentences about the list. */
  description?: string;
  /** The ranked entries, best first. */
  items: ItemListEntry[];
}

function absolute(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function ItemListJsonLd({
  name,
  description,
  items,
}: ItemListJsonLdProps) {
  const json = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    ...(description ? { description } : {}),
    numberOfItems: items.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absolute(item.url),
      ...(item.image ? { image: absolute(item.image) } : {}),
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
