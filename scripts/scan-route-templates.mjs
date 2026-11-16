// Scan the sitemap's NON-title routes for systematic SEO errors.
//
// The title routes (/movie/, /tv/, /watch/) are thousands of near-identical
// pages; any error there would be one per page. The interesting ones are the
// hand-written route types — categories, genres, rankings, blog, static —
// because a mistake in one template hits every page of that type at once.
//
// Usage: node scripts/scan-route-templates.mjs [baseUrl]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");

const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

const typeOf = (p) => {
  if (p.startsWith("/category/")) return "category";
  if (p.startsWith("/genres/")) return "genres";
  if (p.startsWith("/rankings/")) return "rankings";
  if (p.startsWith("/blog/")) return "blog";
  if (p.startsWith("/watch/tv/")) return "watch-tv";
  if (p.startsWith("/watch/movie/")) return "watch-movie";
  if (p.startsWith("/movie/")) return "movie";
  if (p.startsWith("/tv/")) return "tv";
  if (p.startsWith("/movies/")) return "movies";
  return "static";
};

const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));

const byType = {};
for (const u of urls) {
  const t = typeOf(new URL(u).pathname);
  (byType[t] ||= []).push(u);
}
console.log("sitemap composition:");
for (const [t, list] of Object.entries(byType)) console.log(`  ${t.padEnd(12)} ${list.length}`);

// Check EVERY url of the hand-written route types, and a sample of the rest.
const FULL = ["category", "genres", "rankings", "blog", "static"];
const targets = [];
for (const [t, list] of Object.entries(byType)) {
  if (FULL.includes(t)) targets.push(...list);
}
console.log(`\nchecking ${targets.length} route-template urls\n`);

const problems = [];
const seenTitle = new Map();
const seenDesc = new Map();

async function check(url) {
  let res, html;
  try {
    // The sitemap holds absolute URLs — rewrite them onto the host under
    // test, otherwise the check measures production instead of the build.
    const local = url.replace(/^https?:\/\/[^/]+/, "");
    res = await fetch(`${BASE}${local}`, { redirect: "manual" });
    html = await res.text();
  } catch (e) {
    problems.push(`${url} -> FETCH ${e.message}`);
    return;
  }
  const t = typeOf(new URL(url).pathname);
  if (res.status >= 300) {
    problems.push(`${t}: ${url} -> HTTP ${res.status}`);
    return;
  }
  const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? "");
  const desc = decode((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? "");
  const canonical = decode((html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] ?? "");
  const ogUrl = decode((html.match(/<meta property="og:url" content="([^"]+)"/) || [])[1] ?? "");
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) =>
    decode(m[1].replace(/<[^>]+>/g, "").trim())
  );
  const robots = (html.match(/<meta name="robots" content="([^"]+)"/) || [])[1] ?? "";
  const noindex = /noindex/i.test(robots);

  if (title.length < 30) problems.push(`${t}: title ${title.length} "${title}"  ${url}`);
  if (title.length > 60) problems.push(`${t}: title ${title.length} "${title}"  ${url}`);
  if (desc.length < 120) problems.push(`${t}: desc ${desc.length}  ${url}`);
  if (desc.length > 160) problems.push(`${t}: desc ${desc.length}  ${url}`);
  if (h1s.length !== 1) problems.push(`${t}: h1 count ${h1s.length}  ${url}`);
  if (!canonical) problems.push(`${t}: no canonical  ${url}`);
  else if (canonical.replace(/\/+$/, "") !== url.replace(/\/+$/, "")) {
    problems.push(`${t}: canonical != url -> ${canonical}  ${url}`);
  }
  if (ogUrl && ogUrl.replace(/\/+$/, "") !== url.replace(/\/+$/, "")) {
    problems.push(`${t}: og:url != url -> ${ogUrl}  ${url}`);
  }
  if (noindex) problems.push(`${t}: NOINDEX  ${url}`);
  if (!html.includes('property="og:image"')) problems.push(`${t}: no og:image  ${url}`);

  const dup = seenTitle.get(title);
  if (dup) problems.push(`${t}: DUPLICATE title (also ${dup}) "${title}"  ${url}`);
  else seenTitle.set(title, url);
  const dupd = seenDesc.get(desc);
  if (dupd) problems.push(`${t}: DUPLICATE description (also ${dupd})  ${url}`);
  else seenDesc.set(desc, url);
}

const CONC = 6;
let i = 0;
await Promise.all(
  Array.from({ length: CONC }, async () => {
    while (i < targets.length) {
      await check(targets[i++]);
    }
  })
);

console.log(`problems: ${problems.length}`);
const byKind = {};
for (const p of problems) {
  const k = p.replace(/^[^:]*: /, "").replace(/\d+(\.\d+)?/g, "N").split("  ")[0];
  (byKind[k] ||= []).push(p);
}
for (const [k, list] of Object.entries(byKind)) {
  console.log(`\n### ${k}  (${list.length})`);
  for (const p of list.slice(0, 6)) console.log(`    ${p}`);
  if (list.length > 6) console.log(`    … ${list.length - 6} more`);
}
