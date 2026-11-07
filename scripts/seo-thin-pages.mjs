// Look at the listing pages that may be rendering empty, and count every kind
// of internal link each one carries.

const BASE = "https://movbox.xyz";

const PATHS = ["/trending", "/genres", "/category/live", "/movies", "/tv", "/most-watched", "/blog", "/movbox-app"];

for (const path of PATHS) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MovboxSEOAudit/1.0)" }
  });
  const html = await res.text();

  const kinds = {};
  for (const m of html.matchAll(/href="(\/(?:movie|tv|genres\/[\w-]+|blog\/[\w-]+|watch\/[a-z]+\/[^"#?]+)[^"]*)"/g)) {
    const key = m[1].startsWith("/genres/") ? "/genres/<id>"
      : m[1].startsWith("/blog/") ? "/blog/<slug>"
      : m[1].startsWith("/watch/") ? "/watch/<title>"
      : m[1].startsWith("/movie/") ? "/movie/<id>"
      : m[1].startsWith("/tv/") ? "/tv/<id>"
      : m[1];
    kinds[key] = (kinds[key] || 0) + 1;
  }

  // Does the body actually contain title text, or only the shell?
  const headings = [...html.matchAll(/<h2[^>]*>([\s\S]{0,80}?)<\/h2>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  console.log(`\n${path}  (${html.length} bytes)`);
  console.log(`  links: ${JSON.stringify(kinds)}`);
  console.log(`  h2s  : ${headings.slice(0, 8).join(" | ") || "(none)"}`);
}
