// Compare the two URL shapes for the same episode:
//
//   /watch/tv/<id>/1/1        (path segments)
//   /watch/tv/<id>?s=1&e=1    (query string)
//
// The site serves both. If they answer 200 with the same title, the same
// description and the same canonical, a crawler sees the same episode twice.
//
// Usage: node scripts/compare-episode-url-shapes.mjs [baseUrl] [count]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const COUNT = Number(process.argv[3] || 8);

const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

async function head(url) {
  const res = await fetch(url, { redirect: "manual" });
  const html = await res.text();
  return {
    status: res.status,
    location: res.headers.get("location"),
    title: decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? ""),
    desc: decode((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? ""),
    canonical: decode((html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] ?? ""),
    robots: (html.match(/<meta name="robots" content="([^"]+)"/) || [])[1] ?? "",
  };
}

const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));
const eps = urls.filter((u) => u.includes("/watch/tv/"));
const step = Math.max(1, Math.floor(eps.length / COUNT));

let same = 0;
let checked = 0;
for (let i = 0; i < eps.length && checked < COUNT; i += step) {
  const u = eps[i];
  const p = new URL(u);
  const id = p.pathname.split("/").filter(Boolean)[2];
  const pathShape = `${BASE}/watch/tv/${id}/1/1`;
  const queryShape = `${BASE}/watch/tv/${id}?s=1&e=1`;
  const a = await head(pathShape);
  const b = await head(queryShape);
  checked++;
  const tEq = a.title === b.title;
  const dEq = a.desc === b.desc;
  if (tEq && dEq) same++;
  console.log(
    `${tEq ? "SAME-TITLE " : "           "}${dEq ? "SAME-DESC " : "          "}` +
      `path=${a.status} query=${b.status}  ${id}\n` +
      `   path  canon=${a.canonical} robots=${a.robots}\n` +
      `   query canon=${b.canonical} robots=${b.robots}`
  );
}
console.log(`\nchecked ${checked}: ${same} pairs share BOTH title and description`);
