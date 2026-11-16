/**
 * Microsoft Clarity — project settings and the 18+ exclusion rules.
 *
 * Clarity is Microsoft's free session recorder: it captures what a visitor
 * sees and does (the clicks, the scroll, the page, the text on it).
 *
 * Movbox carries a real 18+ catalogue — `/category/midnight`, the "Adult
 * Animation" and "BL Story" ranking shelves, and a set of adult titles
 * that the upstream publishes with a sanitised "Modern Drama" genre. A
 * blanket session recorder over adult content is a terms-of-service risk
 * (Microsoft's Clarity terms and Digital Safety policy, and Clarity's own
 * rule that it must not be used on sites aimed at users under 18), so
 * Clarity is installed on the site but it is NOT allowed to watch the 18+
 * surfaces.
 *
 * Three layers of defence, in order:
 *
 *   1. ROUTE EXCLUSION — the tag is not rendered at all on an adult
 *      route. `isClarityExcludedPath()`.
 *   2. CONTENT EXCLUSION — an adult page marks its own root with
 *      `data-clarity-exclude="true"` and masks its content with
 *      `data-clarity-mask="true"`. `clarityExclusionProps()`.
 *   3. RUNTIME PAUSE — while an adult page is on screen the session is
 *      paused, and a click on an adult link pauses it before the
 *      navigation happens. `components/analytics/Clarity.tsx`.
 *
 * The upstream's own `isPornographic` flag is NOT used on its own: it
 * misses titles such as `presidents-sexy-wife-8Q8QPnNOMi` and
 * `mistaken-for-my-brother-in-laws-sex-doll-4iQCTJBInea`, which the
 * upstream reports as `isPornographic=false, genre="Modern Drama"`. The
 * rules below therefore combine the genre signal with a title check.
 */

/** The Clarity project ID — the site's own property. */
export const CLARITY_PROJECT_ID = "ze20elh5au";

/** The tag endpoint. VERIFIED 2026-11-15: HTTP 200, 726 bytes. */
export const CLARITY_TAG_URL = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;

/**
 * The owner's snippet, verbatim.
 *
 *     <script type="text/javascript">
 *         (function(c,l,a,r,i,t,y){
 *             c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
 *             t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
 *             y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
 *         })(window, document, "clarity", "script", "ze20elh5au");
 *     </script>
 *
 * The `<script>` element itself is rendered by the component; this string
 * is the body that goes inside it, unchanged. It is also what the runtime
 * fallback injects, so the code that runs in the browser is the owner's
 * code and not a paraphrase of it.
 */
export const CLARITY_SNIPPET_BODY = `
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
`;

/**
 * The attribute a PAGE uses to opt out of recording.
 *
 * Only the page's own root carries it — a card or a link inside a page
 * must not, or the whole page would read as 18+.
 */
export const CLARITY_EXCLUDE_ATTR = "data-clarity-exclude";

/**
 * The attribute a LINK (or a card) uses to mark itself as 18+.
 *
 * A click on one of these stops the session before the navigation, so the
 * 18+ page it leads to is never recorded as a page view.
 */
export const CLARITY_ADULT_ATTR = "data-clarity-adult";

/** The attribute a node uses to hide its content from the recording. */
export const CLARITY_MASK_ATTR = "data-clarity-mask";

/** Categories whose whole page is 18+. */
export const ADULT_CATEGORY_SLUGS = new Set(["midnight"]);

/**
 * Ranking shelves whose whole page is 18+.
 *
 * The upstream's own shelf names — "Adult Animation" and "BL Story".
 * Their subjects carry a sanitised genre in the list response ("Anime",
 * "Drama"), so the shelf can only be recognised by name; the adult
 * titles inside them are caught by the title/genre rules on the detail
 * pages themselves.
 */
export const ADULT_RANKING_SLUGS = new Set(["adult-animation", "bl-story"]);

/** Genres that mark a title as adult. */
const ADULT_GENRE_RE =
  /\b(adult|erotic|porn\w*|hentai|ecchi|boys\s*love|bl|sexy|nsfw|18\+)\b/i;

/**
 * Words in a title that mark it as adult.
 *
 * This is the rule that catches the two titles the upstream publishes
 * with a clean "Modern Drama" genre — "President's Sexy Wife" and
 * "Mistaken for My Brother-in-Law's Sex Doll" — which the genre rule
 * alone misses.
 */
const ADULT_TITLE_RE =
  /(^|[^a-z])(sex|sexy|sexual|sexually|nude|naked|porn|porno|pornographic|erotic|erotica|hentai|xxx|nsfw)([^a-z]|$)/i;

/** True when a genre string (or a comma-joined list of them) is adult. */
export function isAdultGenreString(genre?: string | null): boolean {
  if (!genre) return false;
  return ADULT_GENRE_RE.test(genre);
}

/** True when a list of genres contains an adult one. */
export function isAdultGenres(genres?: readonly string[] | null): boolean {
  if (!genres || genres.length === 0) return false;
  return genres.some((g) => ADULT_GENRE_RE.test(g));
}

/** True when a title's own name marks it as adult. */
export function isAdultTitle(title?: string | null): boolean {
  if (!title) return false;
  return ADULT_TITLE_RE.test(title);
}

/**
 * True when a title is adult by either signal — the genre list or the
 * title itself.
 */
export function isAdultContent(input?:
  | {
      title?: string | null;
      genres?: readonly string[] | null;
    }
  | null
): boolean {
  if (!input) return false;
  return isAdultGenres(input.genres) || isAdultTitle(input.title);
}

/**
 * The props an adult page's root element carries.
 *
 * `data-clarity-exclude="true"` tells the Clarity component that this
 * page must not be recorded (it pauses the session while it is on
 * screen). `data-clarity-mask="true"` hides the page's content from the
 * recorder even if a session is somehow running.
 *
 * Returns an empty object for ordinary pages, so it can be spread onto
 * any root element unconditionally.
 */
export function clarityExclusionProps(input?:
  | {
      title?: string | null;
      genres?: readonly string[] | null;
    }
  | null
): {
  "data-clarity-exclude"?: string;
  "data-clarity-mask"?: string;
} {
  if (!isAdultContent(input)) return {};
  return {
    [CLARITY_EXCLUDE_ATTR]: "true",
    [CLARITY_MASK_ATTR]: "true",
  };
}

/**
 * The props an adult ROUTE's root element carries.
 *
 * Same pair as clarityExclusionProps(), but decided by the route rather
 * than by the content on it.
 */
export function clarityRouteProps(pathname: string): {
  "data-clarity-exclude"?: string;
  "data-clarity-mask"?: string;
} {
  if (!isClarityExcludedPath(pathname)) return {};
  return {
    [CLARITY_EXCLUDE_ATTR]: "true",
    [CLARITY_MASK_ATTR]: "true",
  };
}

/**
 * True for the routes that must never be recorded.
 *
 * The query string and the hash are ignored — the path is what decides.
 */
export function isClarityExcludedPath(pathname?: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.split("?")[0].split("#")[0];
  if (!path || path === "/") return false;

  // /category/<slug>
  if (path.startsWith("/category/")) {
    const slug = path.slice("/category/".length).split("/")[0];
    if (ADULT_CATEGORY_SLUGS.has(slug)) return true;
  }

  // /rankings/<group>
  if (path.startsWith("/rankings/")) {
    const slug = path.slice("/rankings/".length).split("/")[0];
    if (ADULT_RANKING_SLUGS.has(slug)) return true;
  }

  return false;
}
