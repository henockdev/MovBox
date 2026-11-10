// What does the episode URL structure actually do to a crawler?
//
// The deployed sitemap lists 25 013 episode urls, ALL of them query-string
// urls of the form /watch/tv/<id>?s=<season>&e=<episode> — 397 series, tens
// of thousands of query variants.
//
// This measures the three things that decide whether an episode can ever be
// indexed:
//   1. what the real episode url declares as its canonical
//   2. whether the series page links to the episodes at all
//   3. whether the "legacy" path form still exists
//
// Usage: node scripts/probe-episode-urls.mjs [baseUrl]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");

const pick = (html, re, label) => {
  const m = html.match(re);
  console.log(`  ${label.padEnd(13)}: ${m ? m[1] : "-"}`);
  return m ? m[1] : null;
};

const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const episodeUrls = locs
  .filter((u) => u.includes("/watch/tv/"))
  .map((u) => u.replace(/&amp;/g, "&"));
console.log(`sitemap episode urls: ${episodeUrls.length}`);
const sample = episodeUrls[0];
const series = sample.split("?")[0].replace("/watch/tv/", "/tv/");
console.log(`sample: ${sample}`);
console.log("");

console.log("=== A. the real episode url (query-string form)");
const r2 = await fetch(sample);
const html = await r2.text();
console.log(`  status       : ${r2.status}`);
const canonical = pick(html, /<link rel="canonical" href="([^"]+)"/, "canonical");
pick(html, /<meta property="og:url" content="([^"]+)"/, "og:url");
const title = pick(html, /<title>([^<]*)<\/title>/, "title");
const desc = pick(html, /<meta name="description" content="([^"]*)"/, "description");
if (desc) console.log(`  desc length  : ${desc.length}`);
const h1 = html.match(/<h1[^>]*>([\s\S]{0,120}?)<\/h1>/);
console.log(`  h1           : ${h1 ? JSON.stringify(h1[1].replace(/<[^>]+>/g, "").trim()) : "-"}`);
console.log(`  noindex      : ${/name="robots"[^>]*content="[^"]*noindex/i.test(html)}`);
console.log(`  TVEpisode    : ${/"TVEpisode"/.test(html)}`);
console.log(
  `  canonical keeps the episode? ${canonical ? canonical.includes("?s=") : "n/a"}`
);
console.log("");

console.log("=== B. the same episode WITHOUT the query string");
const bare = sample.split("?")[0];
const rb = await fetch(bare);
const hb = await rb.text();
const cb = hb.match(/<link rel="canonical" href="([^"]+)"/);
const tb = hb.match(/<title>([^<]*)<\/title>/);
console.log(`  ${bare}`);
console.log(`  status       : ${rb.status}`);
console.log(`  canonical    : ${cb ? cb[1] : "-"}`);
console.log(`  title        : ${tb ? tb[1] : "-"}`);
console.log(
  `  SAME canonical as the episode url? ${cb && canonical ? cb[1] === canonical : "n/a"}`
);
console.log("");

console.log("=== C. does the SERIES page link to its episodes?");
const seriesHtml = await (await fetch(series)).text();
const links = [...seriesHtml.matchAll(/href="([^"]*watch\/tv\/[^"]*)"/g)].map((m) => m[1]);
console.log(`  ${series}`);
console.log(`  <a href> to watch/tv  : ${links.length}`);
console.log(`  unique                : ${new Set(links).size}`);
console.log(`  'season' in HTML      : ${(seriesHtml.match(/season/gi) || []).length}`);
console.log(
  `  hrefs with ?s= or ?e=  : ${(seriesHtml.match(/href="[^"]*[?&][se]=/g) || []).length}`
);
console.log(`  episode mentions      : ${(seriesHtml.match(/episode/gi) || []).length}`);
