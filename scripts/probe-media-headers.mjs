// Diagnose the "Stream error. Try a different source." that fires during playback.
//
// The player hands the <video> element a relay URL:
//   https://<relay>/mp4?url=<encoded upstream cdn url with sign=…&t=…>
//
// A media element will abort with MEDIA_ERR_SRC_NOT_SUPPORTED / MEDIA_ERR_NETWORK
// if any of these are true:
//   - the response Content-Type is not a media type
//   - the response is not a byte-range capable stream (no Accept-Ranges / no 206)
//   - the upstream signed url has expired (sign=…&t=…)
//   - the upstream returns a non-2xx on a range request
//
// This script prints the facts for every rung and then re-checks the signed
// url expiry window.
//
// Usage: node scripts/probe-media-headers.mjs [baseUrl] [detailPath]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const DETAIL = process.argv[3] || "40-dates-and-40-nights-IyIrty839T6";

function dump(res, label) {
  const h = res.headers;
  const keys = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "content-disposition",
    "cache-control",
    "access-control-allow-origin",
    "access-control-allow-methods",
    "x-frame-options",
    "server",
    "cf-cache-status",
  ];
  const out = {};
  for (const k of keys) {
    const v = h.get(k);
    if (v !== null) out[k] = v;
  }
  console.log(`  ${label} -> HTTP ${res.status}`);
  for (const [k, v] of Object.entries(out)) console.log(`       ${k}: ${v}`);
  return res;
}

async function main() {
  console.log(`base      : ${BASE}`);
  console.log(`detailPath: ${DETAIL}`);
  console.log("");

  const res = await fetch(`${BASE}/api/sources?detailPath=${encodeURIComponent(DETAIL)}`);
  const json = await res.json();
  const sources = json.sources ?? [];
  console.log(`provider  : ${json.provider?.id}  rungs=${sources.length}`);
  console.log("");

  for (const s of sources) {
    const url = s.url;
    const upstream = new URL(url).searchParams.get("url") ?? "";
    const upstreamParsed = new URL(upstream);
    const sign = upstreamParsed.searchParams.get("sign") ?? "";
    const t = upstreamParsed.searchParams.get("t") ?? "";
    console.log(`=== ${s.quality} (${s.resolution}p) ${(s.sizeBytes / 1048576).toFixed(0)} MB`);
    console.log(`    upstream host : ${upstreamParsed.host}`);
    console.log(`    upstream path : ${upstreamParsed.pathname}`);
    console.log(`    sign          : ${sign.slice(0, 12)}…`);
    console.log(`    t             : ${t}  (${t ? new Date(Number(t) * 1000).toISOString() : "?"})`);
    console.log(`    delta to now  : ${t ? (Number(t) - Math.floor(Date.now() / 1000)) : "?"} s`);
    console.log("");

    // 1. plain GET, headers only (abort the body)
    try {
      const ctrl = new AbortController();
      const r = await fetch(url, { signal: ctrl.signal, headers: { Range: "bytes=0-1" } });
      dump(r, "range bytes=0-1");
      console.log(`       content-type is media? ${/^(video|audio)\//.test(r.headers.get("content-type") ?? "")}`);
      await r.arrayBuffer().catch(() => {});
    } catch (e) {
      console.log(`  range GET FAILED: ${e.message}`);
    }

    // 2. mid-file range, like the player would do after buffering
    try {
      const r = await fetch(url, { headers: { Range: "bytes=50000000-50001023" } });
      dump(r, "range bytes=50000000-50001023");
      const buf = await r.arrayBuffer().catch(() => null);
      console.log(`       bytes received: ${buf ? buf.byteLength : "n/a"}`);
      if (buf && buf.byteLength > 0) {
        const head = new Uint8Array(buf.slice(0, 64));
        console.log(`       first bytes  : ${[...head.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join(" ")}`);
        const ascii = new TextDecoder("latin1").decode(head);
        console.log(`       ascii sniff  : ${JSON.stringify(ascii.slice(0, 40))}`);
      }
    } catch (e) {
      console.log(`  mid-file range FAILED: ${e.message}`);
    }
    console.log("");
  }
}

await main();
