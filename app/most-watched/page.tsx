import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { MediaGrid } from "@/components/media/MediaGrid";
import { getBoxmoviesHome } from "@/lib/data";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import type { MediaCard } from "@/lib/types";
import { SponsoredRow } from "@/components/ads/SponsoredRow";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Most Watched â€” Movbox",
  description: "The most-watched titles on Movbox right now.",
};

function toMediaCard(c: {
  detailPath: string;
  type: "movie" | "tv";
  title: string;
  year: number | null;
  rating: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
}): MediaCard {
  return {
    id: c.detailPath,
    type: c.type,
    title: c.title,
    year: c.year?.toString() ?? "",
    rating: c.rating ?? 0,
    posterPath: c.posterUrl,
    backdropPath: c.backdropUrl,
    overview: c.overview,
  };
}

export default async function MostWatchedPage() {
  const home = await getBoxmoviesHome().catch(() => ({ sections: [], hero: [] }));
  // Sort by rating where available, fall back to hero pool
  const all = [
    ...home.hero,
    ...home.sections.flatMap((s) => s.items),
  ].filter((c) => c.rating && c.rating > 0);
  const items = [...all]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .map(toMediaCard);

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
      <SponsoredRow title="You might also like" />
    </div>
  );
}
