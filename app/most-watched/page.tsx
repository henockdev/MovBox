import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { MediaGrid } from "@/components/media/MediaGrid";
import { getBoxmoviesHome } from "@/lib/data";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { pageSeo } from "@/lib/seo";
import { toMediaCard } from "@/lib/cards";

export const revalidate = 1800;

/**
 * How many titles this page lists.
 *
 * Ten screens of a five-wide grid on a desktop. The page used to list every
 * rated title in the home feed (~600 cards) and shipped 2.27 MB — over
 * Ahrefs' 2 MB crawl limit, which made the crawler truncate the page and
 * mis-read it.
 */
const MAX_TITLES = 120;

export const metadata: Metadata = pageSeo({
  path: "/most-watched",
  title: "Most Watched Movies & TV Shows Right Now",
  description:
    "The most-watched movies and TV shows on Movbox, counted from real viewing across the catalogue. See what everybody is watching and stream it free in HD.",
  image: "/opengraph-image",
  imageWidth: 1200,
  imageHeight: 630,
  keywords: [
    "most watched movies",
    "popular tv shows",
    "top streaming titles",
    "box office hits",
  ],
});

// The card conversion lives in lib/cards.ts — one converter for the whole
// site, so every screen carries the same fields (including the trailer
// the hover preview plays).

export default async function MostWatchedPage() {
  const home = await getBoxmoviesHome().catch(() => ({
    sections: [],
    hero: [],
    heroSlides: [],
    count: 0,
  }));
  // Sort by rating where available, fall back to hero pool
  const all = [
    ...home.hero,
    ...home.sections.flatMap((s) => s.items),
  ].filter((c) => c.rating && c.rating > 0);

  // Two things kept this page over Ahrefs' 2 MB crawl limit — 2.27 MB, the
  // only page on the site that broke it:
  //
  //   1. every card carried the title's full synopsis, and the grid card
  //      never renders it. That was ~600 unused synopses in the payload.
  //   2. the list was every rated title in the whole home feed — about 600
  //      cards, which is far past what anybody scrolls.
  //
  // The overview is dropped and the list is capped. The order is still the
  // upstream's own rating order.
  const items = [...all]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, MAX_TITLES)
    .map((c) => ({
      ...toMediaCard(c),
      // The grid card does not render the synopsis — do not ship it.
      overview: "",
    }));

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Most Watched", path: "/most-watched" },
        ]}
      />
      <header className="mb-8 flex items-center gap-3">
        <Flame className="h-7 w-7 text-accent-bright" />
        <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
          Most Watched
        </h1>
      </header>
      <p className="mb-6 text-sm text-text-secondary md:text-base">
        The titles people are binging right now.
      </p>
      <MediaGrid items={items} emptyMessage="No data right now." />
    </div>
  );
}
