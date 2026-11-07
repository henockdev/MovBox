// Probe the live Movbox site for SEO signals.
//
// For each URL: title, description (and its length), canonical, robots, h1,
// and how many real title links the body carries. A page that lists URLs but
// no titles is a thin page — that is what "no impressions" looks like.

// Usage: node scripts/seo-probe.mjs [baseUrl]
// Defaults to the live site. Pass a local origin to audit a build:
//   node scripts/seo-probe.mjs http://localhost:3210
const BASE = (process.argv[2] || process.env.SEO_PROBE_BASE || "https://movbox.xyz").replace(/\/+$/, "");

const PATHS = [
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
  "/rankings/popular-series",
  "/rankings/popular-movie",
  "/category/kids",
  "/category/asian",
  "/category/western",
  "/category/nollywood",
  "/category/midnight",
  "/category/shorttv",
  "/category/music",
  "/category/live",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/profile",
  "/movie/40-dates-and-40-nights-IyIrty839T6",
  "/sitemap.xml",
  "/robots.txt",
  "/llms.txt"
];

function pick(html, re) {
  const m = html.match(re);
  return m ? m[1].trim() : "";
}

async function probe(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MovboxSEOProbe/1.0)" },
    redirect: "follow"
  });
  const html = await res.text();

  const title = pick(html, /<title>([^<]*)<\/title>/i);
  const description = pick(html, /<meta name="description" content="([^"]*)"/i);
  const canonical = pick(html, /<link rel="canonical" href="([^"]*)"/i);
  const robots = pick(html, /<meta name="robots" content="([^"]*)"/i);
  const h1 = pick(html, /<h1[^>]*>([\s\S]{0,120}?)<\/h1>/i).replace(/<[^>]+>/g, "").trim();

  // Count the distinct title links the page actually offers.
  const links = new Set();
  for (const m of html.matchAll(/href="(\/(?:movie|tv)\/[^"#?]+)"/g)) links.add(m[1]);
  // Count the visible poster links.
  const posters = (html.match(/href="\/movie\/[^"#?]+"/g) || []).length;

  return {
    path,
    status: res.status,
    finalPath: new URL(res.url).pathname,
    title,
    titleLen: title.length,
    description,
    descLen: description.length,
    canonical,
    robots,
    h1,
    titleLinks: links.size,
    posterLinks: posters,
    bytes: html.length
  };
}

const rows = [];
for (const path of PATHS) {
  try {
    rows.push(await probe(path));
  } catch (error) {
    rows.push({ path, status: 0, error: String(error.message || error) });
  }
}

console.log("path".padEnd(44), "st", "dLen", "tLen", "links", "canon", "robots");
for (const r of rows) {
  if (r.error) {
    console.log(r.path.padEnd(44), "ERR", r.error);
    continue;
  }
  console.log(
    r.path.padEnd(44),
    String(r.status).padEnd(3),
    String(r.descLen).padEnd(4),
    String(r.titleLen).padEnd(4),
    String(r.titleLinks).padEnd(5),
    (r.canonical || "-").padEnd(26),
    r.robots || "-"
  );
}

console.log("\n--- detail ---");
for (const r of rows) {
  if (r.error || r.path.startsWith("/sitemap") || r.path.startsWith("/robots")) continue;
  console.log(`\n${r.path}`);
  console.log(`  title: ${r.title}`);
  console.log(`  desc : ${r.description}`);
  console.log(`  canon: ${r.canonical}`);
  console.log(`  h1   : ${r.h1}`);
}
