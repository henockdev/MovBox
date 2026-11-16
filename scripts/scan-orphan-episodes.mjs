#!/usr/bin/env node
/**
 * How many series publish MORE episode URLs in the sitemap than their own
 * page links?
 *
 * Every extra URL is an orphan: a sitemap entry with no internal link
 * pointing at it, pointing at an episode that resolves zero sources. That is
 * the exact pattern the Ahrefs audit reported.
 *
 * Usage: node scripts/scan-orphan-episodes.mjs <base-url> [sampleStep]
 */

const base = (process.argv[2] || "https://movbox.xyz").replace(/\/$/, "");
const step = Number(process.argv[3] || 10);

const xml = await (await fetch(`${base}/sitemap.xml`)).text();
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
  m[1].replace(/&amp;/g, "&")
);
const episodes = locs.filter((u) => u.includes("/watch/tv/"));
console.log(`sitemap episode URLs: ${episodes.length}`);

// group by series
const bySeries = new Map();
for (const u of episodes) {
  const [p, q] = u.split("?");
  const slug = p.replace(/^https?:\/\/[^/]+/, "").replace("/watch/tv/", "");
  const se = Number((q || "").match(/s=(\d+)/)?.[1] || 0);
  const ep = Number((q || "").match(/e=(\d+)/)?.[1] || 0);
  if (!bySeries.has(slug)) bySeries.set(slug, new Set());
  if (ep) bySeries.get(slug).add(`${se}:${ep}`);
}
const series = [...bySeries.entries()];
console.log(`series in the sitemap: ${series.length}`);

const sampled = series.filter((_, i) => i % step === 0);
console.log(`sampling ${sampled.length} of them (every ${step})\n`);

let bad = 0;
let missingTotal = 0;

for (const [slug, eps] of sampled) {
  const res = await fetch(`${base}/tv/${slug}`, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await res.text();
  const linked = new Set(
    [...html.matchAll(/\/watch\/tv\/[^"'?]*\?s=(\d+)&(?:amp;)?e=(\d+)/g)].map(
      (m) => `${m[1]}:${m[2]}`
    )
  );
  const missing = [...eps].filter((k) => !linked.has(k));
  if (missing.length) {
    bad++;
    missingTotal += missing.length;
    console.log(`  ${slug}: ${eps.size} published, ${missing.length} not linked -> ${missing.slice(0, 8).join(" ")}`);
  }
  // be gentle with the live site
  await new Promise((r) => setTimeout(r, 250));
}

console.log(
  `\n${bad} of ${sampled.length} sampled series publish episodes their page does not link (${missingTotal} URLs)`
);
console.log(`projected across all ${series.length} series: ~${Math.round((missingTotal / Math.max(sampled.length, 1)) * series.length)} URLs`);
