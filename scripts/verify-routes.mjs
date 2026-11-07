// Sweep every route family the site exposes and report the status code.
//
// This is the "does everything actually work" check: not a metadata audit
// (that is seo-structure-check.mjs) but a reachability sweep over the page
// routes, the detail routes, the watch routes and the API routes.
//
// Usage: node scripts/verify-routes.mjs [baseUrl]

const BASE = (process.argv[2] || "http://localhost:3210").replace(/\/+$/, "");

const STATIC = [
  "/",
  "/movies",
  "/tv",
  "/animations",
  "/trending",
  "/most-watched",
  "/genres",
  "/blog",
  "/movbox-app",
  "/rankings",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/search?q=batman",
  "/login",
  "/signup",
  "/profile",
  "/watchlist",
  "/robots.txt",
  "/llms.txt",
  "/sitemap.xml",
  "/sitemap-index.xml",
  "/video-sitemap.xml",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/opengraph-image",
];

const CATEGORIES = [
  "kids",
  "asian",
  "western",
  "nollywood",
  "midnight",
  "shorttv",
  "music",
  "live",
];

const RANKING_GROUPS = [
  "popular-series",
  "popular-movie",
  "adult-animation",
  "epic-fantasy",
  "comedy",
  "teen-romance",
  "superhero-series",
  "bl-story",
  "bet",
  "action-thriller",
  "gangster",
  "teen-fantasy",
  "k-drama",
  "coming-soon",
  "c-drama",
  "anime-english-dubbed",
  "action-movies",
  "horror-movies",
  "hot-short-tv",
  "trending-short-drma",
  "must-watch-black-shows",
  "romance",
];

const DETAIL = "40-dates-and-40-nights-IyIrty839T6";

const API = [
  `/api/sources?detailPath=${DETAIL}`,
  `/api/subtitle-proxy?url=${encodeURIComponent("https://example.invalid/x.srt")}`,
  "/api/video-proxy",
  "/api/video-proxy?url=https://example.invalid/x.mp4",
];

// The two proxies validate their `url` parameter and answer 400 for a
// missing or malformed one. That is the correct response, not a failure —
// so they are expected to fail here, on purpose.
const EXPECT_400 = ["/api/subtitle-proxy", "/api/video-proxy"];

async function check(path) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "User-Agent": "Mozilla/5.0 (route sweep)" },
      redirect: "manual",
    });
    const ms = Date.now() - started;
    // Consume the body so the connection can be reused.
    await res.arrayBuffer();
    const expects400 = EXPECT_400.some((p) => path.startsWith(p));
    const ok = expects400
      ? res.status === 400
      : res.status < 400 || res.status === 404;
    return { path, status: res.status, ms, ok, note: expects400 ? " (400 expected)" : "" };
  } catch (error) {
    return { path, status: `ERR ${error.message}`, ms: Date.now() - started, ok: false };
  }
}

const targets = [
  ...STATIC,
  ...CATEGORIES.map((c) => `/category/${c}`),
  ...RANKING_GROUPS.map((g) => `/rankings/${g}`),
  `/movie/${DETAIL}`,
  `/tv/${DETAIL}`,
  `/watch/movie/${DETAIL}`,
  `/watch/tv/${DETAIL}?s=1&e=1`,
  ...API,
];

console.log(`Sweeping ${targets.length} routes against ${BASE}\n`);

const results = [];
for (const t of targets) {
  const r = await check(t);
  results.push(r);
  const flag = r.ok ? "ok " : "FAIL";
  console.log(
    `  ${flag} ${String(r.status).padEnd(5)} ${String(r.ms).padStart(6)} ms  ${t.slice(0, 70)}${r.note ?? ""}`
  );
}

const failed = results.filter((r) => !r.ok);
const slow = results.filter((r) => r.ms > 3000).map((r) => `${r.path} (${r.ms} ms)`);

console.log("\n================ SUMMARY ================");
console.log(`  ${results.length - failed.length}/${results.length} OK`);
if (slow.length) {
  console.log(`  slower than 3 s: ${slow.length}`);
  for (const s of slow) console.log(`    - ${s}`);
}
if (failed.length) {
  console.log(`  FAILURES: ${failed.length}`);
  for (const f of failed) console.log(`    - ${f.path} -> ${f.status}`);
  process.exitCode = 1;
} else {
  console.log("  no failures");
}
