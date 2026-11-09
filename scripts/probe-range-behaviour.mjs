// What does the relay do with the EXACT range requests a browser media
// element sends, and do those connections survive long enough to watch a film?
//
// Chrome's media pipeline sends:
//   1. GET Range: bytes=0-                       (initial probe)
//   2. GET Range: bytes=0-                       (open ended, reads until it has enough)
//   3. GET Range: bytes=<buffered>-<buffered+N>  (on demand)
// and if the server answers 206 with Content-Range: bytes 0-1/… to the
// open-ended request, the element believes the resource is 2 bytes long.
//
// This also measures how long one open-ended connection stays alive and
// whether it dies mid-stream (a dropped connection is what makes a media
// element fire `error` instead of `waiting`).
//
// Usage: node scripts/probe-range-behaviour.mjs [baseUrl] [detailPath]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const DETAIL = process.argv[3] || "40-dates-and-40-nights-IyIrty839T6";

const res = await fetch(`${BASE}/api/sources?detailPath=${encodeURIComponent(DETAIL)}`);
const json = await res.json();
const sources = json.sources ?? [];
if (!sources.length) {
  console.log("no sources");
  process.exit(1);
}

function show(label, r) {
  console.log(`  ${label}`);
  console.log(`     status       : ${r.status}`);
  console.log(`     content-range: ${r.headers.get("content-range")}`);
  console.log(`     content-length: ${r.headers.get("content-length")}`);
  console.log(`     content-type : ${r.headers.get("content-type")}`);
  console.log(`     accept-ranges: ${r.headers.get("accept-ranges")}`);
}

// --- 1. the exact request Chrome makes first --------------------------------
for (const s of sources.slice(0, 1)) {
  console.log(`=== ${s.quality} ${(s.sizeBytes / 1048576).toFixed(0)} MB`);
  const r = await fetch(s.url, { headers: { Range: "bytes=0-" } });
  show("Range: bytes=0-   (Chrome's initial request)", r);
  const cr = r.headers.get("content-range") ?? "";
  const total = Number(cr.split("/")[1] || 0);
  const end = Number((cr.match(/bytes (\d+)-(\d+)/) || [])[2] || 0);
  console.log(`     -> element would believe the file is ${end + 1} bytes long (of ${total})`);
  await r.body?.cancel();
  console.log("");
}

// --- 2. how long does one open-ended connection stay alive? ----------------
console.log("=== open-ended connection lifetime (reading a real stream)");
const s0 = sources[0];
const started = Date.now();
let bytes = 0;
let lastTick = started;
let died = null;
try {
  const r = await fetch(s0.url, { headers: { Range: "bytes=0-" } });
  console.log(`  status ${r.status} cr=${r.headers.get("content-range")}`);
  const reader = r.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    const now = Date.now();
    if (now - lastTick > 5000) {
      const secs = (now - started) / 1000;
      console.log(
        `  t+${secs.toFixed(0)}s  ${(bytes / 1048576).toFixed(1)} MB  ` +
          `${((bytes * 8) / 1048576 / secs).toFixed(2)} Mbps`,
      );
      lastTick = now;
    }
  }
  console.log(`  stream closed cleanly after ${((Date.now() - started) / 1000).toFixed(0)}s`);
} catch (e) {
  died = e;
  console.log(
    `  STREAM DIED after ${((Date.now() - started) / 1000).toFixed(0)}s ` +
      `(${((bytes / 1048576)).toFixed(1)} MB read): ${e.message}`,
  );
}
console.log("");
console.log(`  total read: ${(bytes / 1048576).toFixed(1)} MB`);
if (died) {
  console.log(`  cause: ${died.cause ? `${died.cause.code ?? ""} ${died.cause.message ?? ""}` : "n/a"}`);
}
