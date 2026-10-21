import type { Metadata } from "next";
import {
  getBoxmoviesBrowse,
  getBoxmoviesFilterOptions,
} from "@/lib/data";
import { BrowseClient } from "@/components/browse/BrowseClient";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { SponsoredRow } from "@/components/ads/SponsoredRow";

export const revalidate = 300; // 5 min â€” filter pages re-fetch on change anyway

export const metadata: Metadata = {
  title: "Movies â€” Movbox",
  description:
    "Browse movies by genre, country, year and language. Powered by boxmovies.org.",
};

export default async function MoviesPage() {
  // Fetch the first page + filter options in parallel on the server so the
  // initial render has data (no client-side empty flash).
  const [browse, options] = await Promise.all([
    getBoxmoviesBrowse(1, { sort: "Hottest", perPage: 28 }).catch(() => ({
      items: [],
      hasMore: false,
      nextPage: null,
      totalCount: null,
      page: 1,
      perPage: 28,
      channelId: 1 as const,
      filters: { genre: null, country: null, year: null, language: null, sort: "Hottest", page: 1, perPage: 28 },
    })),
    getBoxmoviesFilterOptions(1).catch(() => ({
      genre: ["All"],
      country: ["All"],
      year: ["All"],
      language: ["All"],
      sort: ["ForYou", "Hottest", "Latest", "Rating"],
    })),
  ]);

  return (
    <div className="min-h-screen pb-16 pt-16 md:pb-12 md:pt-20">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Movies", path: "/movies" },
        ]}
      />
      <div className="mx-auto w-full max-w-[1500px] px-3 sm:px-5 md:px-6">
        <header className="mb-3 sm:mb-5 md:mb-6">
          <h1 className="font-display text-2xl font-bold text-cream sm:text-3xl md:text-4xl">
            Movies
          </h1>
          <p className="mt-1 text-xs text-text-secondary sm:text-sm md:text-base">
            Hollywood, Nollywood, Bollywood, K-Drama & more â€” updated daily.
          </p>
        </header>
      </div>

      <BrowseClient
        channelId={1}
        showGenreAndLanguage
        options={options}
        initialItems={browse.items}
        initialHasMore={browse.hasMore}
        initialPage={browse.page}
        initialTotalCount={browse.totalCount}
        gridTitle="All Movies"
        emptyLabel="No movies match these filters. Try widening your selection."
      />
      <SponsoredRow title="You might also like" />
    </div>
  );
}
