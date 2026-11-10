// Probe the two structural questions the audit raises:
//   1. what do the /genres/<id> pages actually serve?
//   2. where can episode links be server-rendered from?
//
// Usage: node scripts/probe-audit-surfaces.mjs [baseUrl]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");

console.log("=== 1. /genres/<id>");
for (const id of ["12", "16", "35"]) {
  const r = await fetch(`${BASE}/genres/${id}`);
  const html = await r.text();
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  const h1 = html.match(/<h1[^>]*>([\s\S]{0,80}?)<\/h1>/);
  const ogImage = /property="og:image"/.test(html);
  console.log(`  /genres/${id}  status=${r.status}  title=${JSON.stringify(title)}`);
  console.log(`      desc=${JSON.stringify(desc)} (${desc ? desc.length : 0})  h1=${h1 ? JSON.stringify(h1[1].replace(/<[^>]+>/g, "").trim()) : "-"}  og:image=${ogImage}`);
  console.log(`      looks like a 404 page: ${/not found|404|doesn.t exist/i.test(html)}`);
}
console.log("");

console.log("=== 2. /tv/<id> — what does the series page link to?");
const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
const seriesUrl = locs.find((u) => /\/tv\/[^?]+$/.test(u));
console.log(`  ${seriesUrl}`);
const sHtml = await (await fetch(seriesUrl)).text();
const anchors = [...sHtml.matchAll(/<a[^>]+href="([^"]+)"/g)].map((m) => m[1]);
console.log(`  total <a href>          : ${anchors.length}`);
const watch = anchors.filter((h) => h.includes("/watch/"));
console.log(`  -> /watch/*             : ${watch.length}`);
for (const h of [...new Set(watch)].slice(0, 6)) console.log(`       ${h}`);
console.log(`  'Episode' buttons/links  : ${(sHtml.match(/Episode/gi) || []).length}`);
console.log(`  season labels            : ${(sHtml.match(/Season [0-9]/gi) || []).length}`);
console.log("");

console.log("=== 3. the watch page — is there any episode list at all?");
const epUrl = locs.find((u) => u.includes("/watch/tv/"));
console.log(`  ${epUrl}`);
const wHtml = await (await fetch(epUrl)).text();
const wAnchors = [...wHtml.matchAll(/<a[^>]+href="([^"]+)"/g)].map((m) => m[1]);
const wWatch = [...new Set(wAnchors.filter((h) => h.includes("/watch/tv/")))];
console.log(`  total <a href>           : ${wAnchors.length}`);
console.log(`  unique -> /watch/tv/*    : ${wWatch.length}`);
for (const h of wWatch.slice(0, 6)) console.log(`       ${h}`);
console.log(`  'Episode' mentions       : ${(wHtml.match(/Episode/gi) || []).length}`);
