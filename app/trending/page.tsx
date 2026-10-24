import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { TrendingRow } from "@/components/home/TrendingRow";
import { getBoxmoviesTrending } from "@/lib/data";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { pageSeo } from "@/lib/seo";
import type { MediaCard } from "@/lib/types";

export const revalidate = 1800; // 30 min

export const metadata: Metadata = pageSeo({
  path: "/trending",
  title: "Trending",
  description: "What's hot on Movbox right now.",
});

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

export default async function TrendingPage() {
  // Pull a generous batch, slice into themed rows.
  const trend = await getBoxmoviesTrending(60).catch(() => ({ results: [] }));
  const all = (trend.results ?? []).map(toMediaCard);

  const trendingMovies = all.filter((m) => m.type === "movie").slice(0, 18);
  const trendingTV = all.filter((m) => m.type === "tv").slice(0, 18);
  const topRated = [...all]
    .filter((m) => m.rating > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 18);
  const newReleases = [...all]
    .filter((m) => m.year)
    .sort((a, b) => Number(b.year) - Number(a.year))
    .slice(0, 18);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Trending", path: "/trending" },
        ]}
      />
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <Flame className="h-8 w-8 text-accent-bright" />
          <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
            Trending
          </h1>
        </div>
        <p className="mt-2 text-sm text-text-secondary md:text-base">
          The most popular titles right now.
        </p>
      </header>

      <div className="space-y-10">
        <TrendingRow
          title="Trending Movies"
          iconName="film"
          iconClassName="text-accent-bright"
          items={trendingMovies}
          seeAllHref="/movies"
        />
        <TrendingRow
          title="Trending TV Shows"
          iconName="tv"
          iconClassName="text-vanilla"
          items={trendingTV}
          seeAllHref="/tv"
        />
        <TrendingRow
          title="Top Rated"
          iconName="flame"
          iconClassName="text-accent-bright"
          items={topRated}
        />
        <TrendingRow
          title="New Releases"
          iconName="sparkles"
          iconClassName="text-vanilla"
          items={newReleases}
        />
      </div>
    </div>
  );
}
