/**
 * Compare the ranking slugs in the committed sitemap with the ones the
 * upstream currently serves.
 *
 * The upstream renames ranking groups (a slug changed from
 * "trending-short-drma" to "trending-short-drama"), so a committed sitemap
 * can keep a URL that no longer exists. The URL then answers with an empty
 * document — a soft 404.
 *
 * Usage: node scripts/check-sitemap-slugs.mjs
 */

import { readFile } from "node:fs/promises";

const sitemap = await readFile("public/sitemap.xml", "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const toPath = (u) => u.replace(/^https?:\/\/[^/]+/, "");

const slugOf = (p) => p.replace(/^\/rankings\//, "");

// The sitemap's own ranking URLs.
const inSitemap = urls
  .map(toPath)
  .filter((p) => p.startsWith("/rankings/"))
  .map(slugOf)
  .sort();

// The live groups — fetched from the site itself so this stays honest
// about what the upstream really serves right now.
const res = await fetch("http://localhost:3210/rankings");
const html = await res.text();
const live = [
  ...new Set(
    [...html.matchAll(/href="\/rankings\/([a-z0-9-]+)"/g)].map((m) => m[1])
  ),
].sort();

const stale = inSitemap.filter((s) => !live.includes(s));
const missing = live.filter((s) => !inSitemap.includes(s));

console.log(`sitemap ranking urls : ${inSitemap.length}`);
console.log(`live ranking groups  : ${live.length}`);
console.log(`stale (in sitemap, not live): ${stale.join(", ") || "none"}`);
console.log(`missing (live, not in sitemap): ${missing.join(", ") || "none"}`);
