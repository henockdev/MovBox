/**
 * MediaCard conversion helpers — turn raw TMDB shapes into our unified MediaCard
 * used by all the homepage rows + browse grids.
 */
import type {
  TMDBMovie,
  TMDBTVShow,
  TMDBPaginatedResponse,
  MediaCard,
} from "./types";

/** Convert a TMDB movie -> our unified MediaCard */
export function toMovieCard(m: TMDBMovie): MediaCard {
  return {
    id: String(m.id),
    type: "movie",
    title: m.title ?? "",
    year: (m.release_date ?? "").slice(0, 4),
    rating: m.vote_average ?? 0,
    posterPath: m.poster_path ?? null,
    backdropPath: m.backdrop_path ?? null,
    overview: m.overview ?? "",
    runtime: m.runtime ?? null,
  };
}

/** Convert a TMDB TV show -> our unified MediaCard */
export function toTVCard(t: TMDBTVShow): MediaCard {
  return {
    id: String(t.id),
    type: "tv",
    title: t.name ?? "",
    year: (t.first_air_date ?? "").slice(0, 4),
    rating: t.vote_average ?? 0,
    posterPath: t.poster_path ?? null,
    backdropPath: t.backdrop_path ?? null,
    overview: t.overview ?? "",
  };
}

/** Convert a paginated response of movies */
export function moviesToCards(
  res: TMDBPaginatedResponse<TMDBMovie> | null
): MediaCard[] {
  return (res?.results ?? []).slice(0, 12).map(toMovieCard);
}

/** Convert a paginated response of TV shows */
export function tvToCards(
  res: TMDBPaginatedResponse<TMDBTVShow> | null
): MediaCard[] {
  return (res?.results ?? []).slice(0, 12).map(toTVCard);
}

/**
 * Filter for "Award Winners" — high-rated, high-vote-count movies.
 * Used on the home page for the prestigious picks row.
 */
export function awardWinners(
  res: TMDBPaginatedResponse<TMDBMovie> | null
): MediaCard[] {
  return (res?.results ?? [])
    .filter((m) => m.vote_average >= 7.5 && m.vote_count >= 1000)
    .slice(0, 12)
    .map(toMovieCard);
}

/**
 * Get the top N most popular items from any list (sorted by popularity-like criteria).
 * Just a re-slice helper.
 */
export function top<T>(arr: T[] | undefined | null, n: number): T[] {
  return (arr ?? []).slice(0, n);
}
