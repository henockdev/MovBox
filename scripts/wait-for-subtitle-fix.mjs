// Poll the live site until the caption URLs come back proxied.
//
// The signal: /api/sources returns subtitleTracks whose url starts with
// /api/subtitle-proxy. Before the fix they pointed straight at the relay.
//
// Usage: node scripts/wait-for-subtitle-fix.mjs [baseUrl] [maxMinutes]

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const MAX_MINUTES = Number(process.argv[3] || 15);
const deadline = Date.now() + MAX_MINUTES * 60 * 1000;

const DETAIL = "40-dates-and-40-nights-IyIrty839T6";

let attempt = 0;
while (Date.now() < deadline) {
  attempt += 1;
  let line = `[${new Date().toISOString().slice(11, 19)}] try ${String(attempt).padStart(2)}  `;
  try {
    const res = await fetch(`${BASE}/api/sources?detailPath=${DETAIL}`, {
      headers: { "User-Agent": "Mozilla/5.0 (caption poll)" },
    });
    const json = await res.json();
    const tracks = json.subtitleTracks ?? [];
    const proxied = tracks.filter((t) => t.url.startsWith("/api/subtitle-proxy")).length;
    const sample = tracks[0]?.url ?? "";
    line +=
      `provider=${json.provider?.id} tracks=${tracks.length} proxied=${proxied}  ` +
      `sample=${sample.slice(0, 46)}…`;
    console.log(line);
    if (tracks.length > 0 && proxied === tracks.length) {
      console.log("\nEVERY CAPTION URL IS PROXIED — the fix is live.");
      process.exit(0);
    }
  } catch (e) {
    console.log(line + `ERR ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 30000));
}

console.log("\nTimed out. The fix has not landed yet.");
process.exit(1);
