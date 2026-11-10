import type { BoxRankingGroup } from "./data";
import { cleanRankingTitle } from "./data";
import type { BoxMediaCard } from "./types";

/**
 * The search screen's data model.
 *
 * Everything here is pure so the filter logic can be reasoned about (and
 * unit-tested) without a DOM or a network call.
 *
 * ## What the upstream actually supports — measured, not assumed
 *
 * `POST /subject/search` (the web BFF) honours **only** `keyword`, `page`,
 * `perPage` and `subjectType`. Measured on 2026-11-09 against the live
 * upstream with every filter key varied one at a time:
 *
 *   filters.yearMin / yearMax  → identical result set
 *   genres / genre             → identical result set
 *   country / language         → identical result set
 *   sort                       → identical result set
 *
 * `POST /subject/filter` (the browse endpoint the /movies, /tv and
 * /category pages use) *does* honour genre, country, year, language and
 * sort — but it ignores `keyword` entirely (searching for a nonsense string
 * still returns a full page of titles).
 *
 * The app's own search transport — the signed mobile BFF
 * `POST /subject-api/search/v2`, which carries the real filter block — is
 * unreachable: it answers `441 miss token` without the bearer and resets the
 * connection with it (measured 2026-11-09).
 *
 * So the catalogue tabs below are the **real** upstream filter (the upstream's
 * own `subjectType`), and the genre / year / country / rating filters are
 * applied by this app to the result set the upstream really returned. Every
 * value in a filter comes from a field on a title the upstream returned —
 * nothing is invented, and the screen says how many titles were matched.
 */

// ---------------------------------------------------------------------------
// Tabs — the upstream's own catalogue filter
// ---------------------------------------------------------------------------

export type SearchTabId = "all" | "movie" | "tv" | "short";

export interface SearchTabDef {
  id: SearchTabId;
  label: string;
  /**
   * The upstream's `subjectType`.
   *
   * VERIFIED live on 2026-10-29 against the upstream search endpoint:
   * 1 = movie, 2 = series, 5 = short TV. 0 = everything.
   */
  subjectType: number;
}

export const SEARCH_TABS: SearchTabDef[] = [
  { id: "all", label: "All", subjectType: 0 },
  { id: "movie", label: "Movie", subjectType: 1 },
  { id: "tv", label: "Series", subjectType: 2 },
  { id: "short", label: "Short TV", subjectType: 5 },
];

export function tabSubjectType(id: string | null | undefined): number {
  const found = SEARCH_TABS.find((t) => t.id === id);
  return found ? found.subjectType : 0;
}

export function tabLabel(id: string | null | undefined): string {
  const found = SEARCH_TABS.find((t) => t.id === id);
  return found ? found.label : "All";
}

// ---------------------------------------------------------------------------
// The card shape the search screen renders
// ---------------------------------------------------------------------------

export interface SearchCard {
  /** The upstream's detailPath. */
  id: string;
  type: "movie" | "tv";
  title: string;
  year: number | null;
  rating: number | null;
  posterUrl: string | null;
  /** The wide still — used for the feature card at the top of the overlay. */
  backdropUrl: string | null;
  /** The upstream's genre string, e.g. "Crime,Drama,Fantasy". */
  genre: string;
  /** The upstream's country name, e.g. "United States". */
  country: string;
}

/**
 * Narrow a catalogue card to what the search screen shows.
 *
 * The synopsis is dropped on purpose: the result row never renders it, and
 * a page of 28 synopses is tens of kilobytes of payload for nothing.
 */
export function toSearchCard(card: BoxMediaCard): SearchCard {
  return {
    id: card.detailPath,
    type: card.type,
    title: card.title,
    year: card.year,
    rating: card.rating,
    posterUrl: card.posterUrl,
    backdropUrl: card.backdropUrl,
    genre: card.genre ?? "",
    country: card.country ?? "",
  };
}

export function toSearchCards(cards: BoxMediaCard[]): SearchCard[] {
  return cards.map(toSearchCard);
}

/** The upstream stores genres as one comma-separated string. */
export function genreList(card: Pick<SearchCard, "genre">): string[] {
  return String(card.genre || "")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type SortKey = "relevance" | "latest" | "rating" | "az";

export const SEARCH_SORTS: { id: SortKey; label: string }[] = [
  { id: "relevance", label: "Best match" },
  { id: "latest", label: "Newest" },
  { id: "rating", label: "Top rated" },
  { id: "az", label: "A – Z" },
];

export const SORT_LABELS: Record<SortKey, string> = {
  relevance: "Best match",
  latest: "Newest",
  rating: "Top rated",
  az: "A – Z",
};

export interface SearchFilters {
  sort: SortKey;
  /** Any of the selected genres (OR inside the facet). */
  genres: string[];
  years: string[];
  countries: string[];
  /** 0 means "no minimum". */
  minRating: number;
}

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  sort: "relevance",
  genres: [],
  years: [],
  countries: [],
  minRating: 0,
};

