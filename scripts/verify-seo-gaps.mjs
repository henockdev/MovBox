/**
 * Regression guard for the SEO band.
 *
 * Every indexable route must answer with:
 *   - a rendered <title> between 30 and 60 characters (the root layout
 *     appends " | Movbox", so the template title is capped at 51)
 *   - a meta description between 120 and 160 characters
 *   - EXACTLY ONE <h1> (three on the watch pages was a real finding: the
 *     loader rendered its own heading on top of the page's)
 *   - og:title, og:description, og:image and og:url
 *
 * The sample is drawn from the committed sitemap, so it covers the same
 * URLs a crawler would.
 *
 * Usage: node scripts/verify-seo-gaps.mjs [baseUrl] [samplePerFamily]
 */

import { readFile } from "node:fs/promises";

const BASE = (process.argv[2] || "http://localhost:3210").replace(/\/$/, "");
const SAMPLE = Number(process.argv[3] || 12);

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
// A <loc> is XML, so "&" arrives as "&amp;". Crawlers unescape it; so must
// we, or every episode URL loses its ?s=&e= parameters.
const all = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
  decode(m[1])
);
const paths = all.map((u) => u.replace(/^https?:\/\/[^/]+/, ""));

const families = [
  ["/", (p) => p === "/"],
  ["/movies", (p) => p === "/movies"],
  ["/tv", (p) => p === "/tv"],
  ["/trending", (p) => p === "/trending"],
  ["/most-watched", (p) => p === "/most-watched"],
  ["/genres", (p) => p === "/genres" || p.startsWith("/genres/")],
  ["/rankings", (p) => p === "/rankings" || p.startsWith("/rankings/")],
  ["/category", (p) => p.startsWith("/category/")],
  ["/blog", (p) => p.startsWith("/blog/")],
  ["/movie/<id>", (p) => p.startsWith("/movie/")],
  ["/tv/<id>", (p) => p.startsWith("/tv/")],
  ["/watch/movie/<id>", (p) => p.startsWith("/watch/movie/")],
  ["/watch/tv/<id>", (p) => p.startsWith("/watch/tv/")],
];

let passed = 0;
let failed = 0;
const failures = [];

for (const [name, match] of families) {
  const urls = paths.filter(match).slice(0, SAMPLE);
  if (!urls.length) {
    console.log(`  ??  ${name} — no URLs in the sitemap`);
    continue;
  }
  for (const p of urls) {
    let r;
    try {
      r = await checkOne(p);
    } catch (e) {
      failed += 1;
      failures.push(`${p} — request failed: ${e.message}`);
      continue;
    }
    const problems = [];
    if (r.status !== 200) problems.push(`status=${r.status}`);
    if (r.title.length > 60) problems.push(`longTitle=${r.title.length}`);
    if (r.title.length < 30) problems.push(`shortTitle=${r.title.length}`);
    if (r.desc.length < 120) problems.push(`shortDesc=${r.desc.length}`);
    if (r.desc.length > 160) problems.push(`longDesc=${r.desc.length}`);
    if (r.h1s.length !== 1) problems.push(`h1=${r.h1s.length}`);
    if (!r.og.title) problems.push("no og:title");
    if (!r.og.description) problems.push("no og:description");
    if (!r.og.image) problems.push("no og:image");
    if (!r.og.url) problems.push("no og:url");

    // An episode URL must title itself as that episode.
    const ep = p.match(/[?&]s=(\d+)&e=(\d+)/);
    if (ep && !r.title.includes(`Season ${ep[1]} Episode ${ep[2]}`)) {
      problems.push(
        `episodeTitleMismatch (expected "Season ${ep[1]} Episode ${ep[2]}")`
      );
    }

    if (problems.length) {
      failed += 1;
      failures.push(`${p} — ${problems.join(" ")}`);
      console.log(`  FAIL ${p}  ${problems.join(" ")}`);
    } else {
      passed += 1;
      console.log(`  ok   ${p}  "${r.title}"`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exitCode = 1;
}
