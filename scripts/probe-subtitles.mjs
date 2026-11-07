// Probe the subtitle pipeline end to end.
//
// 1. ask /api/sources for a title's sources + caption list
// 2. fetch every caption URL the player would use
// 3. report status, content-type, body head, and whether it parses as WebVTT
// 4. ASSERT every caption URL is same-origin (proxied)
//
// Step 4 is the regression guard for the production bug: a browser <track>
// always fetches in CORS mode, so a caption URL pointing at a foreign origin
// can be blocked by a preflight that does not list the allowed method. Every
// caption URL must therefore go through /api/subtitle-proxy.
//
// Usage: node scripts/probe-subtitles.mjs [baseUrl] [detailPath]

const BASE = (process.argv[2] || "http://localhost:3210").replace(/\/+$/, "");
const DETAIL = process.argv[3] || "40-dates-and-40-nights-IyIrty839T6";

const res = await fetch(
  `${BASE}/api/sources?detailPath=${encodeURIComponent(DETAIL)}`,
  { headers: { "User-Agent": "Mozilla/5.0" } }
);
const json = await res.json();

console.log(`detailPath  : ${DETAIL}`);
console.log(`provider    : ${json.provider?.id}`);
console.log(`onstream    : active=${json.onstream?.active} reason=${json.onstream?.reason}`);
console.log(`sources     : ${json.sources?.length ?? 0}`);
console.log(`captions    : ${json.captions?.length ?? 0}`);
console.log("");

const tracks = json.subtitleTracks ?? [];
if (!tracks.length) {
  console.log("NO SUBTITLE TRACKS AT ALL");
  process.exit(1);
}

// ---- assertion: every caption URL must be same-origin --------------------
const origin = new URL(BASE).origin;
const foreign = tracks.filter((t) => {
  if (!t.url.startsWith("http")) return false;
  return new URL(t.url).origin !== origin;
});
if (foreign.length) {
  console.log(
    `FAIL: ${foreign.length}/${tracks.length} caption URLs point at a foreign origin.`
  );
  console.log("      A browser <track> fetches in CORS mode; these will be blocked");
  console.log("      by a preflight that does not list the allowed method.");
  for (const f of foreign.slice(0, 3)) console.log(`      ${f.url.slice(0, 110)}`);
  console.log("      Fix: route every caption URL through /api/subtitle-proxy.\n");
} else {
  console.log(`OK: all ${tracks.length} caption URLs are same-origin (proxied).\n`);
}

let failed = 0;
for (const t of tracks) {
  const url = t.url.startsWith("http") ? t.url : `${BASE}${t.url}`;
  let line = `  [${String(t.language).padEnd(7)}] ${String(t.label).padEnd(12)}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const body = await r.text();
    const ct = r.headers.get("content-type") || "-";
    const isVtt = body.trimStart().startsWith("WEBVTT");
    const hasCue = /-->/.test(body);
    const ok = r.status === 200 && isVtt && hasCue;
    if (!ok) failed += 1;
    line += ` ${ok ? "OK  " : "FAIL"} ${r.status} ${ct} bytes=${body.length} vtt=${isVtt} cues=${hasCue}`;
    console.log(line);
    if (!ok) console.log(`       head: ${JSON.stringify(body.slice(0, 110))}`);
  } catch (e) {
    failed += 1;
    console.log(line + ` FETCH FAILED ${e.message}`);
  }
}

if (foreign.length || failed) {
  console.log(`\n${foreign.length} foreign-origin URL(s), ${failed} failed track(s).`);
  process.exit(1);
}
console.log("\nAll caption tracks load as valid WebVTT.");

