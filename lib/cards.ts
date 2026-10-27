import type { BoxMediaCard, MediaCard } from "@/lib/types";

/**
 * The catalogue speaks `BoxMediaCard`; the UI speaks `MediaCard`. One
 * conversion, one place — the home page, the browse pages and the category
 * pages all go through this.
 */
export function toMediaCard(c: BoxMediaCard): MediaCard {
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

export function toMediaCards(list: BoxMediaCard[]): MediaCard[] {
  return list.map(toMediaCard);
}
