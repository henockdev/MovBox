import type { BoxRankingGroup } from "./data";
import { cleanRankingTitle } from "./data";

/**
 * The ranking shelf — the app's ranking block, on every browse screen.
 *
 * The Android app puts a ranking block on EVERY tab: a row of chips (the
 * upstream's own ranking groups — *Popular*, *K-Drama*, *TOP100*, *Anime* …)
 * over a numbered row of posters. Switching a chip swaps the ranked list.
 *
 * These are the compact shapes the shelf renders. The full group — every
 * title, in the upstream's order — lives on its own `/rankings/<group>` page.
 */

export interface RankingShelfItem {
  /** The upstream's detailPath. */
  id: string;
  type: "movie" | "tv";
  title: string;
  posterUrl: string | null;
  year: string;
  rating: number | null;
}

export interface RankingShelfGroup {
  slug: string;
  /** The chip label — the upstream's own group title, cleaned of emoji. */
  title: string;
  /** How many titles the full group holds. */
  count: number;
  /** The ranked titles shown in the shelf. */
  items: RankingShelfItem[];
}

/**
 * Which ranking groups belong on one browse screen.
 *
 * The app has a ranking block on every tab — Movie, TV, Anime — and each
 * block's chips are the upstream's own ranking groups. The web BFF publishes
 * all of them in a single `/tab-operating` list, so the screen a group
 * belongs to is decided by the group's OWN contents rather than by a
 * hand-written list that would rot:
 *
 *   - a group of series is a TV ranking
 *   - a group of films is a movie ranking
 *   - a group whose genres are animation is an anime ranking
 *
 * The upstream's own order is preserved — the groups come back in the order
 * the backend declares them, which is the order the app shows them in.
 */
export function selectRankingGroups(
  groups: BoxRankingGroup[],
  kind: "movie" | "tv" | "anime",
  limit = 10
): BoxRankingGroup[] {
  const kept: BoxRankingGroup[] = [];

  for (const g of groups) {
    if (!g.items.length) continue;

    let tv = 0;
    let movie = 0;
    let anime = 0;
    for (const item of g.items) {
      if (item.type === "tv") tv++;
      else movie++;
      const genres = String(item.genre ?? "").toLowerCase();
      if (genres.includes("animation") || genres.includes("anime")) anime++;
    }
    const total = tv + movie;
    if (!total) continue;

    if (kind === "anime") {
      // An anime shelf is a group that is mostly animation.
      if (anime / total >= 0.3) kept.push(g);
      continue;
    }
    // A TV or movie shelf is a group with a clear majority of that type.
    if (kind === "tv" && tv / total >= 0.5) kept.push(g);
    if (kind === "movie" && movie / total >= 0.5) kept.push(g);
  }

  return kept.slice(0, limit);
}

/**
 * Turn ranking groups into the compact shape the shelf renders.
 *
 * `perGroup` caps how many ranked titles the shelf shows; the full list is
 * one click away on the group's own page.
 */
export function toShelfGroups(
  groups: BoxRankingGroup[],
  perGroup = 12
): RankingShelfGroup[] {
  return groups.map((g) => ({
    slug: g.slug,
    title: cleanRankingTitle(g.title),
    count: g.items.length,
    items: g.items.slice(0, perGroup).map((item) => ({
      id: item.detailPath,
      type: item.type,
      title: item.title,
      posterUrl: item.posterUrl,
      year: item.year ? String(item.year) : "",
      rating: item.rating,
    })),
  }));
}
