import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import {
  getBoxmoviesBrowse,
  getBoxmoviesFilterOptions,
} from "@/lib/data";
import { BrowseClient } from "@/components/browse/BrowseClient";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { SponsoredRow } from "@/components/ads/SponsoredRow";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Animations â€” Movbox",
  description:
    "Anime, cartoons, and animated movies & series. Powered by boxmovies.org.",
};

export default async function AnimationsPage() {
  // Real anime from boxmovies's /animated-series h5-api. The /browse
  // endpoint with channelId=7 maps internally to upstream channelId=1006
  // (the "Anime" channel on boxmovies), so this returns the full vast
  // anime catalog â€” not the small "Anime" section from the home JSON.
  const [browse, options] = await Promise.all([
    getBoxmoviesBrowse(7, { sort: "Hottest", perPage: 28 }).catch(() => ({
      items: [],
      hasMore: false,
      nextPage: null,
      totalCount: null,
      page: 1,
      perPage: 28,
      channelId: 7 as const,
      filters: { genre: null, country: null, year: null, language: null, sort: "Hottest", page: 1, perPage: 28 },
    })),
    getBoxmoviesFilterOptions(7).catch(() => ({
      genre: [] as string[],
      country: ["All", "United States", "United Kingdom", "France", "Japan", "China", "Korea", "Other"],
      year: ["All", "2026", "2025", "2024", "2023", "2022", "2021", "2020", "2010s", "2000s", "1990s", "1980s", "Other"],
      language: [] as string[],
      sort: ["ForYou", "Hottest", "Latest", "Rating"],
    })),
  ]);

  return (
    <div className="min-h-screen pb-16 pt-16 md:pb-12 md:pt-20">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Animations", path: "/animations" },
        ]}
      />
      <div className="mx-auto w-full max-w-[1500px] px-3 sm:px-5 md:px-6">
        <header className="mb-3 flex items-center gap-2.5 sm:mb-5 sm:gap-3 md:mb-6">
          <Sparkles className="h-5 w-5 text-accent-bright sm:h-6 sm:w-6 md:h-7 md:w-7" />
          <div>
            <h1 className="font-display text-2xl font-bold text-cream sm:text-3xl md:text-4xl">
              Animations
            </h1>
            <p className="mt-0.5 text-xs text-text-secondary sm:mt-1 sm:text-sm md:text-base">
              Anime, cartoons & animated films â€” infinite scroll.
            </p>
          </div>
        </header>
      </div>

      <BrowseClient
        channelId={7}
        showGenreAndLanguage={false}
        options={options}
        initialItems={browse.items}
        initialHasMore={browse.hasMore}
        initialPage={browse.page}
        initialTotalCount={browse.totalCount}
        gridTitle="Anime & Animation"
        emptyLabel="No animations match these filters. Try widening your selection."
      />
      <SponsoredRow title="You might also like" />
    </div>
  );
}
