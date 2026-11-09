// Does the RELAY forward the browser's Referer/Origin to the upstream CDN?
//
// We already know that bcdn.* / bcdnxw.hakunaymatata.com answers 429 when the
// request carries ANY Referer, and 428 when it carries a browser User-Agent.
// A Node probe sends neither, so it always succeeds.
//
// A real <video> element sends BOTH:
//   Referer: https://movbox.xyz/        (referrer-policy: strict-origin-when-cross-origin)
//   Origin: https://movbox.xyz          (for CORS-ish requests)
//   User-Agent: Mozilla/5.0 ...
//
// If the relay copies those headers upstream, the media request 429s in the
// browser but succeeds in every scripted probe. That is the exact shape of a
// "the video always errors in the browser but the API looks fine" bug.
//
// Usage: node scripts/probe-relay-header-fidelity.mjs [baseUrl] [detailPath]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const DETAIL = process.argv[3] || "40-dates-and-40-nights-IyIrty839T6";

const res = await fetch(`${BASE}/api/sources?detailPath=${encodeURIComponent(DETAIL)}`);
const json = await res.json();
const s = (json.sources ?? [])[0];
if (!s) {
  console.log("no sources");
  process.exit(1);
}
const url = s.url;
console.log(`relay: ${url.slice(0, 70)}…`);
console.log("");

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const cases = [
  ["bare node fetch (no extra headers)", {}],
  ["browser UA only", { "User-Agent": BROWSER_UA }],
  ["Referer only", { Referer: "https://movbox.xyz/" }],
  ["Origin only", { Origin: "https://movbox.xyz" }],
  ["Referer + Origin", { Referer: "https://movbox.xyz/", Origin: "https://movbox.xyz" }],
  [
    "full browser (UA + Referer + Origin)",
    { "User-Agent": BROWSER_UA, Referer: "https://movbox.xyz/", Origin: "https://movbox.xyz" },
  ],
  [
    "full browser + Sec-Fetch-* headers",
    {
      "User-Agent": BROWSER_UA,
      Referer: "https://movbox.xyz/",
      Origin: "https://movbox.xyz",
      "Sec-Fetch-Dest": "video",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "cross-site",
      Accept: "*/*",
      "Accept-Encoding": "identity;q=1, *;q=0",
      "Accept-Language": "en-US,en;q=0.9",
      Range: "bytes=0-1023",
    },
  ],
];

for (const [label, headers] of cases) {
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-1023", ...headers } });
    const buf = new Uint8Array(await r.arrayBuffer());
    const isMpeg = buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70;
    const body = isMpeg ? "" : ` body="${new TextDecoder().decode(buf.slice(0, 80)).trim()}"`;
    console.log(
      `  ${label.padEnd(38)} HTTP ${String(r.status).padEnd(4)} ` +
        `bytes=${String(buf.length).padEnd(5)} mp4=${isMpeg ? "YES" : "NO "}${body}`,
    );
  } catch (e) {
    console.log(`  ${label.padEnd(38)} FAILED ${e.message}`);
  }
}
