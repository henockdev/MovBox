// Probe the subtitle pipeline end to end.
//
// 1. ask /api/sources for a title's sources + caption list
// 2. fetch every caption URL the player would use
// 3. report status, content-type, body head, and whether it parses as WebVTT
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
  process.exit(0);
}

for (const t of tracks) {
  const url = t.url.startsWith("http") ? t.url : `${BASE}${t.url}`;
  let line = `  [${String(t.language).padEnd(7)}] ${String(t.label).padEnd(12)}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const body = await r.text();
    const ct = r.headers.get("content-type") || "-";
    const isVtt = body.trimStart().startsWith("WEBVTT");
    const hasCue = /-->/.test(body);
    line += ` ${r.status} ${ct} bytes=${body.length} vtt=${isVtt} cues=${hasCue}`;
    console.log(line);
    console.log(`       head: ${JSON.stringify(body.slice(0, 110))}`);
  } catch (e) {
    console.log(line + ` FETCH FAILED ${e.message}`);
  }
}
