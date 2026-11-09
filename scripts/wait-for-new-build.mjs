// Wait until the NEW build is actually live.
//
// `wait-for-deploy.mjs` only checks that the routes answer 200, which the
// previous build does too - it reported "DEPLOYED" for a build that was still
// an hour old. This polls for a marker that exists ONLY in the new code:
// the Ahrefs <script> tag in the server-rendered <head>.
//
// Usage: node scripts/wait-for-new-build.mjs [baseUrl] [maxMinutes]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const MAX_MINUTES = Number(process.argv[3] || 30);

const started = Date.now();
const deadline = started + MAX_MINUTES * 60_000;

const MARKERS = [
  {
    name: "Ahrefs analytics <script> in the head",
    test: (html) =>
      /<script[^>]*src="https:\/\/analytics\.ahrefs\.com\/analytics\.js"[^>]*>/.test(
        html.slice(0, html.indexOf("</head>"))
      ),
  },
  {
    name: "HeroBanner scroll track",
    test: (html) => html.includes("snap-mandatory") && html.includes("aria-label=\"Show "),
  },
  {
    name: "Ranking shelf chips",
    test: (html) => html.includes("aria-pressed=") && html.includes("See all rankings"),
  },
];

let attempt = 0;
while (Date.now() < deadline) {
  attempt++;
  try {
    const res = await fetch(`${BASE}/movies`, {
      headers: { "Cache-Control": "no-cache" },
    });
    const html = await res.text();
    const results = MARKERS.map((m) => ({ name: m.name, ok: m.test(html) }));
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
    console.log(`[${new Date().toISOString().slice(11, 19)}] try ${attempt}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 20000));
}

console.log(`\nTIMED OUT after ${MAX_MINUTES} minutes.`);
process.exit(1);
