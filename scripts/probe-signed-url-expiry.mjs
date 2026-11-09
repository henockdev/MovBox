// Is the upstream's signed url time-limited, and what does expiry look like?
//
// Every rung we get back carries the SAME `t` value inside the upstream url:
//   https://<cdn>/…mp4?sign=<hash>&t=<unix seconds>
//
// If `t` is an expiry, then:
//   - the whole ladder dies at the same instant, and
//   - the player's auto-fallback to the next rung cannot help, because the
//     next rung carries the same dead timestamp.
// That is exactly the shape of the reported bug: "always makes an error
// while watching".
//
// This probes the relay with crafted upstream urls at different `t` offsets
// and reports the HTTP status for each.
//
// Usage: node scripts/probe-signed-url-expiry.mjs [baseUrl] [detailPath]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const DETAIL = process.argv[3] || "40-dates-and-40-nights-IyIrty839T6";

const res = await fetch(`${BASE}/api/sources?detailPath=${encodeURIComponent(DETAIL)}`);
const json = await res.json();
const s = (json.sources ?? [])[0];
if (!s) {
  console.log("no sources");
  process.exit(1);
}

const relay = new URL(s.url);
const upstream = relay.searchParams.get("url");
const u = new URL(upstream);
const originalT = u.searchParams.get("t");
const sign = u.searchParams.get("sign");

console.log(`upstream : ${u.host}${u.pathname}`);
console.log(`sign     : ${sign}`);
console.log(`t        : ${originalT} (${new Date(Number(originalT) * 1000).toISOString()})`);
console.log(`now      : ${Math.floor(Date.now() / 1000)} (${new Date().toISOString()})`);
console.log(`t - now  : ${Number(originalT) - Math.floor(Date.now() / 1000)} s`);
console.log("");

/** Ask the relay for the upstream with a given t (and optionally a new sign). */
async function probe(label, mutate) {
  const copy = new URL(u.toString());
  mutate(copy);
  const relayUrl = `${relay.origin}${relay.pathname}?url=${encodeURIComponent(copy.toString())}`;
  try {
    const r = await fetch(relayUrl, { headers: { Range: "bytes=0-1023" } });
    const buf = new Uint8Array(await r.arrayBuffer());
    const isMpeg =
      buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70; // "ftyp"
    console.log(
      `  ${label.padEnd(34)} HTTP ${String(r.status).padEnd(4)} ` +
        `cr=${(r.headers.get("content-range") ?? "-").padEnd(26)} ` +
        `bytes=${String(buf.length).padEnd(5)} mp4=${isMpeg ? "YES" : "no"}`,
    );
  } catch (e) {
    console.log(`  ${label.padEnd(34)} FETCH FAILED ${e.message}`);
  }
}

console.log("=== baseline");
await probe("original t", () => {});

console.log("");
console.log("=== t shifted (sign unchanged)");
for (const delta of [-3600, -600, -120, -30, +30, +120, +600, +3600]) {
  await probe(`t ${delta > 0 ? "+" : ""}${delta}s`, (c) =>
    c.searchParams.set("t", String(Number(originalT) + delta)),
  );
}

console.log("");
console.log("=== t replaced with an old timestamp (sign unchanged)");
await probe("t = now - 2h", (c) => c.searchParams.set("t", String(Math.floor(Date.now() / 1000) - 7200)));
await probe("t = now - 24h", (c) => c.searchParams.set("t", String(Math.floor(Date.now() / 1000) - 86400)));
await probe("t = now + 24h", (c) => c.searchParams.set("t", String(Math.floor(Date.now() / 1000) + 86400)));

console.log("");
console.log("=== sign tampered (t untouched)");
await probe("sign truncated", (c) => c.searchParams.set("sign", sign.slice(0, -1)));
await probe("sign removed", (c) => c.searchParams.delete("sign"));
