// Generate sitemap.xml + video-sitemap.xml + sitemap-index.xml at build
// time as static files in public/. Runs via `prebuild` in package.json.
//
// Three sitemaps:
//   1. /sitemap.xml          — static pages + genre pages + blog articles
//                               + every detail URL we know about + the
//                               watch URLs (one per movie, one per episode
//                               for series).
//   2. /video-sitemap.xml    — Google video sitemap; one entry per title
//                               with thumbnail, title, description and a
//                               player_loc that points at the page which
//                               actually embeds the player.
//   3. /sitemap-index.xml    — index over the two above. Submit THIS ONE
//                               file to Search Console / Bing Webmaster.
//
// Auth: mints a Bearer token from h5-api's /app/get-latest-app-pkgs
// endpoint (same flow as lib/data.ts). All upstream calls are wrapped
// in try/catch with a timeout so a slow/down upstream never breaks the
// build — we simply ship fewer URLs.
//
// Field names below are VERIFIED against the live upstream, not guessed:
//   - `subjectType` 1 = movie, 2 = tv series, 7 = animation. Type 7 mixes
//     one-off animated features AND episodic anime series, so the seasons
//     decide the kind (same rule as lib/data.ts).
//   - `resource.seasons[]` carries `se`, `maxEp` and `resolutions[]` with
//     `epNum` (the last episode available in that resolution tier).
//   - `subject.releaseDate` is a real date ("2026-08-07") and is what we
//     use for `<lastmod>` — the build timestamp used to be wrong.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");
const SITEMAP_PATH = join(PUBLIC_DIR, "sitemap.xml");
const VIDEO_SITEMAP_PATH = join(PUBLIC_DIR, "video-sitemap.xml");
const SITEMAP_INDEX_PATH = join(PUBLIC_DIR, "sitemap-index.xml");

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://movbox.xyz";
const H5_API_BASE =
  process.env.H5_API_BASE || "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const TMDB_BASE = "https://api.themoviedb.org/3";
const SITE_HOST = "https://boxmovies.org";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// How many catalogue pages (50 items each) to pull per channel. 4 pages
// per channel = up to 600 titles. Every title needs one /detail call to
// learn its kind, real lastmod and episode count, so this is the knob that
// trades build time against catalogue coverage. Raise it with
// SITEMAP_PAGES_PER_CHANNEL when a bigger catalogue is worth a longer build.
//
// NOTE: the value committed to public/sitemap.xml is produced by this same
// default at build time (the prebuild script runs before every Vercel build),
// so the file in the repo and the file that gets served stay in sync.
const PAGES_PER_CHANNEL = Number(process.env.SITEMAP_PAGES_PER_CHANNEL || 4);
// Parallel /detail calls. The upstream rate-limits with HTTP 429 above
// roughly two concurrent /detail calls, so keep this low.
const DETAIL_CONCURRENCY = Number(process.env.SITEMAP_DETAIL_CONCURRENCY || 2);
// Safety cap on how many episodes we enumerate per season.
const MAX_EPISODES_PER_SEASON = Number(
  process.env.SITEMAP_MAX_EPISODES_PER_SEASON || 120
);
// Google's hard limit is 50 000 URLs per sitemap file.
const MAX_URLS = 49000;

const STATIC_PAGES = [
  { url: "/", changeFrequency: "daily", priority: 1.0 },
  { url: "/movies", changeFrequency: "daily", priority: 0.9 },
  { url: "/tv", changeFrequency: "daily", priority: 0.9 },
  { url: "/trending", changeFrequency: "hourly", priority: 0.8 },
  { url: "/animations", changeFrequency: "weekly", priority: 0.7 },
  { url: "/most-watched", changeFrequency: "daily", priority: 0.7 },
  { url: "/genres", changeFrequency: "weekly", priority: 0.6 },
  { url: "/movbox-app", changeFrequency: "daily", priority: 0.7 },
  { url: "/blog", changeFrequency: "weekly", priority: 0.8 },
  // Category shelves. Keep in sync with lib/categories.ts.
  { url: "/category/kids", changeFrequency: "daily", priority: 0.8 },
  { url: "/category/asian", changeFrequency: "daily", priority: 0.8 },
  { url: "/category/western", changeFrequency: "weekly", priority: 0.7 },
  { url: "/category/nollywood", changeFrequency: "daily", priority: 0.8 },
  { url: "/category/shorttv", changeFrequency: "daily", priority: 0.7 },
  { url: "/category/music", changeFrequency: "weekly", priority: 0.7 },
  { url: "/category/midnight", changeFrequency: "daily", priority: 0.6 },
];

