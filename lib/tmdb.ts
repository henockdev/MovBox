/**
 * TMDB API client.
 *
 * Server-side fetch with Next.js fetch cache. All callers live in
 * Server Components or Route Handlers, so we never expose the API key.
 *
 * Image URLs (for use in <Image>):
 *   backdrop  https://image.tmdb.org/t/p/original{backdrop_path}
 *   poster    https://image.tmdb.org/t/p/w500{poster_path}
 *   logo      https://image.tmdb.org/t/p/w300{logo_path}
 */

import type {
  TMDBMovie,
  TMDBTVShow,
  TMDBPaginatedResponse,
  TMDBCastMember,
  TMDBCrewMember,
  TMDBVideo,
  TMDBEpisode,
  TMDBSeason,
} from "./types";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  // We don't throw here so the app can boot without TMDB in dev.
  // Individual fetches will fail loudly if the key is missing.
  console.warn(
    "[tmdb] TMDB_API_KEY is not set — TMDB fetches will fail at request time"
  );
}

class TMDBError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "TMDBError";
    this.status = status;
  }
}

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | boolean> = {}
): Promise<T> {
  if (!TMDB_API_KEY) {
    throw new TMDBError("TMDB_API_KEY is not configured", 500);
  }
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    // Cache aggressively. TMDB data changes at most a few times per day.
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new TMDBError(
      `TMDB ${path} -> ${res.status} ${res.statusText}`,
      res.status
    );
  }
  return res.json() as Promise<T>;
}

// =========================================================================
// Movies
// =========================================================================

export const getNowPlayingMovies = (page = 1) =>
  tmdbFetch<TMDBPaginatedResponse<TMDBMovie>>("/movie/now_playing", { page });

export const getPopularMovies = (page = 1) =>
  tmdbFetch<TMDBPaginatedResponse<TMDBMovie>>("/movie/popular", { page });

export const getTopRatedMovies = (page = 1) =>
  tmdbFetch<TMDBPaginatedResponse<TMDBMovie>>("/movie/top_rated", { page });

export const getUpcomingMovies = (page = 1) =>
  tmdbFetch<TMDBPaginatedResponse<TMDBMovie>>("/movie/upcoming", { page });

export const getTrendingMovies = (timeWindow: "day" | "week" = "week") =>
  tmdbFetch<TMDBPaginatedResponse<TMDBMovie>>(`/trending/movie/${timeWindow}`);

export const getMovieById = (id: number | string) =>
  tmdbFetch<TMDBMovie>(`/movie/${id}`, {
    append_to_response: "credits,videos,images,external_ids,release_dates",
  });

export const getMoviesByGenre = (genreId: number, page = 1) =>
  tmdbFetch<TMDBPaginatedResponse<TMDBMovie>>("/discover/movie", {
    with_genres: genreId,
    page,
    sort_by: "popularity.desc",
  });

export const discoverMovies = (params: {
  sort_by?: string;
  with_genres?: string;
  primary_release_year?: string;
  page?: number;
} = {}) => {
  const query: Record<string, string | number | boolean> = {
    sort_by: params.sort_by ?? "popularity.desc",
    page: params.page ?? 1,
    include_adult: false,
    "vote_count.gte": 10,
  };
  if (params.with_genres) query.with_genres = params.with_genres;
  if (params.primary_release_year)
    query.primary_release_year = params.primary_release_year;
  return tmdbFetch<TMDBPaginatedResponse<TMDBMovie>>("/discover/movie", query);
};

export const discoverTV = (params: {
  sort_by?: string;
  with_genres?: string;
  first_air_date_year?: string;
  page?: number;
} = {}) => {
  const query: Record<string, string | number> = {
    sort_by: params.sort_by ?? "popularity.desc",
    page: params.page ?? 1,
    "vote_count.gte": 10,
  };
  if (params.with_genres) query.with_genres = params.with_genres;
  if (params.first_air_date_year)
    query.first_air_date_year = params.first_air_date_year;
  return tmdbFetch<TMDBPaginatedResponse<TMDBTVShow>>("/discover/tv", query);
};

