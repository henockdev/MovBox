#!/usr/bin/env node
/**
 * Watches the weight of the pages a crawler has to fetch.
 *
 * The homepage used to ship **1.75 MB** of HTML: 1.47 MB of markup (the
 * repeated Tailwind class lists of ~480 movie cards) plus 268 KB of RSC
 * flight payload. It is now **0.89 MB**. The two things that got it there
 * are the shared icon sprite (components/ui/Icon.tsx) and the extracted card
 * classes (app/globals.css) — and both of them are easy to undo by accident.
 *
 * This script fails when a page grows past its budget, so a regression shows
 * up in CI rather than in a crawler.
 *
 * ## Usage
 *
 *   node scripts/verify-page-weight.mjs <base-url>
 */

const base = (process.argv[2] || "http://localhost:3210").replace(/\/$/, "");

/** [path, budget in bytes] — the budget is the page's HTML, uncompressed. */
const BUDGETS = [
  ["/", 1_100_000],
  ["/movies", 600_000],
  ["/tv", 600_000],
  ["/trending", 600_000],
  ["/most-watched", 600_000],
  ["/rankings", 500_000],
];

let failures = 0;
const rows = [];

for (const [path, budget] of BUDGETS) {
  const res = await fetch(base + path, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MovboxWeightCheck/1.0)" },
  });
  const html = await res.text();
  const bytes = Buffer.byteLength(html, "utf8");

  let flight = 0;
  const flightRe = /self\.__next_f\.push\([\s\S]*?<\/script>/g;
  let m;
  while ((m = flightRe.exec(html))) flight += Buffer.byteLength(m[0], "utf8");

  let svgs = 0;
  const svgRe = /<svg\b[\s\S]*?<\/svg>/g;
  while ((m = svgRe.exec(html))) svgs += Buffer.byteLength(m[0], "utf8");

  let classBytes = 0;
  const clsRe = /class="([^"]*)"/g;
  while ((m = clsRe.exec(html))) classBytes += m[0].length;

  const ok = bytes <= budget && res.status === 200;
  if (!ok) failures++;
  rows.push({
    path,
    status: res.status,
    bytes,
    budget,
    flight,
    svgs,
    classBytes,
    ok,
  });
}

const kb = (n) => (n / 1000).toFixed(1) + " kB";
console.log(
  "page".padEnd(16) +
    "status".padEnd(8) +
    "total".padEnd(12) +
    "budget".padEnd(12) +
    "flight".padEnd(12) +
    "svg".padEnd(12) +
    "classes"
);
for (const r of rows) {
  console.log(
    r.path.padEnd(16) +
      String(r.status).padEnd(8) +
      kb(r.bytes).padEnd(12) +
      kb(r.budget).padEnd(12) +
      kb(r.flight).padEnd(12) +
      kb(r.svgs).padEnd(12) +
      kb(r.classBytes) +
      (r.ok ? "" : "   <-- OVER BUDGET")
  );
}

if (failures) {
  console.log(`\n${failures} page(s) over budget`);
  process.exitCode = 1;
} else {
  console.log("\nall pages within budget");
}
