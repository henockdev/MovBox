/**
 * Shared TypeScript types used across the Movbox frontend.
 * Mirrors the boxmovies-api data shapes (boxmovies.org is the single
 * source of truth for everything — no TMDB, no CinePro, no Oracle).
 */

// =========================================================================
// Boxmovies types — all metadata + streams come from boxmovies-api
// =========================================================================

/** A single playable source (always MP4 from boxmovies). */
export interface BoxSource {
  id?: string;
  url: string;
  type: "mp4";
  quality: string; // "1080p"
  resolution?: number;
  sizeBytes?: number;
  durationSeconds?: number;
  format?: string;
  codec?: string;
  vipLocked?: boolean;
  /** Subtitle tracks attached to this specific source. */
  subtitles?: BoxCaption[];
  /**
   * Which backend resolved this source.
   *
   * "onstream" — the OnStream (aoneroom) mobile BFF, resolved by our own
   *   server. "boxmovies" — the thin relay, the fallback path.
   */
  provider: { id: "boxmovies" | "onstream"; name: string };
}

/** A subtitle track (SRT/VTT) from boxmovies. The URL is signed and works directly. */
export interface BoxCaption {
  id: string;
  url: string;
  /** ISO 639-1 code: "en", "ar", "fr"… */
  languageCode: string;
  /** Human-readable name: "English", "العربية"… */
  language: string;
  delay?: number;
  sizeBytes?: number;
}

/** A single episode quality of a movie / TV episode. */
export interface BoxSourceGroup {
  detailPath: string;
  season: number;
  episode: number;
  subjectId?: string;
  hasResource: boolean;
  isLimited?: boolean;
  vipLocked?: boolean;
  freeStreamsRemaining?: number;
  sources: BoxSource[];
  captions: BoxCaption[];
  /** Convenience count (sources.length). Optional in the type so
   * older cached shapes still typecheck. */
  count?: number;
}

/** Lightweight card shape for browse pages (home / search / trending). */
export interface BoxMediaCard {
  /** Unique ID = the boxmovies detailPath. */
  detailPath: string;
  type: "movie" | "tv";
  title: string;
  year: number | null;
  rating: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
}

/** Full detail page metadata. */
export interface BoxDetail {
  detailPath: string;
  /**
   * The h5-api `subjectId`. This is what /stream needs to extract
   * sources; the Next.js data layer reads it from /detail and stores
   * it on the detail object so callers don't have to look it up again.
   */
  subjectId?: string;
  /** Alias for subjectId, kept for backwards-compat with call sites
   *  that read .id directly. */
  id?: string;
  /** "movie" | "tv" | "unknown" */
  kind: "movie" | "tv" | "unknown";
  title: string;
  synopsis: string;
  releaseDate: string;
  releaseYear: number | null;
  /** Duration in seconds (movies) or null (TV). */
  durationSeconds: number | null;
  /** Duration formatted as "1h 46m" or null. */
  durationLabel: string | null;
  /** Human-readable genres: ["Action", "Drama"] */
  genres: string[];
  country: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  hasResource: boolean;
  /** Available subtitle language names. */
  availableSubtitleLanguages: string[];
  /** TV-only — empty for movies. */
  seasons: Array<{
    season: number;
    episodeCount: number;
    episodes: number[] | null;
    resolutions: Array<{ resolution: number; episode: number }>;
  }>;
  source: string;
  uploadBy: string;
  /** Trailer stream URL (boxmovies trailer). */
  trailer: { url: string; source?: string } | null;
  /** Cast list (pageData.stars). Each has name, character, avatar, detailPath. */
  cast: Array<{
    name: string;
    character: string | null;
    avatar: string | null;
    detailPath: string | null;
  }>;
  /** User reviews (pageData.midReviewsList). */
  reviews: Array<{
    postId: string;
    userId: string;
    content: string;
    user: { nickname: string; avatar: string | null };
    createdAt: number | null;
    rating: number | null;
  }>;
}

// =========================================================================
// Legacy types (kept for backwards-compat — unused by boxmovies flow)
// =========================================================================

export interface CineProSource {
  url: string;
  type: "hls" | "mp4";
  quality: string;
  audioTracks?: { language: string; label: string }[];
  subtitles?: { language: string; label: string; url: string }[];
  provider: { id: string; name: string };
}

export interface CineProResponse {
  responseId: string;
  expiresAt: string;
  sources: CineProSource[];
  subtitles?: { language: string; label: string; url: string }[];
}

// =========================================================================
// App-level types
// =========================================================================

export type MediaType = "movie" | "tv";

/** Unified media shape used by rows/cards (works for both movies and TV). */
export interface MediaCard {
  id: string; // boxmovies detailPath
  type: MediaType;
  title: string;
  year: string;
  rating: number;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  runtime?: number | null;
}

/** Available filter axes for /movies, /tv, /animations browse pages. */
export interface FilterOptions {
  genre: string[];
  country: string[];
  year: string[];
  language: string[];
  sort: string[];
}

// =========================================================================
// TMDB stubs — legacy shapes kept for type-safety on unused imports.
// The Movbox web app does NOT use TMDB; these are only there so the
// `import type { TMDBMovie, ... }` statements in stale lib files
// (lib/tmdb.ts, lib/media.ts, components/detail/*) still compile
// while we phase them out. Will be deleted once the legacy detail
// code is gone.
// =========================================================================

export interface TMDBMovie {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  runtime?: number;
  episode_run_time?: number[];
  genres?: { id: number; name: string }[];
  spoken_languages?: { iso_639_1: string; name: string }[];
  production_countries?: { iso_3166_1: string; name: string }[];
  videos?: { results: TMDBVideo[] };
  credits?: { cast: TMDBCastMember[]; crew: TMDBCrewMember[] };
  similar?: TMDBPaginatedResponse<TMDBMovie>;
  recommendations?: TMDBPaginatedResponse<TMDBMovie>;
  belongs_to_collection?: { id: number; name: string; poster_path: string | null } | null;
  status?: string;
  tagline?: string | null;
}

export interface TMDBTVShow extends Omit<TMDBMovie, "title" | "release_date" | "runtime"> {
  name: string;
  first_air_date: string;
  episode_run_time: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: TMDBSeason[];
}

export interface TMDBPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
  known_for_department?: string;
  credit_id?: string;
  order?: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job?: string;
  department?: string;
  profile_path?: string | null;
  credit_id?: string;
}

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: "YouTube" | "Vimeo" | string;
  type: "Trailer" | "Teaser" | "Clip" | "Featurette" | string;
  official: boolean;
  published_at?: string;
}

export interface TMDBEpisode {
  id: number;
  name: string;
  overview?: string;
  still_path?: string | null;
  air_date?: string;
  episode_number: number;
  season_number: number;
  vote_average?: number;
  vote_count?: number;
  runtime?: number;
}

export interface TMDBSeason {
  id: number;
  season_number: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  air_date?: string;
  episode_count: number;
  episodes?: TMDBEpisode[];
}
