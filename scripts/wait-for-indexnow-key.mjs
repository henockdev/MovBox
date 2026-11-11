/**
 * Wait until the IndexNow key file is live at the site root, and verify
 * it serves the key byte-for-byte.
 *
 * The key file must be reachable BEFORE the first IndexNow submission, or
 * the endpoint rejects the request with 403.
 *
 * Usage: node scripts/wait-for-indexnow-key.mjs [baseUrl] [maxMinutes]
 */

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const MAX_MINUTES = Number(process.argv[3] || 20);
const KEY = "ff581ff75ad04c45b503b462b52155c4";

const started = Date.now();
const deadline = started + MAX_MINUTES * 60_000;

let attempt = 0;
while (Date.now() < deadline) {
  attempt++;
  try {
    const res = await fetch(`${BASE}/${KEY}.txt`, {
      headers: { "Cache-Control": "no-cache" },
    });
    const body = await res.text();
    const trimmed = body.trim();
    const ok = res.ok && trimmed === KEY;
    console.log(
      `[${new Date().toISOString().slice(11, 19)}] try ${attempt}: HTTP ${res.status} ` +
        `content-type=${res.headers.get("content-type")} bytes=${body.length} ` +
        `match=${trimmed === KEY}`
    );
    if (ok) {
      console.log("\nTHE KEY FILE IS LIVE AND CORRECT.");
      process.exit(0);
    }
  } catch (e) {
    console.log(`[${new Date().toISOString().slice(11, 19)}] try ${attempt}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 15000));
}

console.log(`\nTIMED OUT after ${MAX_MINUTES} minutes.`);
process.exit(1);
