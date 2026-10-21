/**
 * Type adapters — convert between boxmovies and app-level types so we
 * don't have to keep transforming the same shape in every view.
 */
import type { BoxMediaCard, MediaCard } from "./types";

/** boxmovies `BoxMediaCard` → app `MediaCard` (for MovieCard / hero cards). */
export function toMediaCard(m: BoxMediaCard): MediaCard {
  return {
    id: m.detailPath,
    type: m.type,
    title: m.title,
    year: m.year != null ? String(m.year) : "",
    rating: m.rating ?? 0,
    posterPath: m.posterUrl,
    backdropPath: m.backdropUrl,
    overview: m.overview,
  };
}
