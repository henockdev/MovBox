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
    name: "HeroBanner scroll track",
    path: "/movies",
    test: (html) =>
      html.includes("snap-mandatory") && html.includes('aria-label="Show '),
  },
  {
    name: "Ranking shelf chips",
    path: "/movies",
    test: (html) =>
      html.includes("aria-pressed=") && html.includes("See all rankings"),
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
