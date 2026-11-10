// What shape are the episode urls in the deployed sitemap?
//
// Usage: node scripts/probe-sitemap-shapes.mjs [baseUrl]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");

const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

console.log(`total locs: ${locs.length}`);
console.log("");

// Bucket by path shape.
const buckets = new Map();
for (const u of locs) {
  const path = u.replace(/^https?:\/\/[^/]+/, "");
  const shape = path
    .split("/")
    .map((seg) => {
      if (!seg) return "";
      if (seg.startsWith("?")) return "QUERY";
      if (/^\d+$/.test(seg)) return "NUM";
      if (/^[a-z]+$/i.test(seg) && seg.length < 12) return "WORD";
      return "ID";
    })
    .join("/");
  buckets.set(shape, (buckets.get(shape) ?? 0) + 1);
}
console.log("path shapes:");
for (const [shape, count] of [...buckets].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${String(count).padStart(7)}  ${shape}`);
}
console.log("");

const watchTv = locs.filter((u) => u.includes("/watch/tv/"));
console.log(`watch/tv urls: ${watchTv.length}`);
console.log("samples:");
for (const u of watchTv.slice(0, 8)) console.log(`  ${u}`);
console.log("");

const withQuery = locs.filter((u) => u.includes("?"));
console.log(`urls carrying a query string: ${withQuery.length}`);
for (const u of withQuery.slice(0, 5)) console.log(`  ${u}`);
console.log("");

const noindexLikely = locs.filter((u) =>
  /\/category\/live|\/login|\/signup|\/profile|\/watchlist/.test(u)
);
console.log(`urls that look noindex-y (live/login/signup/profile/watchlist): ${noindexLikely.length}`);
for (const u of noindexLikely) console.log(`  ${u}`);