export const searchMovies = (query: string, page = 1) =>
  tmdbFetch<TMDBPaginatedResponse<TMDBMovie>>("/search/movie", {
    query,
    page,
    include_adult: false,
  });

// =========================================================================
// TV
// =========================================================================

export const getPopularTV = (page = 1) =>
  tmdbFetch<TMDBPaginatedResponse<TMDBTVShow>>("/tv/popular", { page });

export const getTopRatedTV = (page = 1) =>
  tmdbFetch<TMDBPaginatedResponse<TMDBTVShow>>("/tv/top_rated", { page });

export const getOnTheAirTV = (page = 1) =>
  tmdbFetch<TMDBPaginatedResponse<TMDBTVShow>>("/tv/on_the_air", { page });

export const getAiringTodayTV = (page = 1) =>
  tmdbFetch<TMDBPaginatedResponse<TMDBTVShow>>("/tv/airing_today", { page });

export const getTrendingTV = (timeWindow: "day" | "week" = "week") =>
  tmdbFetch<TMDBPaginatedResponse<TMDBTVShow>>(`/trending/tv/${timeWindow}`);

export const getTVById = (id: number | string) =>
  tmdbFetch<TMDBTVShow>(`/tv/${id}`, {
    append_to_response: "credits,videos,images,external_ids,content_ratings",
  });

export const getTVSeason = (tvId: number | string, seasonNumber: number) =>
  tmdbFetch<TMDBSeason & { episodes: TMDBEpisode[] }>(
    `/tv/${tvId}/season/${seasonNumber}`
  );

export const searchTV = (query: string, page = 1) =>
  tmdbFetch<TMDBPaginatedResponse<TMDBTVShow>>("/search/tv", {
    query,
    page,
    include_adult: false,
  });

// =========================================================================
// Details & Related
// =========================================================================

export const getMovieReviews = (id: number | string, page = 1) =>
  tmdbFetch<{
    page: number;
    results: Array<{
      id: string;
      author: string;
      author_details: { name: string; username: string; avatar_path: string | null; rating: number | null };
      content: string;
      created_at: string;
      url: string;
    }>;
    total_pages: number;
    total_results: number;
  }>(`/movie/${id}/reviews`, { page });

export const getSimilarMovies = (id: number | string, page = 1) =>
  tmdbFetch<TMDBPaginatedResponse<TMDBMovie>>(`/movie/${id}/similar`, { page });

export const getSimilarTV = (id: number | string, page = 1) =>
  tmdbFetch<TMDBPaginatedResponse<TMDBTVShow>>(`/tv/${id}/similar`, { page });

export const getTVReviews = (id: number | string, page = 1) =>
  tmdbFetch<{
    page: number;
    results: Array<{
      id: string;
      author: string;
      author_details: { name: string; username: string; avatar_path: string | null; rating: number | null };
      content: string;
      created_at: string;
      url: string;
    }>;
    total_pages: number;
    total_results: number;
  }>(`/tv/${id}/reviews`, { page });

// =========================================================================
// Genres
// =========================================================================

export const getMovieGenres = () =>
  tmdbFetch<{ genres: { id: number; name: string }[] }>("/genre/movie/list");

export const getTVGenres = () =>
  tmdbFetch<{ genres: { id: number; name: string }[] }>("/genre/tv/list");

// =========================================================================
// Helpers
// =========================================================================

/** Build a TMDB image URL. Returns null if path is missing. */
export function tmdbImage(
  path: string | null | undefined,
  size: keyof typeof TMDB_IMAGE_SIZES = "w500"
): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${TMDB_IMAGE_SIZES[size]}${path}`;
}

export const TMDB_IMAGE_SIZES = {
  // Posters
  w92: "w92",
  w154: "w154",
  w185: "w185",
  w342: "w342",
  w500: "w500",
  w780: "w780",
  original: "original",
  // Backdrops
  w300: "w300",
  w1280: "w1280",
} as const;

export type TMDBImageSize = keyof typeof TMDB_IMAGE_SIZES;

export type { TMDBCastMember, TMDBCrewMember, TMDBVideo, TMDBEpisode };
