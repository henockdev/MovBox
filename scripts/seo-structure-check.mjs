// Structural SEO / GEO audit of the rendered pages.
//
// The seo-probe.mjs script reads <title>, <meta description> and
// <link rel=canonical>. This one checks the things that decide whether a
// page can be *understood* rather than merely *listed*:
//
//   - which JSON-LD blocks are present (and whether they parse)
//   - whether og:url agrees with the canonical
//   - whether the header navigation actually links to the new routes
//   - whether the title/description are duplicated across pages
//   - whether robots.txt and llms.txt say what they should
//
// Usage: node scripts/seo-structure-check.mjs [baseUrl]

const BASE = (process.argv[2] || process.env.SEO_PROBE_BASE || "https://movbox.xyz").replace(/\/+$/, "");

const PAGES = [
  "/",
  "/movies",
  "/tv",
  "/animations",
  "/trending",
  "/most-watched",
  "/genres",
  "/blog",
  "/movbox-app",
  "/rankings",
  "/rankings/popular-series",
  "/rankings/anime-english-dubbed",
  "/category/kids",
  "/category/midnight",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/movie/40-dates-and-40-nights-IyIrty839T6"
];

function pick(html, re) {
  const m = html.match(re);
  return m ? m[1].trim() : "";
}

function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchHtml(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MovboxSEOStruct/1.0)" },
    redirect: "follow"
  });
  return { status: res.status, html: await res.text() };
}

const rows = [];
const titles = new Map();
const descriptions = new Map();
const problems = [];

for (const path of PAGES) {
  let res;
  try {
    res = await fetchHtml(path);
  } catch (error) {
    problems.push(`${path}: FETCH FAILED ${error.message}`);
    continue;
  }
  const { status, html } = res;

  const title = decode(pick(html, /<title>([^<]*)<\/title>/i));
  const description = decode(pick(html, /<meta name="description" content="([^"]*)"/i));
  const canonical = pick(html, /<link rel="canonical" href="([^"]*)"/i);
  const ogUrl = pick(html, /<meta property="og:url" content="([^"]*)"/i);
  const ogTitle = decode(pick(html, /<meta property="og:title" content="([^"]*)"/i));
  const robots = pick(html, /<meta name="robots" content="([^"]*)"/i);
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    decode(m[1].replace(/<[^>]+>/g, "").trim())
  );

  // JSON-LD blocks
  const ldTypes = [];
  let ldBroken = 0;
  for (const m of html.matchAll(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const parsed = JSON.parse(m[1]);
      // A block is either one typed node, or an @graph of typed nodes.
      const nodes = Array.isArray(parsed["@graph"])
        ? parsed["@graph"]
        : [parsed];
      for (const node of nodes) {
        const t = node?.["@type"];
        if (!t) continue;
        ldTypes.push(Array.isArray(t) ? t.join("+") : String(t));
      }
    } catch {
      ldBroken += 1;
    }
  }

  if (status !== 200) problems.push(`${path}: HTTP ${status}`);
  if (!title) problems.push(`${path}: MISSING TITLE`);
  if (!description) problems.push(`${path}: MISSING DESCRIPTION`);
  if (!canonical) problems.push(`${path}: MISSING CANONICAL`);
  if (canonical && ogUrl && canonical !== ogUrl) {
    problems.push(`${path}: og:url ${ogUrl} != canonical ${canonical}`);
  }
  if (title && title.endsWith("| Movbox | Movbox")) {
    problems.push(`${path}: DUPLICATE BRAND SUFFIX — "${title}"`);
  }
  if (title.length > 65) problems.push(`${path}: title ${title.length} chars (>65)`);
  if (description.length > 175) {
    problems.push(`${path}: description ${description.length} chars (>175)`);
  }
  if (description.length < 70) {
    problems.push(`${path}: description ${description.length} chars (<70) too thin`);
  }
  if (h1s.length !== 1) problems.push(`${path}: ${h1s.length} <h1> tags`);
  if (ldBroken) problems.push(`${path}: ${ldBroken} unparseable JSON-LD block(s)`);

  if (title) {
    if (titles.has(title)) problems.push(`${path}: duplicate title with ${titles.get(title)}`);
    else titles.set(title, path);
  }
  if (description) {
    if (descriptions.has(description)) {
      problems.push(`${path}: duplicate description with ${descriptions.get(description)}`);
    } else {
      descriptions.set(description, path);
    }
  }

  rows.push({
    path,
    status,
    title,
    titleLen: title.length,
    descLen: description.length,
    canonical,
    ogUrl,
    ogTitle,
    robots,
    h1: h1s.join(" | "),
    ld: ldTypes.join(",") || "-",
    bytes: html.length
  });
}

