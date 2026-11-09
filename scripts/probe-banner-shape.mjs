// Dump the raw BANNER entry the h5-api publishes.
//
// The app's Trending hero IS this block: a full-bleed 16:9 banner that
// auto-advances. The web's getBoxmoviesOperatingTab() drops every entry with no
// `subjects` array, and a banner entry has none - so the hero was thrown away.
//
// Usage: node scripts/probe-banner-shape.mjs

const H5_API_BASE = "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const SITE_HOST = "https://boxmovies.org";
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

async function mintToken() {
  const r = await fetch(`${H5_API_BASE}/app/get-latest-app-pkgs?app_name=moviebox`, {
    headers: {
      Origin: SITE_HOST,
      Referer: `${SITE_HOST}/`,
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
    },
  });
  const m = (r.headers.get("set-cookie") || "").match(/(?:^|,\s*)token=([^;]+)/i);
  if (!m) throw new Error("no token");
  return m[1];
}

async function h5(path, token) {
  const r = await fetch(`${H5_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: SITE_HOST,
      Referer: `${SITE_HOST}/`,
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

/** Walk an object and print its shape, without dumping megabytes of urls. */
function shape(value, depth = 0, key = "") {
  const pad = "  ".repeat(depth);
  if (Array.isArray(value)) {
    console.log(`${pad}${key}: Array(${value.length})`);
    if (value.length) shape(value[0], depth + 1, "[0]");
    return;
  }
  if (value && typeof value === "object") {
    console.log(`${pad}${key}: {`);
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "string" && v.length > 90) {
        console.log(`${pad}  ${k}: "${v.slice(0, 90)}…"`);
      } else {
        shape(v, depth + 1, k);
      }
    }
    console.log(`${pad}}`);
    return;
  }
  console.log(`${pad}${key}: ${JSON.stringify(value)}`);
}

const token = await mintToken();

for (const path of ["/tab-operating?tabId=2", "/home?host=boxmovies.org"]) {
  console.log("=".repeat(74));
  console.log(path);
  console.log("=".repeat(74));
  const json = await h5(path, token);
  const list = json?.data?.operatingList ?? [];
  const banners = list.filter((e) => e?.type === "BANNER");
  console.log(`BANNER entries: ${banners.length}`);
  for (const b of banners) {
    shape(b, 0, "banner");
  }
  console.log("");
}
