// Find the exact URLs behind the Ahrefs audit's warnings.
//
// The audit reported, against 5 007 crawled internal urls:
//   errors    4 377  (orphan 4 374, noindex-in-sitemap 2, page > 2 MB 1)
//   warnings    430  (desc too short 244, title too long 76, og incomplete 38,
//                    title too short 28, h1 missing 27, slow 6, 3xx 3)
//
// This re-applies the same checks to the real sitemap so the failures can be
// listed by URL, not by count.
//
// Usage: node scripts/audit-url-quality.mjs [baseUrl] [sampleSize]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const SAMPLE = Number(process.argv[3] || 600);

const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));

const episodes = locs.filter((u) => u.includes("/watch/tv/"));
const others = locs.filter((u) => !u.includes("/watch/tv/"));

// Every non-episode url, plus an evenly spread sample of the episodes.
const episodeSample = [];
if (episodes.length) {
  const step = Math.max(1, Math.floor(episodes.length / Math.min(SAMPLE, episodes.length)));
  for (let i = 0; i < episodes.length && episodeSample.length < SAMPLE; i += step) {
    episodeSample.push(episodes[i]);
  }
}
const targets = [...others, ...episodeSample];
console.log(`sitemap urls      : ${locs.length}`);
console.log(`episode urls      : ${episodes.length}`);
console.log(`non-episode urls  : ${others.length}`);
console.log(`checking          : ${targets.length}`);
console.log("");

const problems = {
  "title too long (>60)": [],
  "title too short (<30)": [],
  "description too short (<100)": [],
  "description too long (>160)": [],
  "h1 missing or empty": [],
  "og incomplete": [],
  "no canonical": [],
  "noindex": [],
  "canonical != url": [],
  "http >= 300": [],
};

const titleLens = [];
const descLens = [];
let bytesTotal = 0;
let over2mb = [];

let done = 0;
const CONCURRENCY = 12;

async function check(url) {
  try {
    const r = await fetch(url, { redirect: "manual" });
    const html = await r.text();
    bytesTotal += html.length;

    if (r.status >= 300) {
      problems["http >= 300"].push(`${url} -> ${r.status}`);
      return;
    }
    if (html.length > 2 * 1024 * 1024) over2mb.push(`${url} (${(html.length / 1048576).toFixed(2)} MB)`);

    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    const ogTitle = (html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1];
    const ogDesc = (html.match(/<meta property="og:description" content="([^"]*)"/) || [])[1];
    const ogImage = (html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1];
    const ogUrl = (html.match(/<meta property="og:url" content="([^"]*)"/) || [])[1];
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, "").trim()
    );
    const noindex = /name="robots"[^>]*content="[^"]*noindex/i.test(html);

    if (title) {
      const len = title.length;
      titleLens.push(len);
      if (len > 60) problems["title too long (>60)"].push(`${url}\n        "${title}" (${len})`);
      if (len < 30) problems["title too short (<30)"].push(`${url}\n        "${title}" (${len})`);
    }
    if (desc) {
      const len = desc.length;
      descLens.push(len);
      if (len < 100) problems["description too short (<100)"].push(`${url}\n        "${desc}" (${len})`);
      if (len > 160) problems["description too long (>160)"].push(`${url}\n        "${desc}" (${len})`);
    }
    if (!canonical) problems["no canonical"].push(url);
    else if (canonical.replace(/&amp;/g, "&") !== url) {
      const rel = canonical.includes("/watch/tv/");
      problems["canonical != url"].push(
        `${url}\n        -> ${canonical}${rel ? "   (episode base)" : ""}`
      );
    }
    if (!ogTitle || !ogDesc || !ogImage || !ogUrl) {
      const missing = [
        !ogTitle && "og:title",
        !ogDesc && "og:description",
        !ogImage && "og:image",
        !ogUrl && "og:url",
      ].filter(Boolean);
      problems["og incomplete"].push(`${url}\n        missing ${missing.join(", ")}`);
    }
    if (h1s.length === 0 || h1s.every((h) => !h)) {
      problems["h1 missing or empty"].push(url);
    }
    if (noindex) problems["noindex"].push(url);
  } catch (e) {
    problems["http >= 300"].push(`${url} -> ${e.message}`);
  }
}

const queue = [...targets];
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const url = queue.shift();
    await check(url);
    done++;
    if (done % 100 === 0) console.log(`  …${done}/${targets.length}`);
  }
});
await Promise.all(workers);

console.log("");
console.log("=================== RESULTS ===================");
for (const [name, list] of Object.entries(problems)) {
  if (!list.length) continue;
  console.log(`\n${name}  (${list.length})`);
  for (const item of list.slice(0, 12)) console.log(`    ${item}`);
  if (list.length > 12) console.log(`    … ${list.length - 12} more`);
}
if (over2mb.length) {
  console.log(`\npage > 2 MB  (${over2mb.length})`);
  for (const item of over2mb) console.log(`    ${item}`);
}

const avg = (a) => (a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : "-");
console.log("");
console.log(`title length     : avg ${avg(titleLens)}  min ${Math.min(...titleLens)}  max ${Math.max(...titleLens)}`);
console.log(`description len  : avg ${avg(descLens)}  min ${Math.min(...descLens)}  max ${Math.max(...descLens)}`);
console.log(`avg page bytes   : ${Math.round(bytesTotal / targets.length)}`);
