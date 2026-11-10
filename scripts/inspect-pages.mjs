/**
 * Check a handful of URLs and print what the document actually says.
 *
 * Usage: node scripts/inspect-pages.mjs <path> [...]
 */

const BASE = (process.argv[2] || "http://localhost:3210").replace(/\/$/, "");
const paths = process.argv.slice(3);

for (const p of paths) {
  const res = await fetch(`${BASE}${p}`);
  const html = await res.text();
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? "";
  const desc =
    (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? "";
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").trim()
  );
  const canonical =
    (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] ?? "";
  const robots =
    (html.match(/<meta name="robots" content="([^"]*)"/) || [])[1] ?? "(indexable)";
  console.log(`\n${p}`);
  console.log(`  status   ${res.status}`);
  console.log(`  title    ${title} (${title.length})`);
  console.log(`  desc     ${desc} (${desc.length})`);
  console.log(`  h1       ${JSON.stringify(h1s)}`);
  console.log(`  canonical ${canonical}`);
  console.log(`  robots   ${robots}`);
  console.log(`  og:image ${/property="og:image"/.test(html)}`);
}