export interface Facet {
  value: string;
  count: number;
}

export interface SearchFacets {
  genres: Facet[];
  years: Facet[];
  countries: Facet[];
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toFacets(map: Map<string, number>): Facet[] {
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * The filter values that are actually available for the current result set.
 *
 * A facet is only offered when the current results contain it, so the filter
 * panel never offers a value that would return nothing.
 */
export function buildFacets(cards: SearchCard[]): SearchFacets {
  const genres = new Map<string, number>();
  const years = new Map<string, number>();
  const countries = new Map<string, number>();

  for (const card of cards) {
    for (const g of genreList(card)) bump(genres, g);
    if (card.year) bump(years, String(card.year));
    if (card.country) bump(countries, card.country);
  }

  return {
    genres: toFacets(genres),
    years: toFacets(years).sort((a, b) => b.value.localeCompare(a.value)),
    countries: toFacets(countries),
  };
}

/** How many filters are narrowing the result set (the sort does not count). */
export function activeFilterCount(filters: SearchFilters): number {
  return (
    filters.genres.length +
    filters.years.length +
    filters.countries.length +
    (filters.minRating > 0 ? 1 : 0)
  );
}

export function isSameFilters(a: SearchFilters, b: SearchFilters): boolean {
  return (
    a.sort === b.sort &&
    a.minRating === b.minRating &&
    a.genres.length === b.genres.length &&
    a.years.length === b.years.length &&
    a.countries.length === b.countries.length &&
    a.genres.every((g, i) => g === b.genres[i]) &&
    a.years.every((y, i) => y === b.years[i]) &&
    a.countries.every((c, i) => c === b.countries[i])
  );
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

/**
 * Apply the filters and the sort to the result set.
 *
 * Filters combine with AND across facets and OR inside one facet, which is
 * what people expect from a filter panel: "Action **or** Comedy", and
 * "Action **and** 2024 **and** Korea".
 */
export function applySearchFilters(
  cards: SearchCard[],
  filters: SearchFilters
): SearchCard[] {
  let out = cards;

  if (filters.genres.length) {
    const wanted = new Set(filters.genres);
    out = out.filter((c) => genreList(c).some((g) => wanted.has(g)));
  }
  if (filters.years.length) {
    const wanted = new Set(filters.years);
    out = out.filter((c) => c.year != null && wanted.has(String(c.year)));
  }
  if (filters.countries.length) {
    const wanted = new Set(filters.countries);
    out = out.filter((c) => c.country && wanted.has(c.country));
  }
  if (filters.minRating > 0) {
    out = out.filter((c) => (c.rating ?? 0) >= filters.minRating);
  }

  if (filters.sort === "latest") {
    out = [...out].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  } else if (filters.sort === "rating") {
    out = [...out].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else if (filters.sort === "az") {
    out = [...out].sort((a, b) =>
      a.title.localeCompare(b.title, "en", { sensitivity: "base" })
    );
  }

  return out;
}

export { toggle as toggleFilterValue };

// ---------------------------------------------------------------------------
// The "Everyone is searching" terms and the "Top rankings" rows
// ---------------------------------------------------------------------------

/**
 * Pick the ranking group a search tab opens on.
 *
 * The app picks the ranking block by the word its title carries — *Movie*
 * for the movie tab, *Series* for the series tab — and falls back to the
 * first block of that kind. Same rule here.
 */
export function pickRankingGroup(
  groups: BoxRankingGroup[],
  kind: "movie" | "tv"
): BoxRankingGroup | null {
  if (!groups.length) return null;
  const hint = kind === "movie" ? "movie" : "series";
  const named = groups.find((g) =>
    cleanRankingTitle(g.title).toLowerCase().includes(hint)
  );
  if (named) return named;

  // Otherwise the first group whose own contents are mostly of that type.
  for (const g of groups) {
    if (!g.items.length) continue;
    let tv = 0;
    let movie = 0;
    for (const item of g.items) {
      if (item.type === "tv") tv++;
      else movie++;
    }
    const total = tv + movie;
    if (!total) continue;
    if (kind === "tv" && tv / total >= 0.5) return g;
    if (kind === "movie" && movie / total >= 0.5) return g;
  }
  return groups[0];
}

/**
 * The terms behind the app's *Everyone is searching* row.
 *
 * In the app this row is literally the titles of the ranking block — the
 * titles the whole catalogue is searching for right now.
 */
export function trendingTermsFrom(cards: SearchCard[], limit = 14): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of cards) {
    const title = c.title.trim();
    if (!title || seen.has(title)) continue;
    seen.add(title);
    out.push(title);
    if (out.length >= limit) break;
  }
  return out;
}
