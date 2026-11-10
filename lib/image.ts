/**
 * Image URL helpers.
 *
 * Boxmovies returns poster/backdrop URLs as full https:// URLs.
 * TMDB returns bare paths like "/abc.jpg" that need the TMDB base prepended.
 * `imageUrl()` handles both — pass a full URL through, build a TMDB URL from a path.
 *
 * ## The catalogue's own CDN resizes for us
 *
 * The boxmovies CDNs are Alibaba Cloud OSS buckets, and they expose the
 * `x-oss-process` image pipeline. The catalogue ships **full-resolution**
 * artwork: a poster that the site renders at 44×62 px is a 3840×2160 WebP
 * weighing 1.1–2.0 MB, and the site serves images unoptimized (Vercel's free
 * tier caps image optimization at ~1 000 source images a month).
 *
 * Measured live on 2026-11-09:
 *
 *   pbcdn.aoneroom.com   original 1 109 732 B  3840x2160
 *                         w_500        25 780 B     500x281
 *                         w_200         6 124 B     200x113
 *   pbcdnw.aoneroom.com  original 2 036 472 B  3840x2160
 *                         w_500        36 140 B     500x281
 *
 * So the resize is applied at the URL level — 43× to 56× smaller, the aspect
 * ratio preserved, the format still WebP. `m_lfit` is used so an image that
 * is already smaller than the target is never blown up.
 */

/** The CDN hosts that answer the `x-oss-process` pipeline. */
const OSS_HOSTS = [
  "pbcdn.aoneroom.com",
  "pbcdnw.aoneroom.com",
  "pacdn.aoneroom.com",
  "macdn.aoneroom.com",
];

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

/** The pixel width each size token asks the CDN for. */
const SIZE_WIDTH: Record<TMDBImageSize, number | null> = {
  w92: 92,
  w154: 154,
  w185: 185,
  w342: 342,
  w500: 500,
  w780: 780,
  w1280: 1280,
  original: null,
};

function isOssHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return OSS_HOSTS.includes(host);
  } catch {
    return false;
  }
}

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

  if (/^https?:\/\//i.test(pathOrUrl)) {
    const width = SIZE_WIDTH[size];
    // Never stack two resize instructions on one URL.
    if (width && !pathOrUrl.includes("x-oss-process") && isOssHost(pathOrUrl)) {
      const sep = pathOrUrl.includes("?") ? "&" : "?";
      return `${pathOrUrl}${sep}x-oss-process=image/resize,m_lfit,w_${width}`;
    }
    return pathOrUrl;
  }

  return `${TMDB_BASE}${size}${pathOrUrl}`;
}

/** Build a TMDB image URL (legacy helper kept for any TMDB-only callers). */
export function tmdbImage(
  pathOrUrl: string | null | undefined,
  size: TMDBImageSize = "w500"
): string | null {
  return imageUrl(pathOrUrl, size);
}
