/**
 * Add the /genres/<id> URLs to public/sitemap.xml.
 *
 * The sitemap generator now reads the genre ids out of lib/genres.ts (the
 * genre pages are built on the real catalogue, not on TMDB — TMDB_API_KEY
 * is not set, so the old generator shipped a sitemap with no genre URLs at
 * all). The generator regenerates the whole file at prebuild, but the
 * committed copy is the fallback when the prebuild cannot reach the
 * upstream, so it has to carry the same URLs.
 *
 * Usage: node scripts/add-genre-urls-to-sitemap.mjs
 */

import { readFile, writeFile } from "node:fs/promises";

const SITEMAP = "public/sitemap.xml";

const src = await readFile("lib/genres.ts", "utf8");
const ids = [...src.matchAll(/^\s*id:\s*"(\d+)",/gm)].map((m) => m[1]);
if (!ids.length) throw new Error("no genre ids found in lib/genres.ts");

let xml = await readFile(SITEMAP, "utf8");

let added = 0;
for (const id of ids) {
  if (xml.includes(`/genres/${id}<`)) continue;
  const entry = [
    "  <url>",
    `    <loc>https://movbox.xyz/genres/${id}</loc>`,
    "    <lastmod>2026-11-06</lastmod>",
    "    <changefreq>weekly</changefreq>",
    "    <priority>0.5</priority>",
    "  </url>",
  ].join("\n");
  xml = xml.replace("</urlset>", `${entry}\n</urlset>`);
  added += 1;
}

if (added) {
  await writeFile(SITEMAP, xml, "utf8");
}
console.log(`added ${added} genre urls (${ids.length} genres total)`);
