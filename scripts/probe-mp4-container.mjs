// Is the relayed MP4 actually a decodable MP4?
//
// The headers say video/mp4 + 206 + accept-ranges: bytes, but a media element
// still aborts with MEDIA_ERR_SRC_NOT_SUPPORTED if the bytes are not a
// container the browser can demux. This dumps the first 64 bytes (the ftyp
// box should live there) and the last 64 bytes (the moov box often lives at
// the end for non-faststart files) of the relayed stream, and compares them
// with the upstream CDN fetched the same way /api/video-proxy does it.
//
// Usage: node scripts/probe-mp4-container.mjs [baseUrl] [detailPath]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const DETAIL = process.argv[3] || "40-dates-and-40-nights-IyIrty839T6";

function hex(u8, n = 64) {
  return [...u8.slice(0, n)].map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

function ascii(u8, n = 48) {
  return JSON.stringify(
    new TextDecoder("latin1")
      .decode(u8.slice(0, n))
      .replace(/[^\x20-\x7e]/g, ".")
  );
}

/** Walk the top-level MP4 boxes of a buffer and name them. */
function boxes(u8) {
  const out = [];
  let off = 0;
  while (off + 8 <= u8.length) {
    const view = new DataView(u8.buffer, u8.byteOffset + off, 8);
    const size = view.getUint32(0);
    const type = String.fromCharCode(u8[off + 4], u8[off + 5], u8[off + 6], u8[off + 7]);
    if (size < 8) break;
    out.push(`${type}(${size})`);
    off += size;
    if (out.length > 12) break;
  }
  return out.join(" ");
}

const res = await fetch(`${BASE}/api/sources?detailPath=${encodeURIComponent(DETAIL)}`);
const json = await res.json();
const s = (json.sources ?? [])[0];
if (!s) {
  console.log("no sources");
  process.exit(1);
}

const relayUrl = s.url;
const upstream = new URL(relayUrl).searchParams.get("url");

console.log("=== RELAY (what the <video> element actually requests)");
let head = await fetch(relayUrl, { headers: { Range: "bytes=0-63" } });
let buf = new Uint8Array(await head.arrayBuffer());
console.log(`  status ${head.status}  bytes ${buf.length}`);
console.log(`  hex   : ${hex(buf)}`);
console.log(`  ascii : ${ascii(buf)}`);
console.log(`  boxes : ${boxes(buf)}`);

// The moov atom: pull the tail and look for it.
const total = Number((head.headers.get("content-range") ?? "").split("/")[1] || 0);
if (total) {
  const tail = await fetch(relayUrl, { headers: { Range: `bytes=${total - 4096}-${total - 1}` } });
  const tbuf = new Uint8Array(await tail.arrayBuffer());
  const hasMoov = new TextDecoder("latin1").decode(tbuf).includes("moov");
  console.log(`  tail  : contains "moov"? ${hasMoov}`);
}

console.log("");
console.log("=== UPSTREAM CDN (fetched the way /api/video-proxy does it)");
for (const [label, headers] of [
  ["okhttp UA, no referer", { "User-Agent": "okhttp/4.12.0" }],
  ["browser UA + referer", { "User-Agent": "Mozilla/5.0", Referer: "https://movbox.xyz/" }],
]) {
  try {
    const r = await fetch(upstream, { headers: { Range: "bytes=0-63", ...headers } });
    const b = new Uint8Array(await r.arrayBuffer());
    console.log(`  ${label}: HTTP ${r.status} ct=${r.headers.get("content-type")} cr=${r.headers.get("content-range")}`);
    console.log(`     hex   : ${hex(b)}`);
    console.log(`     ascii : ${ascii(b)}`);
    console.log(`     boxes : ${boxes(b)}`);
  } catch (e) {
    console.log(`  ${label}: FAILED ${e.message}`);
  }
}
