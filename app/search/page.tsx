import type { Metadata } from "next";
import { SearchExperience } from "@/components/search/SearchExperience";
import { pageSeo } from "@/lib/seo";
import { getBoxmoviesRankings } from "@/lib/data";
import {
  pickRankingGroup,
  toSearchCards,
  trendingTermsFrom,
  type SearchCard,
  type SearchTabId,
} from "@/lib/search";

export const metadata: Metadata = pageSeo({
  path: "/search",
  title: "Search",
  description:
    "Search every movie, series and short TV title in the Movbox catalogue, filter by genre, year, country and rating, and watch it free in HD.",
  noindex: true,
});

export const revalidate = 1800; // 30 min

interface SearchPageProps {
  searchParams: Promise<{ q?: string; tab?: string }>;
}

/**
 * The app's search screen, on the web.
 *
 * The screen opens on the catalogue's own ranking — the same way the app
 * does, so nobody has to type before there is something to look at — and the
 * *Everyone is searching* row carries the titles of that ranking, which is
 * exactly where the app takes its trending terms from.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const tabParam = (params.tab ?? "all").toLowerCase();
  const tab: SearchTabId = (
    ["all", "movie", "tv", "short"] as SearchTabId[]
  ).includes(tabParam as SearchTabId)
    ? (tabParam as SearchTabId)
    : "all";

  // The ranking groups the app's own search screen opens on. One upstream
  // call feeds every tab.
  const groups = await getBoxmoviesRankings().catch(() => []);
  const movieGroup = pickRankingGroup(groups, "movie");
  const tvGroup = pickRankingGroup(groups, "tv");
  const shortGroup =
    groups.find((g) => g.title.toLowerCase().includes("short")) ?? tvGroup;
  const allGroup = groups[0] ?? movieGroup ?? tvGroup;

  const rankedByTab: Record<SearchTabId, SearchCard[]> = {
    all: toSearchCards(allGroup?.items ?? []).slice(0, 20),
    movie: toSearchCards(movieGroup?.items ?? []).slice(0, 20),
    tv: toSearchCards(tvGroup?.items ?? []).slice(0, 20),
    short: toSearchCards(shortGroup?.items ?? []).slice(0, 20),
  };

  const trendingByTab: Record<string, string[]> = {
    all: trendingTermsFrom(rankedByTab.all),
    movie: trendingTermsFrom(rankedByTab.movie),
    tv: trendingTermsFrom(rankedByTab.tv),
    short: trendingTermsFrom(rankedByTab.short),
  };

  return (
    <div className="pt-24 md:pt-28">
      <div className="mx-auto w-full max-w-4xl px-4 md:px-6">
        <h1 className="sr-only">Search movies and series</h1>
        <SearchExperience
          initialQuery={q}
          initialTab={tab}
          trending={trendingByTab}
          ranked={rankedByTab}
        />
      </div>
    </div>
  );
}
