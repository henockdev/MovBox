import type { BoxMediaCard, MediaCard } from "@/lib/types";

/**
 * The catalogue speaks `BoxMediaCard`; the UI speaks `MediaCard`. One
 * conversion, one place — the home page, the browse pages and the category
 * pages all go through this.
 *
 * ## The trailer rides along
 *
 * `BoxMediaCard.trailerUrl` is the title's OWN trailer — a per-title MP4 the
 * upstream publishes on every list response. Carrying it on the card is
 * what lets the hover popup (and the mobile sheet) play a preview without
 * a single extra upstream call.
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
    trailerUrl: c.trailerUrl ?? null,
    trailerPosterUrl: c.trailerPosterUrl ?? null,
    country: c.country || null,
    genres: c.genre
      ? c.genre
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean)
      : [],
  };
}

export function toMediaCards(list: BoxMediaCard[]): MediaCard[] {
  return list.map(toMediaCard);
}
