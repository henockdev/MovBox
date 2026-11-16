// Wait until the NEW build is actually live.
//
// `wait-for-deploy.mjs` only checks that the routes answer 200, which the
// previous build does too - it reported "DEPLOYED" for a build that was still
// an hour old. This polls for markers that exist ONLY in the new code.
//
// Usage: node scripts/wait-for-new-build.mjs [baseUrl] [maxMinutes]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const MAX_MINUTES = Number(process.argv[3] || 30);

const started = Date.now();
const deadline = started + MAX_MINUTES * 60_000;

const MARKERS = [
  {
    name: "Ahrefs analytics <script> in the head",
    path: "/movies",
    test: (html) =>
      /<script[^>]*src="https:\/\/analytics\.ahrefs\.com\/analytics\.js"[^>]*>/.test(
        html.slice(0, html.indexOf("</head>"))
      ),
  },
  {
    // The hero slide strip lives on the HOMEPAGE, not on the browse screens.
    name: "HeroBanner scroll track",
    path: "/",
    test: (html) =>
      html.includes("snap-mandatory") &&
      html.includes('aria-label="Scroll the featured titles left"'),
  },
  {
    name: "Ranking shelf chips",
    path: "/movies",
    test: (html) =>
      html.includes("aria-pressed=") && html.includes("See all rankings"),
  },
  {
    // The ranked row must show the WHOLE group — the chip's count and the
    // number of rank badges have to agree, or the row contradicts its own
    // label. This is the marker that tells the new ranking build apart.
    name: "Ranking row shows the whole group",
    path: "/tv",
    test: (html) => {
      const chips = [
        ...html.matchAll(
          /aria-pressed="(?:true|false)"[\s\S]{0,600}?tabular-nums[^>]*>\s*(\d+)\s*</g
        ),
      ].map((m) => Number(m[1]));
      const ol = html.match(/<ol class="no-scrollbar[^"]*"[\s\S]*?<\/ol>/);
      const badges = ol
        ? [...ol[0].matchAll(/>(TOP \d+|\d+)<\/span>/g)].length
        : 0;
      return chips.length > 0 && badges === chips[0];
    },
  },
  {
    // The header search field is now a trigger for the full-screen overlay.
    name: "Header search is a trigger for the search overlay",
    path: "/",
    test: (html) =>
      html.includes('aria-label="Search Movbox"') &&
      html.includes('aria-haspopup="dialog"'),
  },
  {
    // The loader is no longer a heading, so a watch page carries one <h1>.
    name: "Watch page has a single <h1> (the loader is not a heading)",
    path: "/watch/movie/night-shift-OrzxiVFi4A4",
    test: (html) => !html.includes(">LOADING</h1>"),
  },
  {
    // The genre pages are built on the real catalogue now.
    name: "/genres/<id> is a real page",
    path: "/genres/28",
    test: (html) =>
      html.includes("Action Movies &amp; TV Shows") &&
      html.includes('property="og:image"'),
  },
  {
    // The trailer preview: each card carries the trailer button and the
    // card itself carries the trailer URL the popup plays.
    name: "Trailer preview on the cards",
    path: "/movies",
    test: (html) =>
      html.includes("Play the trailer for") && html.includes("macdn.aoneroom.com"),
  },
  {
    // The mobile nav drawer trigger in the header.
    name: "Mobile nav drawer button",
    path: "/movies",
    test: (html) =>
      html.includes('aria-label="Open the navigation menu"') &&
      html.includes('aria-haspopup="dialog"'),
  },
  {
    // The icon sprite: the card icons now point at one <symbol> per icon
    // instead of inlining their path data hundreds of times over.
    name: "Icon sprite is in use",
    path: "/",
    test: (html) =>
      html.includes('<symbol id="i-star"') && html.includes('<use href="#i-star"'),
  },
  {
    // Microsoft Clarity: the head carries the project marker, and the 18+
    // pages carry the exclusion markers. This is the marker that tells
    // the Clarity build apart from the one before it.
    name: "Microsoft Clarity is installed",
    path: "/",
    test: (html) =>
      html.includes('name="clarity-project"') &&
      html.includes('content="ze20elh5au"'),
  },
  {
    name: "The 18+ pages are excluded from Clarity",
    path: "/category/midnight",
    test: (html) =>
      html.includes('data-clarity-exclude="true"') &&
      html.includes('data-clarity-mask="true"'),
  },
  {
    // The dead-URL metadata fix: a URL whose title left the catalogue still
    // answers 404, but it now carries a title and a description inside the
    // bands instead of a stub. This is the marker that tells this build
    // apart from the one before it.
    name: "Dead URLs carry in-band metadata",
    path: "/movie/permafrost-ynJSysLl91",
    test: (html) => html.includes("The title may have left the catalogue"),
  },
];

// One fetch per distinct path, reused across the markers that need it.
const cache = new Map();
async function htmlFor(path) {
  if (!cache.has(path)) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "Cache-Control": "no-cache" },
    });
    cache.set(path, await res.text());
  }
  return cache.get(path);
}

let attempt = 0;
while (Date.now() < deadline) {
  attempt++;
  try {
    cache.clear();
    const results = [];
    for (const m of MARKERS) {
      const html = await htmlFor(m.path);
      results.push({ name: m.name, ok: m.test(html) });
    }
    const allOk = results.every((r) => r.ok);
    console.log(
      `[${new Date().toISOString().slice(11, 19)}] try ${String(attempt).padStart(3)}  ` +
        results.map((r) => `${r.ok ? "OK" : "--"} ${r.name}`).join("  |  ")
    );
    if (allOk) {
      console.log("\nNEW BUILD IS LIVE.");
      process.exit(0);
    }
  } catch (e) {
    console.log(
      `[${new Date().toISOString().slice(11, 19)}] try ${attempt}: ${e.message}`
    );
  }
  await new Promise((r) => setTimeout(r, 20000));
}

console.log(`\nTIMED OUT after ${MAX_MINUTES} minutes.`);
process.exit(1);
