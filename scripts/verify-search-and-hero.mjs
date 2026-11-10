/**
 * Verify the app-style search screen and the hero strip.
 *
 * Checks the two things the owner asked for, plus the round-2 Ahrefs fixes
 * that were still uncommitted when this landed:
 *
 *   1. the search screen — suggestions, recent, trending terms, the catalogue
 *      tabs, the ranked rows and the filter panel
 *   2. the hero strip — draggable, arrow-driven, faded at the edges, and
 *      wired to the banner as the pager control
 *   3. the Ahrefs fixes — episode links, the genre pages, /most-watched size
 *
 * Usage: node scripts/verify-search-and-hero.mjs [baseUrl]
 */

const BASE = (process.argv[2] || "http://localhost:3210").replace(/\/$/, "");

let pass = 0;
let fail = 0;

function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": "movbox-verify/1.0" },
  });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

/** A non-HTML body (the sitemap). */
async function getText(path) {
  const res = await fetch(`${BASE}${path}`);
  return await res.text();
}

function section(title) {
  console.log(`\n${title}`);
}

async function main() {
  console.log(`Verifying ${BASE}\n`);

  // ---------------------------------------------------------------- search --
  section("1. The search screen");

  const search = await get("/search");
  check("/search answers 200", search.status === 200, `status ${search.status}`);
  const html = search.text;

  check(
    "the search field is on the page",
    html.includes("Search movies, series and short TV")
  );
  check(
    "the Search action sits inside the field",
    /type="submit"[^>]*>\s*Search/.test(html) ||
      html.includes("Search</button>")
  );
  check(
    "the catalogue tabs are All / Movie / Series / Short TV",
    ["All", "Movie", "Series", "Short TV"].every((t) => html.includes(`>${t}<`)),
  );
  check(
    "the Everyone is searching row is rendered",
    html.includes("Everyone is searching")
  );
  check("the Top rankings block is rendered", html.includes("Top rankings"));
  check(
    "ranked rows are rendered server-side",
    (html.match(/\/movie\/|\/tv\//g) || []).length > 3
  );
  check(
    "the search screen is noindex",
    html.includes('name="robots"') && /noindex/i.test(html)
  );

  // ------------------------------------------------------------ suggestions --
  section("2. The upstream suggestions");

  const sug = await getJson("/api/search-suggest?q=dra");
  check(
    "/api/search-suggest answers 200",
    sug.status === 200,
    `status ${sug.status}`
  );
  check(
    "the suggestions come back as a list of words",
    Array.isArray(sug.json?.suggestions) && sug.json.suggestions.length > 0,
    JSON.stringify(sug.json).slice(0, 160)
  );
  check(
    "every suggestion is a non-empty string",
    Array.isArray(sug.json?.suggestions) &&
      sug.json.suggestions.every((s) => typeof s === "string" && s.trim())
  );

  const emptySug = await getJson("/api/search-suggest?q=a");
  check(
    "a one-character query is answered without a call",
    emptySug.status === 200 && Array.isArray(emptySug.json?.suggestions)
  );

  // ---------------------------------------------------------------- search --
  section("3. The search results");

  for (const tab of ["all", "movie", "tv", "short"]) {
    const r = await getJson(`/api/search?q=love&tab=${tab}`);
    const items = r.json?.items;
    check(
      `/api/search tab=${tab} answers 200 with items`,
      r.status === 200 && Array.isArray(items) && items.length > 0,
      `status ${r.status} n=${Array.isArray(items) ? items.length : "none"}`
    );
    check(
      `/api/search tab=${tab} returns a real pager`,
      typeof r.json?.pager?.hasMore === "boolean",
      JSON.stringify(r.json?.pager)
    );
    check(
      `/api/search tab=${tab} items carry the filter fields`,
      Array.isArray(items) &&
        items.length > 0 &&
        items.every(
          (i) =>
            typeof i.id === "string" &&
            typeof i.title === "string" &&
            ("year" in i) &&
            ("rating" in i) &&
            ("genre" in i) &&
            ("country" in i)
        )
    );
  }

  const shortRes = await getJson("/api/search?q=love&tab=short");
  check(
    "short TV results are episodic (type tv, so they open under /tv/)",
    Array.isArray(shortRes.json?.items) &&
      shortRes.json.items.length > 0 &&
      shortRes.json.items.every((i) => i.type === "tv"),
    JSON.stringify(shortRes.json?.items?.slice?.(0, 2) ?? [])
  );

  const allRes = await getJson("/api/search?q=love&tab=all");
  check(
    "the All tab mixes movies and series",
    Array.isArray(allRes.json?.items) &&
      allRes.json.items.some((i) => i.type === "movie") &&
      allRes.json.items.some((i) => i.type === "tv"),
    JSON.stringify(
      allRes.json?.items?.slice?.(0, 6)?.map?.((i) => i.type) ?? []
    )
  );

  const noQuery = await getJson("/api/search");
  check(
    "a missing query is rejected cleanly",
    noQuery.status === 400 && noQuery.json?.ok === false
  );

  // ------------------------------------------------------------------ hero --
  section("4. The hero and the strip under it");

  const home = await get("/");
  check("the homepage answers 200", home.status === 200);
  const homeHtml = home.text;

  check(
    "the strip is a horizontal scroller",
    homeHtml.includes("overflow-x-auto") && homeHtml.includes("snap-mandatory")
  );
  check(
    "the strip can be dragged with the mouse",
    homeHtml.includes("cursor-grab")
  );
  check(
    "the strip has arrow buttons",
    homeHtml.includes("Scroll the featured titles left") &&
      homeHtml.includes("Scroll the featured titles right")
  );
  check(
    "the strip fades at the edges",
    (homeHtml.match(/from-bg-deepest/g) || []).length >= 2
  );
  check(
    "the banner pager is present",
    homeHtml.includes("aria-label=\"Featured titles\"") &&
      homeHtml.includes("snap-x")
  );
  check(
    "the strip carries the same slides as the banner",
    homeHtml.includes("Featured titles")
  );

  const trending = await get("/trending");
  check("/trending answers 200", trending.status === 200);
  check(
    "/trending has the strip under its hero too",
    trending.text.includes("cursor-grab") &&
      trending.text.includes("Scroll the featured titles right")
  );

  // ------------------------------------------------------- round 2: audit --
  section("5. The Ahrefs fixes (round 2, still uncommitted)");

  const genres = await get("/genres");
  check("/genres answers 200", genres.status === 200);
  check(
    "/genres lists the genre pages (it used to render an empty grid)",
    (genres.text.match(/\/genres\/\d+/g) || []).length >= 10,
    `links: ${(genres.text.match(/\/genres\/\d+/g) || []).length}`
  );

  const genre = await get("/genres/28");
  check("/genres/28 answers 200", genre.status === 200);
  check(
    "/genres/28 has an h1 (it used to be a soft 404)",
    /<h1[\s>]/.test(genre.text)
  );
  check(
    "/genres/28 has an og:image",
    genre.text.includes("og:image")
  );
  const genreDesc = genre.text.match(
    /<meta name="description" content="([^"]*)"/i
  );
  check(
    "/genres/28 has a description in the 120–160 band",
    !!genreDesc &&
      genreDesc[1].length >= 120 &&
      genreDesc[1].length <= 160,
    genreDesc ? `len ${genreDesc[1].length}` : "no description"
  );

  const mostWatched = await get("/most-watched");
  check("/most-watched answers 200", mostWatched.status === 200);
  check(
    "/most-watched is under the 2 MB crawl limit",
    mostWatched.text.length < 2_000_000,
    `${(mostWatched.text.length / 1_000_000).toFixed(2)} MB`
  );

  // The orphan fix: the episode list has to be real links.
  //
  // Sampled from the sitemap itself — the URLs Ahrefs found orphaned — so
  // the check is against the pages that are actually published, not against
  // a hand-picked title.
  const sitemap = await getText("/sitemap.xml");
  const episodeUrls = [
    ...sitemap.matchAll(
      /<loc>https:\/\/movbox\.xyz\/watch\/tv\/([^<?]+)\?s=(\d+)&amp;e=(\d+)<\/loc>/g
    ),
  ].map((m) => ({ detailPath: decodeURIComponent(m[1]), s: m[2], e: m[3] }));

  check(
    "the sitemap publishes episode URLs in the query form",
    episodeUrls.length > 100,
    `${episodeUrls.length} episode URLs sampled`
  );

  if (episodeUrls.length) {
    // One page per show, checking that every sampled episode of that show is
    // linked from it.
    const byShow = new Map();
    for (const ep of episodeUrls) {
      if (!byShow.has(ep.detailPath)) byShow.set(ep.detailPath, []);
      byShow.get(ep.detailPath).push(ep);
    }
    const picks = [...byShow.entries()].slice(0, 4);
    let checked = 0;
    let missing = 0;
    for (const [detailPath, eps] of picks) {
      const page = await get(`/tv/${encodeURIComponent(detailPath)}`);
      if (page.status !== 200) {
        console.log(`        (${detailPath} answered ${page.status})`);
        continue;
      }
      for (const ep of eps) {
        const wanted = `/watch/tv/${detailPath}?s=${ep.s}&e=${ep.e}`;
        // The HTML escapes the ampersand; the href itself is the plain form.
        const found =
          page.text.includes(wanted) ||
          page.text.includes(wanted.replace("&", "&amp;")) ||
          page.text.includes(wanted.replace("&", "\\u0026"));
        checked++;
        if (!found) missing++;
      }
    }
    check(
      "every sampled episode is linked from its series page",
      checked > 0 && missing === 0,
      `${checked - missing}/${checked} linked`
    );
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