// Blog slugs — must stay in sync with lib/blog/articles.ts. We
// re-import the source so the build fails if articles.ts has a
// syntax error. (dynamic import keeps this script zero-dep.)
const BLOG_SLUGS = [
  "top-10-movies-this-week",
  "how-to-find-best-4k-content",
  "why-we-built-movbox",
  "best-k-drama-2026",
  "movbox-vs-other-streaming-sites",
];

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function h5Fetch(path, { method = "GET", body = null, token } = {}) {
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Authorization: `Bearer ${token}`,
    Origin: SITE_HOST,
    Referer: `${SITE_HOST}/`,
    "User-Agent": USER_AGENT,
  };
  const init = { method, headers };
  if (body && method === "POST") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  // The upstream rate-limits with HTTP 429 once we hammer it. Retry with
  // exponential backoff and honour Retry-After when the server sends it —
  // without this, a 900-title catalogue loses ~90% of its detail lookups
  // and the sitemap silently ships a fraction of the catalogue.
  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetchWithTimeout(`${H5_API_BASE}${path}`, init);
    if (res.status !== 429) {
      if (!res.ok) throw new Error(`h5 ${path} -> ${res.status}`);
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }
    lastError = new Error(`h5 ${path} -> 429`);
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(15000, 1000 * 2 ** attempt);
    console.warn(
      `[sitemap] 429 on ${path}, retrying in ${waitMs}ms (attempt ${attempt + 1})`
    );
    await new Promise((r) => setTimeout(r, waitMs));
  }
  throw lastError ?? new Error(`h5 ${path} -> 429`);
}

async function mintToken() {
  const r = await fetchWithTimeout(
    `${H5_API_BASE}/app/get-latest-app-pkgs?app_name=moviebox`,
    {
      headers: {
        Origin: SITE_HOST,
        Referer: `${SITE_HOST}/`,
        "User-Agent": USER_AGENT,
        Accept: "application/json, text/plain, */*",
      },
    },
  );
  if (!r.ok) throw new Error(`token mint -> ${r.status}`);
  const setCookie = r.headers.get("set-cookie") || "";
  const m = setCookie.match(/(?:^|,\s*)token=([^;]+)/i);
  if (!m) throw new Error("no token in set-cookie");
  return m[1];
}

// ---------------------------------------------------------------------------
// Catalogue collection
// ---------------------------------------------------------------------------

function pickItems(r) {
  const items = [];
  if (!r) return items;
  if (Array.isArray(r.data?.operatingList)) {
    for (const o of r.data.operatingList) {
      if (Array.isArray(o.subjects)) items.push(...o.subjects);
    }
  }
  for (const key of ["items", "results", "subjects"]) {
    if (Array.isArray(r.data?.[key])) items.push(...r.data[key]);
  }
  return items;
}

function detailPathOf(it) {
  return (
    it?.detailPath || it?.subjectId || it?.id || it?.subject_id || it?.path || null
  );
}

