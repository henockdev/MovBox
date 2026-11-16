// Duplicate title / description scan over a sample of the sitemap.
//
// Usage: node scripts/scan-duplicates.mjs [baseUrl] [samplePerType]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const PER = Number(process.argv[3] || 60);

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
  return "static";
};

const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));

const byType = {};
for (const u of urls) {
  const t = typeOf(new URL(u).pathname);
  (byType[t] ||= []).push(u);
}

// Even spread across each type.
const targets = [];
for (const [t, list] of Object.entries(byType)) {
  const step = Math.max(1, Math.floor(list.length / PER));
  for (let i = 0; i < list.length && targets.filter((u) => typeOf(new URL(u).pathname) === t).length < PER; i += step) {
    targets.push(list[i]);
  }
}

const titles = new Map();
const descs = new Map();
const results = [];

const CONC = 8;
let i = 0;
await Promise.all(
  Array.from({ length: CONC }, async () => {
    while (i < targets.length) {
      const u = targets[i++];
      try {
        // The sitemap holds absolute URLs — rewrite them onto the host under
        // test, otherwise the check measures production instead of the build.
        const local = u.replace(/^https?:\/\/[^/]+/, "");
        const res = await fetch(`${BASE}${local}`, { redirect: "manual" });
        const html = await res.text();
        const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? "");
        const desc = decode((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? "");
        const t = typeOf(new URL(u).pathname);
        if (title) {
          const prev = titles.get(title);
          if (prev) results.push({ kind: "title", t, u, title, other: prev });
          else titles.set(title, u);
        }
        if (desc) {
          const prev = descs.get(desc);
          if (prev) results.push({ kind: "desc", t, u, desc, other: prev });
          else descs.set(desc, u);
        }
      } catch {}
    }
  })
);

const groups = {};
for (const r of results) {
  const k = `${r.kind}:${r.t}`;
  (groups[k] ||= []).push(r);
}
console.log(`scanned ${targets.length} urls\n`);
if (!results.length) console.log("no duplicates found");
for (const [k, list] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`### ${k}  (${list.length} duplicate urls)`);
  for (const r of list.slice(0, 4)) {
    console.log(`    ${r.u}`);
    console.log(`      dup of ${r.other}`);
    console.log(`      "${r.title || r.desc}"`);
  }
  if (list.length > 4) console.log(`    … ${list.length - 4} more`);
  console.log("");
}
