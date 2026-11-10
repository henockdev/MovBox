import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { TrendingRow } from "@/components/home/TrendingRow";
import { HeroShowcase } from "@/components/home/HeroShowcase";
import { toHeroShowcase } from "@/lib/hero";
import { getBoxmoviesHeroBanner, getBoxmoviesTrending } from "@/lib/data";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { pageSeo } from "@/lib/seo";
import { toMediaCard } from "@/lib/cards";

export const revalidate = 1800; // 30 min

export const metadata: Metadata = pageSeo({
  path: "/trending",
  title: "Trending Movies & TV Shows This Week",
  description:
    "See what is trending on Movbox right now — the most-watched movies, the hottest new series and the latest releases. Updated every day, free in HD.",
  image: "/opengraph-image",
  imageWidth: 1200,
  imageHeight: 630,
  keywords: [
    "trending movies",
    "trending tv shows",
    "popular movies",
    "new releases",
    "top rated",
  ],
});

// The card conversion lives in lib/cards.ts — one converter for the whole
// site, so every screen carries the same fields (including the trailer
// the hover preview plays).

export default async function TrendingPage() {
  // Pull a generous batch, slice into themed rows.
  const trend = await getBoxmoviesTrending(60).catch(() => ({ results: [] }));
  const all = (trend.results ?? []).map(toMediaCard);

  // The app's Trending tab opens on a full-bleed 16:9 banner that advances on
  // its own, with the app's compact strip of the same slides directly under
  // it. Same hero as the homepage, fed by the upstream's own banner block for
  // this tab.
  const banner = await getBoxmoviesHeroBanner().catch(() => []);
  const showcase = toHeroShowcase(banner);

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
    <>
      {showcase.slides.length ? (
        <HeroShowcase
          slides={showcase.slides}
          items={showcase.items}
          headingLevel="h2"
        />
      ) : null}

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 md:px-6 lg:px-8">
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
          priorityCount={4}
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
    </>
  );
}
