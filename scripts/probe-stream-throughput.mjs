// Measure the real throughput of every quality rung for a title.
//
// This is the "Stream error" diagnosis: the player picks the best rung, but
// if the byte path cannot sustain that rung's bitrate the buffer starves and
// the media element eventually errors out.
//
// Usage: node scripts/probe-stream-throughput.mjs [baseUrl] [detailPath]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const DETAIL = process.argv[3] || "40-dates-and-40-nights-IyIrty839T6";
const MB = 1024 * 1024;

const res = await fetch(`${BASE}/api/sources?detailPath=${encodeURIComponent(DETAIL)}`, {
  headers: { "User-Agent": "Mozilla/5.0 (throughput probe)" },
});
const json = await res.json();

console.log(`detailPath : ${DETAIL}`);
console.log(`provider   : ${json.provider?.id}   onstream: ${json.onstream?.active}`);
console.log(`rungs      : ${json.sources?.length ?? 0}`);
console.log("");

for (const s of json.sources ?? []) {
  const url = s.url;

  // 1. Size + range support from a 1-byte probe.
  let total = null;
  let rangeSupport = "?";
  try {
    const head = await fetch(url, { headers: { Range: "bytes=0-0" } });
    const cr = head.headers.get("content-range");
    if (cr) {
      total = Number(cr.split("/")[1]);
      rangeSupport = "bytes";
    }
    await head.arrayBuffer();
  } catch (e) {
    console.log(`  ${s.quality.padEnd(7)} HEAD FAILED ${e.message}`);
    continue;
  }

  // 2. Sustained throughput over 4 MB.
  const chunk = 4 * MB;
  const started = Date.now();
  let bytes = 0;
  let ok = true;
  try {
    const r = await fetch(url, { headers: { Range: `bytes=0-${chunk - 1}` } });
    if (!r.ok) {
      ok = false;
      console.log(`  ${s.quality.padEnd(7)} HTTP ${r.status}`);
    } else {
      const buf = await r.arrayBuffer();
      bytes = buf.byteLength;
    }
  } catch (e) {
    ok = false;
    console.log(`  ${s.quality.padEnd(7)} FETCH FAILED ${e.message}`);
  }

  const secs = (Date.now() - started) / 1000;
  const mbps = ok && secs > 0 ? (bytes * 8) / MB / secs : 0;
  const sizeMb = total ? (total / MB).toFixed(0) : "?";

  // A 1080p stream needs roughly 5-8 Mbps; 720p ~3-5; 360p ~1-2.
  const need = s.resolution >= 1080 ? 6 : s.resolution >= 720 ? 4 : 1.5;
  const verdict = !ok
    ? "FAILED"
    : mbps >= need
      ? "OK"
      : mbps >= need * 0.6
        ? "MARGINAL"
        : "TOO SLOW";

  console.log(
    `  ${String(s.quality).padEnd(7)} ${String(sizeMb).padStart(4)} MB  range=${rangeSupport.padEnd(6)} ` +
      `${(bytes / MB).toFixed(1)} MB in ${secs.toFixed(1)}s = ${mbps.toFixed(2)} Mbps  ` +
      `need~${need} Mbps  -> ${verdict}`
  );
}
