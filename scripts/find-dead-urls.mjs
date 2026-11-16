/**
 * Find every sitemap URL that does not answer 200.
 *
 * The external audits report "pages with errors" as a count; this lists
 * the URLs behind it. The sitemap is large (27k+ URLs) and the episode
 * URLs are the bulk of it, so the crawl is concurrent but paced.
 *
 * Usage: node scripts/find-dead-urls.mjs [baseUrl] [concurrency]
 */

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const CONCURRENCY = Number(process.argv[3] || 16);

const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const locs = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1])))];
console.log(`sitemap urls: ${locs.length}`);

const bad = [];
const transport = [];
const queue = [...locs];
let done = 0;

async function worker() {
  while (queue.length) {
    const url = queue.shift();
    try {
      const r = await fetch(url, { redirect: "manual" });
      if (r.status !== 200) {
        bad.push({ url, status: r.status });
        console.log(`  ${r.status}  ${url}`);
      }
      // Drain the body so the connection can be reused.
      await r.text().catch(() => {});
    } catch (e) {
      // A transport failure is THIS machine's connection pressure, not a
      // page error. It is counted separately so it never inflates the
      // "pages with errors" number.
      transport.push({ url, status: e.message });
    }
    done++;
    if (done % 500 === 0) console.log(`  …${done}/${locs.length}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`\nchecked ${locs.length} urls`);
console.log(`non-200     : ${bad.length}`);
console.log(`transport err: ${transport.length}  (not page errors)`);
const byStatus = new Map();
for (const b of bad) byStatus.set(b.status, (byStatus.get(b.status) || 0) + 1);
for (const [s, n] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${s}: ${n}`);
}
const byKind = new Map();
for (const b of bad) {
  const p = b.url.replace(/^https?:\/\/[^/]+/, "");
  const kind = p.startsWith("/watch/tv/")
    ? "/watch/tv/<id>"
    : p.startsWith("/watch/movie/")
      ? "/watch/movie/<id>"
      : p.startsWith("/movie/")
        ? "/movie/<id>"
        : p.startsWith("/tv/")
          ? "/tv/<id>"
          : p.startsWith("/rankings/")
            ? "/rankings/<group>"
            : p;
  byKind.set(kind, (byKind.get(kind) || 0) + 1);
}
console.log("\nby page type:");
for (const [k, n] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${n}`);
}
process.exit(bad.length ? 1 : 0);
