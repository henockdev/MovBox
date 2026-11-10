/**
 * Bucket the audit failures by page type.
 *
 * `verify-audit-fixes.mjs` says "695 pages have no h1" but not WHICH pages.
 * This groups the sitemap by route shape and reports how many of each kind
 * miss an h1, an og tag, the title band or the description band — so the
 * fixes go to the page types that actually cause them.
 *
 * Usage: node scripts/bucket-audit-failures.mjs [baseUrl]
 */

const BASE = (process.argv[2] || "http://localhost:3210").replace(/\/+$/, "");

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

function analyse(html) {
  const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? "");
  const desc = decode(
    (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? ""
  );
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) =>
    decode(m[1].replace(/<[^>]+>/g, "").trim())
  );
  const og = {
    title: /property="og:title"/.test(html),
    description: /property="og:description"/.test(html),
    image: /property="og:image"/.test(html),
    url: /property="og:url"/.test(html),
  };
  return { title, desc, h1s, og };
}

const toPath = (u) => u.replace(/^https?:\/\/[^/]+/, "");

function kindOf(path) {
  if (path.startsWith("/watch/tv/")) return "/watch/tv/<id>";
  if (path.startsWith("/watch/movie/")) return "/watch/movie/<id>";
  if (path.startsWith("/rankings/")) return "/rankings/<group>";
  if (path.startsWith("/movie/")) return "/movie/<id>";
  if (path.startsWith("/tv/")) return "/tv/<id>";
  if (path.startsWith("/category/")) return "/category/<slug>";
  if (path.startsWith("/genres/")) return "/genres/<id>";
  if (path.startsWith("/blog/")) return "/blog/<slug>";
  return path;
}

const xml = (await (await fetch(`${BASE}/sitemap.xml`)).text());
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));
const episodes = locs.filter((u) => u.includes("/watch/tv/"));
const others = locs.filter((u) => !u.includes("/watch/tv/"));

const epSample = [];
const step = Math.max(1, Math.floor(episodes.length / 40));
for (let i = 0; i < episodes.length && epSample.length < 40; i += step) {
  epSample.push(episodes[i]);
}

// 60 of each non-episode kind, so every page type is represented.
const buckets = new Map();
for (const u of others) {
  const k = kindOf(toPath(u));
  if (!buckets.has(k)) buckets.set(k, []);
  const list = buckets.get(k);
  if (list.length < 60) list.push(u);
}

const results = new Map();

async function checkOne(url) {
  try {
    const html = await (await fetch(`${BASE}${toPath(url)}`)).text();
    const a = analyse(html);
    return {
      longTitle: a.title.length > 60,
      shortTitle: a.title.length < 30,
      shortDesc: a.desc.length < 120,
      longDesc: a.desc.length > 160,
      noH1: a.h1s.length !== 1 || !a.h1s[0],
      og:
        !a.og.title || !a.og.description || !a.og.image || !a.og.url,
    };
  } catch {
    return null;
  }
}

const all = [...buckets.entries()];
const epBucket = ["/watch/tv/<id> (sample)", epSample];

for (const [kind, urls] of [...all, epBucket]) {
  const flags = { longTitle: 0, shortTitle: 0, shortDesc: 0, longDesc: 0, noH1: 0, og: 0 };
  let n = 0;
  for (const u of urls) {
    const r = await checkOne(u);
    if (!r) continue;
    n++;
    for (const k of Object.keys(flags)) if (r[k]) flags[k]++;
  }
  results.set(kind, { n, flags });
}

const cols = ["longTitle", "shortTitle", "shortDesc", "longDesc", "noH1", "og"];
console.log(
  ["page type".padEnd(26), "checked".padStart(7), ...cols.map((c) => c.padStart(11))].join("")
);
console.log("-".repeat(26 + 7 + cols.length * 11));
for (const [kind, { n, flags }] of results) {
  console.log(
    [
      kind.padEnd(26),
      String(n).padStart(7),
      ...cols.map((c) => String(flags[c]).padStart(11)),
    ].join("")
  );
}
