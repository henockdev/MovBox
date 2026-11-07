// Sample the live sitemap: do the URLs it lists actually resolve, and do they
// carry content? A sitemap full of dead or thin URLs teaches Google to ignore
// the whole sitemap.

const BASE = "https://movbox.xyz";

const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`sitemap urls: ${urls.length}`);

// A spread across the whole file — head, tail and evenly spaced middles.
const step = Math.max(1, Math.floor(urls.length / 40));
const sample = [];
for (let i = 0; i < urls.length; i += step) sample.push(urls[i]);
sample.push(urls[urls.length - 1]);

const rows = [];
for (const url of sample) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MovboxSEOAudit/1.0)" },
      redirect: "manual"
    });
    const html = await res.text();
    const title = (html.match(/<title>([^<]*)<\/title>/i) || [, ""])[1].trim();
    const desc = (html.match(/<meta name="description" content="([^"]*)"/i) || [, ""])[1].trim();
    const robots = (html.match(/<meta name="robots" content="([^"]*)"/i) || [, ""])[1].trim();
    const h1 = (html.match(/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/i) || [, ""])[1]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const links = new Set(
      [...html.matchAll(/href="(\/(?:movie|tv)\/[^"#?]+)"/g)].map((m) => m[1])
    ).size;
    const jsonLd = (html.match(/application\/ld\+json/g) || []).length;
    rows.push({
      path: url.replace(BASE, ""),
      status: res.status,
      descLen: desc.length,
      titleLen: title.length,
      links,
      h1Len: h1.length,
      jsonLd,
      robots,
      title,
      desc
    });
  } catch (error) {
    rows.push({ path: url.replace(BASE, ""), status: 0, desc: String(error.message) });
  }
}

console.log("\nstatus  descLen  titleLen  links  h1Len  jsonLd  path");
for (const r of rows) {
  console.log(
    String(r.status).padEnd(7),
    String(r.descLen).padEnd(8),
    String(r.titleLen).padEnd(9),
    String(r.links).padEnd(6),
    String(r.h1Len).padEnd(6),
    String(r.jsonLd).padEnd(7),
    r.path
  );
}

const dead = rows.filter((r) => r.status !== 200);
const thin = rows.filter((r) => r.status === 200 && r.links < 5);
const shortDesc = rows.filter((r) => r.status === 200 && r.descLen < 70);
console.log(
  `\nsampled ${rows.length} | dead ${dead.length} | thin(<5 title links) ${thin.length} | short desc(<70) ${shortDesc.length}`
);
for (const r of thin.slice(0, 12)) {
  console.log(`  THIN  ${r.path} links=${r.links} title="${r.title}" desc="${r.desc}"`);
}