console.log(
  "path".padEnd(44),
  "st",
  "tLen",
  "dLen",
  "ld",
  "robots".padEnd(18),
  "h1"
);
for (const r of rows) {
  console.log(
    r.path.padEnd(44),
    String(r.status).padEnd(2),
    String(r.titleLen).padEnd(4),
    String(r.descLen).padEnd(4),
    String(r.ld).padEnd(26),
    (r.robots || "-").padEnd(18),
    (r.h1 || "-").slice(0, 40)
  );
}

// ---- header navigation --------------------------------------------------
console.log("\n--- navigation ---");
{
  const { html } = await fetchHtml("/");
  const headerEnd = html.indexOf("</header>");
  const navBlock = headerEnd > 0 ? html.slice(0, headerEnd) : html;
  const footerStart = html.indexOf("<footer");
  const footerBlock =
    footerStart > 0 ? html.slice(footerStart, html.indexOf("</footer>")) : "";

  // The owner asked for Trending in the header nav; Rankings went with it.
  // Both must be in the <header> itself, not only in the footer.
  for (const target of ["/trending", "/rankings", "/movies", "/tv"]) {
    const inHeader = navBlock.includes(`href="${target}"`);
    console.log(`  header  ${target.padEnd(12)} ${inHeader ? "YES" : "no"}`);
    if (!inHeader) problems.push(`/ : ${target} is not linked in the header`);
  }
  // The legal/company pages live in the footer — that is enough.
  for (const target of ["/about", "/contact", "/privacy", "/terms"]) {
    const where = navBlock.includes(`href="${target}"`)
      ? "header"
      : footerBlock.includes(`href="${target}"`)
        ? "footer"
        : "NO";
    console.log(`  footer  ${target.padEnd(12)} ${where}`);
    if (where === "NO") problems.push(`/ : ${target} is not linked anywhere`);
  }

  // llms.txt discovery
  const llmsLink = /<link[^>]+rel="llms-txt"[^>]*href="([^"]+)"/i.exec(html);
  console.log(`  llms-txt link: ${llmsLink ? llmsLink[1] : "MISSING"}`);
  if (!llmsLink) problems.push("/ : no <link rel=\"llms-txt\"> in the head");
}

// ---- robots.txt ---------------------------------------------------------
console.log("\n--- robots.txt ---");
{
  const res = await fetch(`${BASE}/robots.txt`);
  const text = await res.text();
  console.log(text.trim());
  for (const need of ["Sitemap:", "llms.txt"]) {
    if (!text.includes(need)) problems.push(`/robots.txt: missing "${need}"`);
  }
}

// ---- llms.txt -----------------------------------------------------------
console.log("\n--- llms.txt (first 20 lines) ---");
{
  const res = await fetch(`${BASE}/llms.txt`);
  const text = await res.text();
  console.log(
    text
      .trim()
      .split("\n")
      .slice(0, 20)
      .join("\n")
  );
  console.log(`\n  [${text.length} bytes total]`);
  if (!text.includes("# Movbox")) problems.push("/llms.txt: missing the H1 header");
}

// ---- verdict ------------------------------------------------------------
console.log("\n================ PROBLEMS ================");
if (!problems.length) {
  console.log("  none");
} else {
  for (const p of problems) console.log("  - " + p);
  console.log(`\n  ${problems.length} problem(s)`);
}