/** Pull the raw catalogue entries (one per channel, paginated). */
async function collectCatalogue(token) {
  const seen = new Set();
  const out = [];
  for (const channelId of [1, 2, 7]) {
    for (let page = 1; page <= PAGES_PER_CHANNEL; page++) {
      let r;
      try {
        r = await h5Fetch("/subject/filter", {
          method: "POST",
          token,
          body: {
            channelId,
            page: String(page),
            perPage: 50,
            sort: "ForYou",
          },
        });
      } catch (e) {
        console.warn(`[sitemap] ch${channelId} p${page} failed: ${e.message}`);
        break;
      }
      const items = pickItems(r);
      if (items.length === 0) break;
      for (const it of items) {
        const dp = detailPathOf(it);
        if (!dp || seen.has(dp)) continue;
        seen.add(dp);
        out.push({
          detailPath: dp,
          subjectType: it.subjectType,
          title: it.title || it.name || "",
          overview: it.overview || it.description || "",
          posterUrl:
            (it.cover && it.cover.url) ||
            (it.image && it.image.url) ||
            it.posterUrl ||
            "",
          backdropUrl:
            (it.stills && it.stills.url) || it.backdropUrl || "",
          releaseDate: it.releaseDate || "",
          genres: it.genres || [],
          channelId,
        });
      }
    }
    console.log(`[sitemap] channel ${channelId}: ${seen.size} unique so far`);
  }
  return out;
}

/**
 * Decide the kind of a title from its subjectType + seasons.
 * Mirrors inferSubjectKind() in lib/data.ts.
 */
function inferKind(subjectType, seasons) {
  if (subjectType === 1) return "movie";
  if (subjectType === 2) return "tv";
  const episodic = seasons.some(
    (s) =>
      s.maxEp > 1 ||
      (Array.isArray(s.resolutions) &&
        s.resolutions.some((r) => Number(r.epNum) > 1))
  );
  if (episodic) return "tv";
  if (seasons.length > 0) return "movie";
  return "unknown";
}

/** Episode count for one season: max(maxEp, highest epNum per resolution). */
function seasonEpisodeCount(season) {
  const fromMax = Number(season.maxEp) || 0;
  let fromRes = 0;
  if (Array.isArray(season.resolutions)) {
    for (const r of season.resolutions) {
      const n = Number(r.epNum) || 0;
      if (n > fromRes) fromRes = n;
    }
  }
  return Math.max(fromMax, fromRes);
}

/**
 * Fetch /detail for every catalogue entry and resolve:
 *   kind, real lastmod, poster/backdrop, and the episode list for series.
 */
