/**
 * Image URL helpers.
 *
 * Boxmovies returns poster/backdrop URLs as full https:// URLs.
 * TMDB returns bare paths like "/abc.jpg" that need the TMDB base prepended.
 * `imageUrl()` handles both — pass a full URL through, build a TMDB URL from a path.
 */

const TMDB_BASE = "https://image.tmdb.org/t/p/";

export type TMDBImageSize =
  | "w92"
  | "w154"
  | "w185"
  | "w342"
  | "w500"
  | "w780"
  | "w1280"
  | "original";

/**
 * If `pathOrUrl` is already a full http(s) URL, return it as-is.
 * Otherwise, treat it as a TMDB image path and prepend the TMDB base.
 * Returns null for empty input.
 */
export function imageUrl(
  pathOrUrl: string | null | undefined,
  size: TMDBImageSize = "w500"
): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${TMDB_BASE}${size}${pathOrUrl}`;
}

/** Build a TMDB image URL (legacy helper kept for any TMDB-only callers). */
export function tmdbImage(
  path: string | null | undefined,
  size: TMDBImageSize = "w500"
): string | null {
  return imageUrl(path, size);
}
