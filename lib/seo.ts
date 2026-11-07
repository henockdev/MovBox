import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "./constants";

/**
 * Shared SEO helpers.
 *
 * Every indexable route on Movbox builds its metadata through
 * `pageSeo()` so the three things crawlers actually read —
 * `<title>`, `<meta name="description">` and `<link rel="canonical">` —
 * are always present, self-referential, and consistent with the
 * OpenGraph / Twitter cards.
 *
 * Rules baked in here:
 *   - The canonical URL is always THIS page (self-canonical). No page
 *     points its canonical at a different URL, so search engines never
 *     have to guess which of our URLs is the real one.
 *   - `og:url` always matches the canonical. Mismatched og:url vs
 *     canonical is the classic signal that makes Facebook/WhatsApp
 *     rewrite the shared preview to the homepage.
 *   - The brand suffix is NOT included in `title` — the root layout's
 *     `title.template` appends "| Movbox". Passing "Movies — Movbox"
 *     would render "Movies — Movbox | Movbox".
 */

/** Absolute URL for a site-relative path. Absolute inputs pass through. */
export function absUrl(path: string): string {
  const p = (path || "").trim();
  if (!p) return `${SITE_URL}/`;
  if (/^https?:\/\//i.test(p)) return p;
  return `${SITE_URL}${p.startsWith("/") ? p : `/${p}`}`;
}

export type PageSeoType =
  | "website"
  | "article"
  | "video.movie"
  | "video.tv_show"
  | "video.episode";

export interface PageSeoInput {
  /**
   * Absolute path of THIS page, including any query string.
   * e.g. "/watch/tv/black-clover?s=1&e=1"
   */
  path: string;
  /** Title WITHOUT the brand suffix — the layout template adds "| Movbox". */
  title: string;
  description: string;
  /** OpenGraph type. Defaults to "website". */
  type?: PageSeoType;
  /** Absolute or site-relative preview image. */
  image?: string | null;
  keywords?: string[];
  /** Pages that must never be indexed (auth, profile, search, 404). */
  noindex?: boolean;
  /**
   * Overrides the canonical when it must point at a DIFFERENT URL than the
   * one being served — e.g. a TV show that was requested under /movie/ and
   * therefore canonicalises to /tv/<id>. `og:url` follows the canonical so
   * the two never disagree.
   */
  canonical?: string;
  /** Optional preview-image dimensions (kept for OG scrapers). */
  imageWidth?: number;
  imageHeight?: number;
  /**
   * Use the title verbatim, bypassing the root layout's "%s | Movbox"
   * template. Needed for the homepage, whose title already carries the
   * brand and would otherwise read "Movbox — ... | Movbox".
   */
  absoluteTitle?: boolean;
}

export function pageSeo(input: PageSeoInput): Metadata {
  const url = absUrl(input.canonical ?? input.path);
  const description =
    input.description || `Watch movies and TV shows free on ${SITE_NAME}.`;
  const image = input.image ? absUrl(input.image) : undefined;

  const metadata: Metadata = {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: input.type ?? "website",
      title: input.title,
      description,
      url,
      siteName: SITE_NAME,
      ...(image
        ? {
            images: [
              {
                url: image,
                alt: input.title,
                ...(input.imageWidth ? { width: input.imageWidth } : {}),
                ...(input.imageHeight ? { height: input.imageHeight } : {}),
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };

  if (input.keywords?.length) {
    metadata.keywords = input.keywords;
  }

  if (input.noindex) {
    metadata.robots = {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    };
  }

  return metadata;
}

/**
 * Clamp a meta description to a length a search engine will actually show.
 *
 * Google renders roughly 155-160 characters of a meta description before it
 * truncates with an ellipsis of its own. Anything longer is cut at an
 * arbitrary point — often mid-word — so the snippet reads as broken. Cutting
 * it here, on a sentence boundary where one exists, keeps the snippet whole.
 *
 * The floor matters as much as the ceiling. The regression that started this
 * work was descriptions that were far too SHORT (36 characters on /trending),
 * so the clamp never shortens a description below a readable length unless
 * the source itself is that short.
 *
 * @param text  The raw description.
 * @param max   Hard ceiling. Default 160.
 * @param min   Preferred floor for a sentence-boundary cut. Default 100.
 */
export function clampDescription(
  text: string,
  max = 160,
  min = 100
): string {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= max) return s;

  const slice = s.slice(0, max);

  // Prefer the longest sentence-complete prefix.
  const ends = [...slice.matchAll(/[.!?](?=\s|$)/g)];
  const lastEnd = ends.length ? (ends[ends.length - 1].index ?? 0) + 1 : 0;
  if (lastEnd >= min) return slice.slice(0, lastEnd).trim();

  // Otherwise cut on a word boundary — never mid-word.
  const cut = slice.replace(/\s+\S*$/, "").trim();
  if (cut.length >= min) return `${cut}…`;

  return `${slice.trimEnd()}…`;
}

/**
 * Clamp an untrusted season/episode value to a sane integer.
 * Mirrors the clamp the watch page applies client-side so the server
 * metadata and the client UI always agree on the episode being shown.
 */
export function clampEpisodeNumber(
  raw: string | string[] | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(String(first ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * Canonical URL for a title's detail page. `/movie/<id>` and `/tv/<id>`
 * are siblings — exactly one of them is the real URL for a given title,
 * and this helper keeps that decision in a single place.
 */
export function detailCanonical(
  kind: "movie" | "tv",
  detailPath: string
): string {
  return absUrl(`/${kind}/${encodeURIComponent(detailPath)}`);
}

/**
 * Upstream series titles carry a season-range suffix, e.g.
 * "Black Clover [English] S1-S2" or "Lupin S1-S4". Dropping it keeps
 * an episode title from reading "Black Clover S1-S2 Season 1 Episode 2".
 */
export function baseShowTitle(title: string): string {
  return title.replace(/\s+S\d+(-S\d+)?\s*$/i, "").trim() || title;
}
