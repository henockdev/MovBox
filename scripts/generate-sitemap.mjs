// Generate sitemap.xml + video-sitemap.xml at build time as static
// files in public/. Runs via `prebuild` in package.json.
//
// Two sitemaps:
//   1. /sitemap.xml — standard sitemap with static pages + every
//      detail URL (movie + tv) we know about.
//   2. /video-sitemap.xml — Google-specific video sitemap that
//      unlocks the "Videos" tab in search results + rich video
//      snippets. One entry per detail page with thumbnail, title,
//      description, player_loc, family_friendly flag.
//
// Auth: mints a Bearer token from h5-api's /app/get-latest-app-pkgs
// endpoint (same flow as lib/data.ts). All upstream calls are wrapped
// in try/catch with a 5s timeout so a slow/down upstream never
// breaks the build.

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
const SITE_HOST = "https://boxmovies.org";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const STATIC_PAGES = [
  { url: "/", changeFrequency: "daily", priority: 1.0 },
  { url: "/movies", changeFrequency: "daily", priority: 0.9 },
  { url: "/tv", changeFrequency: "daily", priority: 0.9 },
  { url: "/trending", changeFrequency: "hourly", priority: 0.8 },
  { url: "/animations", changeFrequency: "weekly", priority: 0.7 },
  { url: "/most-watched", changeFrequency: "daily", priority: 0.7 },
  { url: "/genres", changeFrequency: "weekly", priority: 0.6 },
  { url: "/movbox-app", changeFrequency: "daily", priority: 0.7 },
  { url: "/search", changeFrequency: "never", priority: 0.5 },
  { url: "/blog", changeFrequency: "weekly", priority: 0.8 },
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

async function fetchWithTimeout(url, opts = {}, ms = 8000) {
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
  const res = await fetchWithTimeout(`${H5_API_BASE}${path}`, init);
  if (!res.ok) throw new Error(`h5 ${path} -> ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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
// Title collection
// ---------------------------------------------------------------------------

async function collectTitles(token) {
  const seen = new Set();
  const out = [];
  const add = (item, type) => {
    if (!item || !item.detailPath) return;
    if (seen.has(item.detailPath)) return;
    seen.add(item.detailPath);
    out.push({
      detailPath: item.detailPath,
      type,
      title: item.title || item.name || "",
      description: item.overview || item.description || "",
      posterUrl: item.posterUrl || item.image?.url || "",
      backdropUrl: item.backdropUrl || "",
      year: item.year || "",
      rating: item.rating || item.voteAverage || 0,
      genres: item.genres || [],
    });
  };

  // Fetch from multiple sources in parallel for full coverage.
  // Each call has its own try/catch so a failure on one doesn't kill
  // the others.
  const sources = [
    ["home", () => h5Fetch("/home?host=boxmovies.org", { token })],
    ["trending", () =>
      h5Fetch("/subject/trending?page=0&perPage=50", { token })],
  ];

  await Promise.all(
    sources.map(async ([label, fn]) => {
      try {
        const r = await fn();
        if (!r) return;
        // Different response shapes across endpoints — handle all
        const items = [];
        if (r.data?.operatingList) {
          for (const o of r.data.operatingList) {
            if (Array.isArray(o.subjects)) items.push(...o.subjects);
          }
        }
        if (r.data?.results) items.push(...r.data.results);
        if (r.data?.subjects) items.push(...r.data.subjects);
        if (r.data?.items) items.push(...r.data.items);
        for (const it of items) {
          // Normalize: h5-api uses different field names depending on
          // the endpoint. detailPath is the unique key we use
          // everywhere; try common variants.
          const dp =
            it.detailPath ||
            it.subjectId ||
            it.id ||
            it.subject_id ||
            it.path;
          if (!dp) continue;
          const type = it.type || (it.subjectType === 1 ? "tv" : "movie");
          add({ ...it, detailPath: dp }, type);
        }
        console.log(`[sitemap] ${label}: ${items.length} items`);
      } catch (e) {
        console.warn(`[sitemap] ${label} failed: ${e.message}`);
      }
    }),
  );

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
  const isTv = t.type === "tv";
  // The info page (the canonical <loc>). For TV items the boxmovies
  // data labels everything as "tv" but the visible URL is /movie/
  // for movies and /tv/ for shows. The watch page is where the
  // video actually plays — that's the only valid player_loc.
  const infoPath = `/${isTv ? "tv" : "movie"}/${encodeURIComponent(t.detailPath)}`;
  const watchPath = `/watch/${isTv ? "tv" : "movie"}/${encodeURIComponent(t.detailPath)}`;
  const loc = `${SITE_URL}${infoPath}`;
  const playerLoc = `${SITE_URL}${watchPath}`;
  const thumb = t.backdropUrl || t.posterUrl || `${SITE_URL}/og-image.png`;
  const desc = (t.description || `Watch ${t.title} online in 4K on Movbox.`).slice(0, 2048);
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
    // player_loc must point to the actual player page (the /watch/
    // route), NOT the same as <loc>. Google rejects entries where
    // player_loc == loc. We omit content_loc because the actual
    // stream URL is short-lived (proxied through the thin relay) —
    // pointing to a stale URL would be worse than omitting.
    `      <video:player_loc allow_embed=\"yes\">${xmlEscape(playerLoc)}</video:player_loc>`,
    `      <video:family_friendly>${familyFriendly}</video:family_friendly>`,
    `      <video:live>no</video:live>`,
    `      <video:requires_subscription>no</video:requires_subscription>`,
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

  // 1. Try to fetch detail titles for the dynamic URLs. If the
  //    upstream is down, we still ship the static URLs — never let
  //    a slow upstream break the build.
  let titles = [];
  try {
    console.log("[sitemap] minting token…");
    const token = await mintToken();
    console.log("[sitemap] collecting titles…");
    titles = await collectTitles(token);
    console.log(`[sitemap] got ${titles.length} unique titles`);
  } catch (e) {
    console.warn(`[sitemap] upstream collection failed: ${e.message}`);
    console.warn("[sitemap] continuing with static URLs only");
  }

  // 2. Write sitemap.xml
  const sitemapLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...STATIC_PAGES.map((p) =>
      urlEntry(p.url, now, p.changeFrequency, p.priority),
    ),
    ...titles.map((t) =>
      urlEntry(
        `/${t.type === "tv" ? "tv" : "movie"}/${encodeURIComponent(t.detailPath)}`,
        now,
        "weekly",
        0.7,
      ),
    ),
    // Blog articles. We keep this list in sync with
    // lib/blog/articles.ts. Adding a new article = appending here.
    ...BLOG_SLUGS.map((slug) => urlEntry(`/blog/${slug}`, now, "monthly", 0.6)),
    "</urlset>",
    "",
  ].join("\n");
  await mkdir(PUBLIC_DIR, { recursive: true });
  await writeFile(SITEMAP_PATH, sitemapLines, "utf8");
  const total = STATIC_PAGES.length + titles.length;
  console.log(
    `[sitemap] wrote ${SITEMAP_PATH} (${STATIC_PAGES.length} static + ${titles.length} detail = ${total} urls)`,
  );

  // 3. Write video-sitemap.xml (only if we got titles — otherwise skip)
  if (titles.length > 0) {
    const videoLines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      '        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
      ...titles.map((t) => videoUrlEntry(t, now)),
      "</urlset>",
      "",
    ].join("\n");
    await writeFile(VIDEO_SITEMAP_PATH, videoLines, "utf8");
    console.log(
      `[sitemap] wrote ${VIDEO_SITEMAP_PATH} (${titles.length} videos)`,
    );
  } else {
    console.log("[sitemap] no titles, skipping video-sitemap.xml");
  }

  // 4. Write sitemap-index.xml that references both sitemaps. Submit
  //    this ONE file to Google Search Console and Bing Webmaster
  //    Tools — they fetch the index, discover the children, and
  //    keep everything in sync automatically. This is the "big site"
  //    pattern: single entry point, multiple specialized sitemaps.
  const indexEntries = [
    { loc: `${SITE_URL}/sitemap.xml`, lastmod: now },
    { loc: `${SITE_URL}/video-sitemap.xml`, lastmod: now },
  ];
  const indexLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...indexEntries.map(
      (e) =>
        `  <sitemap><loc>${xmlEscape(e.loc)}</loc><lastmod>${e.lastmod}</lastmod></sitemap>`,
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