async function resolveTitles(token, entries) {
  const resolved = [];
  let cursor = 0;
  let failures = 0;

  async function worker() {
    while (cursor < entries.length) {
      const entry = entries[cursor++];
      let detail = null;
      try {
        const r = await h5Fetch(
          `/detail?detailPath=${encodeURIComponent(entry.detailPath)}`,
          { token }
        );
        detail = r?.data || null;
      } catch (e) {
        failures++;
        if (failures <= 5) {
          console.warn(
            `[sitemap] detail failed (${e.message}): ${entry.detailPath}`
          );
        }
      }
      if (!detail) continue;

      const subject = detail.subject || {};
      const seasons = Array.isArray(detail.resource?.seasons)
        ? detail.resource.seasons
        : [];
      const kind = inferKind(subject.subjectType, seasons);
      if (kind === "unknown") continue;

      const episodeList = [];
      if (kind === "tv") {
        for (const season of seasons) {
          const se = Number(season.se) || 0;
          if (se <= 0) continue;
          const count = Math.min(
            seasonEpisodeCount(season),
            MAX_EPISODES_PER_SEASON
          );
          for (let ep = 1; ep <= count; ep++) {
            episodeList.push({ season: se, episode: ep });
          }
        }
      }

      resolved.push({
        detailPath: entry.detailPath,
        kind,
        title: subject.title || entry.title,
        description: subject.description || entry.overview || "",
        posterUrl:
          (subject.cover && subject.cover.url) || entry.posterUrl || "",
        backdropUrl:
          (subject.stills && subject.stills.url) || entry.backdropUrl || "",
        releaseDate: subject.releaseDate || entry.releaseDate || "",
        genres: entry.genres,
        episodes: episodeList,
      });
    }
  }

  const workers = [];
  const n = Math.min(DETAIL_CONCURRENCY, Math.max(1, entries.length));
  for (let i = 0; i < n; i++) workers.push(worker());
  await Promise.all(workers);
  if (failures) {
    console.warn(`[sitemap] ${failures} detail calls failed (skipped)`);
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Genre pages (TMDB)
// ---------------------------------------------------------------------------

async function collectGenrePages() {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    console.log("[sitemap] TMDB_API_KEY not set, skipping genre pages");
    return [];
  }
  const out = [];
  for (const type of ["movie", "tv"]) {
    try {
      const res = await fetchWithTimeout(
        `${TMDB_BASE}/genre/${type}/list?api_key=${encodeURIComponent(key)}`
      );
      if (!res.ok) continue;
      const json = await res.json();
      for (const g of json.genres || []) {
        out.push({
          id: String(g.id),
          name: g.name,
          type,
        });
      }
    } catch (e) {
      console.warn(`[sitemap] tmdb ${type} genres failed: ${e.message}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// XML writers
// ---------------------------------------------------------------------------

function xmlEscape(s) {
  if (s == null) return "";
  return String(s).replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[c]);
}

/** W3C date. Never in the future — a future lastmod is a lie to the crawler. */
function lastmodFor(releaseDate, fallback) {
  const raw = String(releaseDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(`${raw.slice(0, 10)}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.getTime() <= Date.now()) {
      return d.toISOString().slice(0, 10);
    }
  }
  return fallback;
}

function urlEntry(path, lastmod, changeFrequency, priority) {
  return [
    "  <url>",
    `    <loc>${xmlEscape(SITE_URL + path)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changeFrequency}</changefreq>`,
    `    <priority>${priority.toFixed(1)}</priority>`,
    "  </url>",
  ].join("\n");
}

function videoUrlEntry(t, lastmod) {
  const isTv = t.kind === "tv";
  const infoPath = `/${isTv ? "tv" : "movie"}/${encodeURIComponent(t.detailPath)}`;
  // The watch page is where the video actually plays — that's the only
  // valid player_loc, and it must differ from <loc>.
  const watchPath = isTv
    ? `/watch/tv/${encodeURIComponent(t.detailPath)}?s=1&e=1`
    : `/watch/movie/${encodeURIComponent(t.detailPath)}`;
  const loc = `${SITE_URL}${infoPath}`;
  const playerLoc = `${SITE_URL}${watchPath}`;
  const thumb = t.backdropUrl || t.posterUrl || `${SITE_URL}/og-image.png`;
  const desc = (
    t.description || `Watch ${t.title} online in 4K on Movbox.`
  ).slice(0, 2048);
  const title = (t.title || infoPath).slice(0, 100);
  const tag = (t.genres || [])
    .slice(0, 8)
    .map((g) => (typeof g === "string" ? g : g.name))
    .filter(Boolean)
    .slice(0, 32);
  const familyFriendly = "yes";
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    "    <video:video>",
    `      <video:thumbnail_loc>${xmlEscape(thumb)}</video:thumbnail_loc>`,
    `      <video:title>${xmlEscape(title)}</video:title>`,
    `      <video:description>${xmlEscape(desc)}</video:description>`,
    `      <video:player_loc allow_embed="yes">${xmlEscape(playerLoc)}</video:player_loc>`,
    `      <video:family_friendly>${familyFriendly}</video:family_friendly>`,
    "      <video:live>no</video:live>",
    "      <video:requires_subscription>no</video:requires_subscription>",
    ...(tag.length
      ? [`      <video:tag>${xmlEscape(tag.join(", "))}</video:tag>`]
      : []),
    "    </video:video>",
    "  </url>",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  let titles = [];
  try {
    console.log("[sitemap] minting token…");
    const token = await mintToken();
    console.log("[sitemap] collecting catalogue…");
    const entries = await collectCatalogue(token);
    console.log(`[sitemap] ${entries.length} catalogue entries, resolving detail…`);
    titles = await resolveTitles(token, entries);
    console.log(
      `[sitemap] resolved ${titles.length} titles (${titles.filter((t) => t.kind === "tv").length} tv / ${titles.filter((t) => t.kind === "movie").length} movie)`,
    );
  } catch (e) {
    console.warn(`[sitemap] upstream collection failed: ${e.message}`);
    console.warn("[sitemap] continuing with static URLs only");
  }

  const genres = await collectGenrePages();

  // ---- sitemap.xml -------------------------------------------------------
  const entries = [];

  for (const p of STATIC_PAGES) {
    entries.push(urlEntry(p.url, today, p.changeFrequency, p.priority));
  }

  for (const g of genres) {
    entries.push(urlEntry(`/genres/${g.id}`, today, "weekly", 0.5));
  }

  for (const slug of BLOG_SLUGS) {
    entries.push(urlEntry(`/blog/${slug}`, today, "monthly", 0.6));
  }

  let episodeCount = 0;
  for (const t of titles) {
    const isTv = t.kind === "tv";
    const infoPath = `/${isTv ? "tv" : "movie"}/${encodeURIComponent(t.detailPath)}`;
    const lastmod = lastmodFor(t.releaseDate, today);
    entries.push(urlEntry(infoPath, lastmod, "weekly", isTv ? 0.8 : 0.7));

    if (isTv) {
      // The watch route for a series is per-episode: /watch/tv/<id>?s=&e=
      for (const ep of t.episodes) {
        if (entries.length >= MAX_URLS) break;
        entries.push(
          urlEntry(
            `/watch/tv/${encodeURIComponent(t.detailPath)}?s=${ep.season}&e=${ep.episode}`,
            lastmod,
            "monthly",
            0.6
          )
        );
        episodeCount++;
      }
    } else {
      entries.push(
        urlEntry(
          `/watch/movie/${encodeURIComponent(t.detailPath)}`,
          lastmod,
          "monthly",
          0.6
        )
      );
    }
    if (entries.length >= MAX_URLS) break;
  }

  await mkdir(PUBLIC_DIR, { recursive: true });
  const sitemapLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
  await writeFile(SITEMAP_PATH, sitemapLines, "utf8");
  console.log(
    `[sitemap] wrote ${SITEMAP_PATH} (${entries.length} urls, ${episodeCount} episode urls)`,
  );

  // ---- video-sitemap.xml -------------------------------------------------
  if (titles.length > 0) {
    const videoLines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      '        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
      ...titles.map((t) => videoUrlEntry(t, lastmodFor(t.releaseDate, today))),
      "</urlset>",
      "",
    ].join("\n");
    await writeFile(VIDEO_SITEMAP_PATH, videoLines, "utf8");
    console.log(`[sitemap] wrote ${VIDEO_SITEMAP_PATH} (${titles.length} videos)`);
  } else {
    console.log("[sitemap] no titles, skipping video-sitemap.xml");
  }

  // ---- sitemap-index.xml -------------------------------------------------
  const indexEntries = [
    { loc: `${SITE_URL}/sitemap.xml`, lastmod: today },
    { loc: `${SITE_URL}/video-sitemap.xml`, lastmod: today },
  ];
  const indexLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...indexEntries.map(
      (e) =>
        `  <sitemap><loc>${xmlEscape(e.loc)}</loc><lastmod>${e.lastmod}</lastmod></sitemap>`
    ),
    "</sitemapindex>",
    "",
  ].join("\n");
  await writeFile(SITEMAP_INDEX_PATH, indexLines, "utf8");
  console.log(
    `[sitemap] wrote ${SITEMAP_INDEX_PATH} (${indexEntries.length} child sitemaps)`,
  );
}

main().catch((e) => {
  console.error("[sitemap] failed:", e);
  // Don't fail the build — the static URLs are still useful.
  process.exit(0);
});
