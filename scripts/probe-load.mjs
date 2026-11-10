/**
 * Load probe: fetch many dynamic pages at once and report what came back.
 *
 * The audit script reports ~70% of the dynamic pages as "no title, no h1".
 * This reproduces that pattern deliberately and prints the shape of each
 * response, so the cause can be told apart:
 *
 *   "skeleton"  -> the route's loading.tsx was flushed and the page never
 *                  rendered (the response ended with the loading shell)
 *   "notfound"  -> the page called notFound() (the upstream said 404, or the
 *                  upstream call failed)
 *   "ok"        -> a real page
 *
 * The cache buster (?n=) makes every request a COLD render.
 *
 * Usage: node scripts/probe-load.mjs [count] [concurrency]
 */

const BASE = (process.argv[2] || "http://localhost:3210").replace(/\/$/, "");
const COUNT = Number(process.argv[3] || 40);
const CONC = Number(process.argv[4] || 4);

const paths = [
  "/movie/extraction-MkIW5jq4Gwa",
  "/watch/movie/legend-of-the-white-dragon-UYKZCrlVS2a",
  "/tv/sofia-the-first-ivXHwGrFlu",
];

const urls = [];
for (let i = 0; i < COUNT; i++) {
  const base = paths[i % paths.length];
  urls.push(`${base}?n=${i}`);
}

const results = [];
let idx = 0;

async function worker() {
  while (idx < urls.length) {
    const url = urls[idx++];
    const started = Date.now();
    try {
      const res = await fetch(`${BASE}${url}`);
      const html = await res.text();
      const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/g) || []).length;
      const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
      let kind = "ok";
      if (h1 === 0) {
        kind = html.includes("NEXT_HTTP_ERROR_FALLBACK")
          ? "notfound"
          : html.includes("skeleton")
            ? "skeleton"
            : "empty";
      }
      results.push({
        url,
        status: res.status,
        ms: Date.now() - started,
        kind,
        h1,
        title: title.slice(0, 60),
        len: html.length,
      });
    } catch (e) {
      results.push({
        url,
        status: 0,
        ms: Date.now() - started,
        kind: "error",
        detail: e.message,
      });
    }
  }
}

await Promise.all(Array.from({ length: CONC }, worker));

const tally = {};
for (const r of results) {
  const key = `${r.kind}/${r.status}`;
  tally[key] = (tally[key] || 0) + 1;
}
console.log(`${COUNT} requests, concurrency ${CONC}`);
console.log(tally);
console.log(
  "slowest:",
  results
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5)
    .map((r) => `${r.ms}ms ${r.kind} ${r.url}`)
    .join("\n         ")
);
for (const r of results.filter((x) => x.kind !== "ok").slice(0, 8)) {
  console.log("  !", JSON.stringify(r));
}
