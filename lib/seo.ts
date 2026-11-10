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

/**
 * The root layout's title template is `"%s | Movbox"`, so every template
 * title pays a 9-character tax (" | Movbox") before it reaches the browser.
 * A search result shows ~60 characters, so the template title itself is
 * capped at 51 — 51 + 9 = 60, never one character over.
 */
export const BRAND_SUFFIX_LENGTH = 9;
export const MAX_TEMPLATE_TITLE = 60 - BRAND_SUFFIX_LENGTH;
export const MAX_ABSOLUTE_TITLE = 60;

/**
 * Minimum length of a rendered meta description. Google rewrites anything
 * under ~120 characters, so a description below the floor never shows the
 * copy that was written for it.
 */
export const MIN_DESCRIPTION = 120;
export const MAX_DESCRIPTION = 160;

/**
 * Tails appended to a description that is shorter than the floor.
 *
 * These are facts about the site, not about the title: they are the same
 * promise the rest of the site makes, and exactly ONE of them is used — the
 * shortest one that lands the description inside the band.
 */
const DESCRIPTION_TAILS = [
  "Watch free on Movbox.",
  "Stream it free on Movbox — new titles added daily.",
  "Stream it free on Movbox — thousands of movies and TV shows, new titles added daily.",
  "Watch it free on Movbox — browse thousands of free movies and TV shows in HD, with brand new titles added every single day.",
];

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
  const rawDescription =
    input.description || `Watch movies and TV shows free on ${SITE_NAME}.`;
  // Every description is clamped to the 120-160 band. Google rewrites
  // anything under ~120 and truncates anything over ~160, so a page outside
  // that band never shows the copy that was written for it.
  //
  // A page that is noindex does not need the floor — the tail is written for
  // a snippet, and a noindex page never gets a snippet.
  const description = input.noindex
    ? clampDescription(rawDescription, MAX_DESCRIPTION, 0)
    : clampDescription(rawDescription, MAX_DESCRIPTION, MIN_DESCRIPTION);
  // The title is clamped BEFORE the root layout appends "| Movbox", so the
  // rendered title never crosses 60 characters. The Ahrefs audit measured 76
  // titles over the limit; the longest came from upstream titles that carry a
  // trailing language tag ("… in Tokyo BAY N.K. [English]").
  const title = clampTitle(
    input.title,
    input.absoluteTitle ? MAX_ABSOLUTE_TITLE : MAX_TEMPLATE_TITLE
  );
  const image = input.image ? absUrl(input.image) : undefined;

  const metadata: Metadata = {
    title: input.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: input.type ?? "website",
      title,
      description,
      url,
      siteName: SITE_NAME,
      ...(image
        ? {
            images: [
              {
                url: image,
                alt: title,
                ...(input.imageWidth ? { width: input.imageWidth } : {}),
                ...(input.imageHeight ? { height: input.imageHeight } : {}),
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
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
 * A trailing "[English]" / "(English Dubbed)" style tag.
 *
 * The tag has to look like a language or format marker — otherwise the
 * stripper eats the parenthetical a title actually needs, e.g.
 * "Why We Built Movbox (And Why It's Free)" must keep its tail.
 */
const TRAILING_TAG = /\s*[\[(]([^\])]{1,40})[\])]\s*$/;
const LANGUAGE_TAG =
  /\b(english|japanese|korean|spanish|french|german|hindi|arabic|portuguese|italian|chinese|tamil|telugu|marathi|bengali|dutch|polish|russian|turkish|thai|vietnamese|indonesian|filipino|swahili|dubbed|subbed|uncut|raw|hd|4k|cc|multi)\b/i;

/**
 * Clamp a page title to a length a search result will actually show.
 *
 * A search result truncates around 60 characters. The root layout appends
 * "| Movbox" (9 characters) to every template title, so the template title
 * itself is capped at 51 — the rendered title never crosses 60.
 *
 * Two upstream quirks are handled before the cut:
 *   - a trailing language tag ("… in Tokyo BAY N.K. [English]") is dropped,
 *     because it eats the budget and says nothing the page does not
 *   - the cut itself always lands on a word boundary, never mid-word
 */
export function clampTitle(text: string, max = MAX_TEMPLATE_TITLE): string {
  let s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return s;

  // A trailing "[English]" / "(English Dubbed)" tag, and nothing else.
  const tag = s.match(TRAILING_TAG);
  if (tag && LANGUAGE_TAG.test(tag[1]) && !/\b\d{4}\b/.test(tag[1])) {
    s = s.slice(0, tag.index).trim() || s;
  }

  if (s.length <= max) return s;

  const cut = s.slice(0, max).replace(/\s+\S*$/, "").trim();
  return cut.length >= 20 ? cut : s.slice(0, max).trimEnd();
}

/**
 * The title of a title's detail page.
 *
 * A bare upstream title can be very short — "Child of Thunder" plus the
 * brand suffix is 24 characters, which Google shows as a stub — and it can
 * be very long, in which case `clampTitle` cuts it. This keeps both ends
 * inside the band a search result actually shows, and it keeps the upstream
 * title itself intact so the page stays on-topic.
 *
 * The rendered title carries the " | Movbox" suffix, so the template title
 * has to clear 21 characters for the rendered title to clear 30 — the
 * shortest title Google will not treat as a stub.
 */
export function detailTitle(
  title: string,
  kind: "movie" | "tv"
): string {
  const base = clampTitle(title, 44);
  if (!base) return base;

  // A title that already says "Watch …" must not become "Watch Watch …".
  const alreadyStartsWithWatch = /^watch\b/i.test(base);

  const candidates: string[] =
    kind === "tv"
      ? [
          `${base} — Full Episodes & Seasons`,
          `Watch ${base} — Full Episodes & Seasons`,
          `${base} — Watch Free on Movbox`,
        ]
      : [
          alreadyStartsWithWatch
            ? `${base} — Free in HD`
            : `Watch ${base} Free in HD`,
          `${base} — Watch Free in HD`,
          `Watch ${base} Free Online in HD`,
        ];

  // A title that is already long enough is used as it is — enriching a
  // 40-character title would only push it over the ceiling.
  if (base.length >= 28) return clampTitle(base, MAX_TEMPLATE_TITLE);

  // Otherwise take the first candidate that clears the minimum length.
  for (const candidate of candidates) {
    const t = clampTitle(candidate, MAX_TEMPLATE_TITLE);
    if (t.length >= 21) return t;
  }
  return clampTitle(candidates[candidates.length - 1], MAX_TEMPLATE_TITLE);
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
 * When the source description is under the floor it is EXTENDED with a
 * site-level tail rather than left short — a 106-character synopsis becomes
 * a 128-character snippet that keeps the sentence it started with. The tail
 * only states what the site already states elsewhere: this is a free site
 * with a catalogue that changes every day.
 *
 * @param text  The raw description.
 * @param max   Hard ceiling. Default 160.
 * @param min   Preferred floor for a sentence-boundary cut. Default 120.
 *               Pass 0 to disable the floor (e.g. for noindex pages).
 */
export function clampDescription(
  text: string,
  max = MAX_DESCRIPTION,
  min = MIN_DESCRIPTION
): string {
  let s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";

  // Too short — extend it with ONE site-level tail: the shortest tail that
  // lands the description inside the band. Exactly one tail is used, so the
  // result never reads like a list of slogans, and the function is
  // idempotent (calling it twice does not append the tail twice).
  if (min > 0 && s.length < min) {
    const candidates = DESCRIPTION_TAILS.filter(
      (tail) => !s.endsWith(tail)
    ).map((tail) => `${s} ${tail}`);
    const fits = candidates.find((c) => c.length <= max && c.length >= min);
    if (fits) {
      s = fits;
    } else {
      // No single tail lands in the band — take the longest one that still
      // fits under the ceiling.
      const under = candidates.filter((c) => c.length <= max);
      if (under.length) s = under[under.length - 1];
    }
  }

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
