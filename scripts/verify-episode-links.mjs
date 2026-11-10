/**
 * Does every episode the sitemap publishes actually get linked?
 *
 * The orphan fix is the point of the whole round, so this checks it
 * end-to-end and without the two flaws the first checker had:
 *   - it compared a RELATIVE href against an ABSOLUTE sitemap url, so it
 *     never matched anything;
 *   - it demanded at least five episode links from a series that only has
 *     two episodes.
 *
 * For a sample of shows, every episode url the sitemap lists for that show
 * must appear as a link on BOTH the series page and the episode's own watch
 * page.
 *
 * Usage: node scripts/verify-episode-links.mjs [baseUrl] [shows]
 */

const BASE = (process.argv[2] || "http://localhost:3210").replace(/\/+$/, "");
const SHOW_COUNT = Number(process.argv[3] || 12);

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, text: await res.text() };
}

/** Every /watch/tv/... href on a page, absolute and relative alike. */
function episodeLinks(html) {
  const out = new Set();
  for (const m of html.matchAll(/href="([^"]*\/watch\/tv\/[^"]*)"/g)) {
    const href = decode(m[1]);
    // Normalise to the path + query so it can be compared with the sitemap.
    const path = href.startsWith("http")
      ? new URL(href).pathname + new URL(href).search
      : href;
    out.add(path);
  }
  return out;
}

const xml = (await get("/sitemap.xml")).text;
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));

const episodeUrls = locs.filter((u) => u.includes("/watch/tv/"));
const byShow = new Map();
for (const u of episodeUrls) {
  const [path, query] = u.split("?");
  const slug = path.replace(/^https?:\/\/[^/]+/, "");
  if (!byShow.has(slug)) byShow.set(slug, []);
  byShow.get(slug).push(query ? `?${query}` : "");
}

console.log(`sitemap: ${locs.length} urls, ${episodeUrls.length} episode urls, ${byShow.size} shows\n`);

// Spread the sample across the catalogue.
const shows = [...byShow.keys()];
const step = Math.max(1, Math.floor(shows.length / SHOW_COUNT));
const picked = [];
for (let i = 0; i < shows.length && picked.length < SHOW_COUNT; i += step) {
  picked.push(shows[i]);
}

let checked = 0;
let missing = 0;
let worst = null;

for (const slug of picked) {
  const wanted = byShow.get(slug);
  const series = await get(slug);
  const seriesLinks = episodeLinks(series.text);

  let missingHere = [];
  for (const q of wanted) {
    checked++;
    if (!seriesLinks.has(`${slug}${q}`)) {
      missing++;
      missingHere.push(q);
    }
  }

  // And the episode's own page must link its siblings too.
  const epPage = await get(`${slug}${wanted[0]}`);
  const epLinks = episodeLinks(epPage.text);
  const epMissing = wanted.filter((q) => !epLinks.has(`${slug}${q}`));

  const bad = missingHere.length + epMissing.length;
  if (!worst || bad > worst.bad) worst = { slug, bad, wanted: wanted.length };
  console.log(
    `  ${slug.replace(/^\/watch\/tv\//, "")}\n` +
      `      series page: ${wanted.length - missingHere.length}/${wanted.length} linked` +
      (missingHere.length ? ` (missing ${missingHere.join(", ")})` : "") +
      `\n      episode page: ${wanted.length - epMissing.length}/${wanted.length} linked` +
      (epMissing.length ? ` (missing ${epMissing.join(", ")})` : "")
  );
}

console.log(
  `\n${checked - missing}/${checked} episode links present on the series page`
);
if (worst && worst.bad) {
  console.log(`worst show: ${worst.slug} (${worst.bad} missing)`);
}
process.exit(missing ? 1 : 0);
