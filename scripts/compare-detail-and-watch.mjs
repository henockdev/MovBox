// Compare the metadata of a title page against its own watch page.
//
// /movie/<slug> and /watch/movie/<slug> are the same content on two URLs.
// If they share a title (or a description), an audit sees a duplicate — and
// one duplicate per title is one error per page.
//
// Usage: node scripts/compare-detail-and-watch.mjs [baseUrl] [count]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const COUNT = Number(process.argv[3] || 12);

const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

async function head(url) {
  const res = await fetch(url, { redirect: "manual" });
  const html = await res.text();
  return {
    status: res.status,
    title: decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? ""),
    desc: decode((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? ""),
    canonical: decode((html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] ?? ""),
    robots: (html.match(/<meta name="robots" content="([^"]+)"/) || [])[1] ?? "",
    h1s: [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) =>
      decode(m[1].replace(/<[^>]+>/g, "").trim())
    ),
  };
}

const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));
const movies = urls.filter((u) => u.includes("/movie/") && !u.includes("/watch/"));
const tvs = urls.filter((u) => /\/tv\/[^/]+$/.test(new URL(u).pathname) && !u.includes("/watch/"));

let sameTitle = 0;
let sameDesc = 0;
let checked = 0;
const rows = [];

for (const list of [movies, tvs]) {
  const sample = list.filter((_, i) => i % Math.max(1, Math.floor(list.length / COUNT)) === 0).slice(0, COUNT);
  for (const u of sample) {
    const detail = await head(u);
    const watch = await head(u.replace("/movie/", "/watch/movie/").replace(/\/tv\//, "/watch/tv/"));
    checked++;
    const tEq = detail.title === watch.title;
    const dEq = detail.desc === watch.desc;
    if (tEq) sameTitle++;
    if (dEq) sameDesc++;
    rows.push(
      `${tEq ? "DUP-TITLE " : "         "}${dEq ? "DUP-DESC " : "         "}${detail.status}/${watch.status}  ${u}`
    );
  }
}

console.log(rows.join("\n"));
console.log(`\nchecked ${checked} pairs: ${sameTitle} same title, ${sameDesc} same description`);
