/**
 * Probe the remaining measured SEO gaps on the local build.
 *
 * For the route families that still have open findings it reports, per URL:
 *   - the rendered <title> and its length
 *   - the rendered meta description and its length
 *   - how many <h1> elements the document has (and their text)
 *   - whether og:title / og:description / og:image / og:url are present
 *
 * Usage: node scripts/probe-gaps.mjs [baseUrl]
 */

import { readFile } from "node:fs/promises";

const BASE = (process.argv[2] || "http://localhost:3210").replace(/\/$/, "");

const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

async function checkOne(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "follow" });
  const html = await res.text();
  const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? "");
  const desc = decode(
    (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? ""
  );
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) =>
    decode(m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
  );
  const og = {
    title: /property="og:title"/.test(html),
    description: /property="og:description"/.test(html),
    image: /property="og:image"/.test(html),
    url: /property="og:url"/.test(html),
  };
  return { path, status: res.status, title, desc, h1s, og };
}

const sitemap = await readFile("public/sitemap.xml", "utf8");
const all = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const toPath = (u) => u.replace(/^https?:\/\/[^/]+/, "");

const families = {
  "/rankings/<group>": all.map(toPath).filter((p) => p.startsWith("/rankings/")).slice(0, 25),
  "/blog/<slug>": all.map(toPath).filter((p) => p.startsWith("/blog/")).slice(0, 10),
  "/watch/tv/<id>": all
    .map(toPath)
    .filter((p) => p.startsWith("/watch/tv/"))
    .slice(0, 8),
  "/movie/<id>": all.map(toPath).filter((p) => p.startsWith("/movie/")).slice(0, 8),
  "/tv/<id>": all.map(toPath).filter((p) => p.startsWith("/tv/")).slice(0, 8),
  "/watch/movie/<id>": all
    .map(toPath)
    .filter((p) => p.startsWith("/watch/movie/"))
    .slice(0, 8),
};

for (const [family, paths] of Object.entries(families)) {
  console.log(`\n=== ${family} (${paths.length})`);
  for (const p of paths) {
    let r;
    try {
      r = await checkOne(p);
    } catch (e) {
      console.log(`  ${p}  ERROR ${e.message}`);
      continue;
    }
    const problems = [];
    if (r.title.length > 60) problems.push(`title=${r.title.length}`);
    if (r.title.length < 30) problems.push(`shortTitle=${r.title.length}`);
    if (r.desc.length < 120) problems.push(`shortDesc=${r.desc.length}`);
    if (r.desc.length > 160) problems.push(`longDesc=${r.desc.length}`);
    if (r.h1s.length !== 1) problems.push(`h1=${r.h1s.length}[${r.h1s.join("|")}]`);
    if (!r.og.image) problems.push("no og:image");
    if (!r.og.title) problems.push("no og:title");
    if (!r.og.description) problems.push("no og:description");
    if (!r.og.url) problems.push("no og:url");
    console.log(
      `  ${problems.length ? "FAIL" : "ok  "} ${p}  ${problems.join(" ")}`
    );
  }
}
