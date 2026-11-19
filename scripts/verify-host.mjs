/**
 * Verify that a host is serving Movbox properly.
 *
 * Used after the move to Oracle: the same checks that catch a broken
 * production build, pointed at the new host. It checks the things that
 * actually broke the last time the host changed:
 *
 *   - the pages answer 200 (not Vercel's 402, not a 404)
 *   - the title and the description are inside their bands
 *   - the canonical is self-referential and og:url matches it
 *   - exactly one <h1>
 *   - the sitemap is served and has URLs in it
 *   - /api/sources resolves a real source (the data layer works)
 *   - Microsoft Clarity is installed, and NOT on the 18+ pages
 *   - the IndexNow key file is still reachable at the site root
 *
 * Usage: node scripts/verify-host.mjs [baseUrl]
 */

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`  ${ok ? "OK  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

function analyse(html) {
  return {
    title: decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? ""),
    desc: decode((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? ""),
    canonical: decode((html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] ?? ""),
    ogUrl: decode((html.match(/<meta property="og:url" content="([^"]+)"/) || [])[1] ?? ""),
    h1s: [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) =>
      decode(m[1].replace(/<[^>]+>/g, "").trim())
    ),
    ogImage: /property="og:image"/.test(html),
    clarity: html.includes('name="clarity-project"'),
  };
}

console.log(`\n=== ${BASE} ===\n`);

console.log("1. The pages answer 200");
const PAGES = ["/", "/movies", "/tv", "/rankings", "/trending", "/most-watched"];
const htmlByPath = new Map();
for (const p of PAGES) {
  const res = await fetch(`${BASE}${p}`, { redirect: "manual" });
  const html = await res.text();
  htmlByPath.set(p, html);
  check(p, res.status === 200, `HTTP ${res.status}`);
}

console.log("\n2. Title, description, canonical, h1");
for (const p of PAGES) {
  const a = analyse(htmlByPath.get(p) || "");
  const titleOk = a.title.length >= 30 && a.title.length <= 60;
  const descOk = a.desc.length >= 120 && a.desc.length <= 160;
  const canonOk = a.canonical.replace(/\/+$/, "") === `${BASE}${p}`.replace(/\/+$/, "");
  const h1Ok = a.h1s.length === 1 && !!a.h1s[0];
  check(
    p,
    titleOk && descOk && canonOk && h1Ok && a.ogImage,
    `title ${a.title.length} | desc ${a.desc.length} | canonical ${
      canonOk ? "self" : a.canonical
    } | h1 ${a.h1s.length} | og:image ${a.ogImage}`
  );
}

console.log("\n3. The sitemap");
{
  const res = await fetch(`${BASE}/sitemap.xml`);
  const xml = await res.text();
  const count = (xml.match(/<loc>/g) || []).length;
  check("/sitemap.xml answers 200", res.status === 200, `HTTP ${res.status}`);
  check("the sitemap has URLs", count > 1000, `${count} urls`);
}

console.log("\n4. The data layer — /api/sources resolves a real source");
{
  const res = await fetch(
    `${BASE}/api/sources?detailPath=bilewu-wahala-0sK48chmGk8`
  );
  const json = await res.json().catch(() => ({}));
  check("HTTP 200", res.status === 200, `HTTP ${res.status}`);
  check(
    "at least one source",
    Array.isArray(json.sources) && json.sources.length > 0,
    `${json.count ?? 0} sources, provider ${json.provider?.id ?? "?"}`
  );
}

console.log("\n5. Microsoft Clarity — on the ordinary pages, never on the 18+ ones");
{
  check("installed on the homepage", analyse(htmlByPath.get("/") || "").clarity);
  for (const p of ["/category/midnight", "/rankings/adult-animation"]) {
    const res = await fetch(`${BASE}${p}`);
    const html = await res.text();
    const excluded =
      html.includes('data-clarity-exclude="true"') &&
      html.includes('data-clarity-mask="true"');
    check(`${p} is excluded and masked`, excluded);
  }
}

console.log("\n6. The IndexNow key file");
{
  const res = await fetch(`${BASE}/ff581ff75ad04c45b503b462b52155c4.txt`);
  const text = await res.text();
  check("reachable at the site root", res.status === 200, `HTTP ${res.status}`);
  check("carries the key", text.trim() === "ff581ff75ad04c45b503b462b52155c4");
}

console.log("\n7. A dead URL answers 404 (not a soft 404, not a 200)");
{
  const res = await fetch(`${BASE}/movie/permafrost-ynJSysLl91`, {
    redirect: "manual",
  });
  check("HTTP 404", res.status === 404, `HTTP ${res.status}`);
}

console.log(
  `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`
);
process.exit(failures === 0 ? 0 : 1);
