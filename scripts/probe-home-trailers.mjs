/**
 * Does the HOMEPAGE carry trailers?
 *
 * The browse pages publish `trailer.videoAddress.url` on every list item,
 * so the hover preview works there. The homepage rows come from a different
 * endpoint — if that one does not publish the trailer, the homepage cards
 * have nothing to play.
 *
 * This dumps the item shape of every endpoint the homepage uses.
 *
 * Usage: node scripts/probe-home-trailers.mjs
 */

const BASE =
  process.env.H5_API_BASE || "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const SITE_HOST = "https://boxmovies.org";
const UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

const tokenRes = await fetch(
  `${BASE}/app/get-latest-app-pkgs?app_name=moviebox`,
  {
    headers: {
      Origin: SITE_HOST,
      Referer: `${SITE_HOST}/`,
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
    },
  }
);
const tokenJson = await tokenRes.json();
const token =
  tokenJson?.data?.token ||
  (() => {
    const m = (tokenRes.headers.get("set-cookie") || "").match(/token=([^;]+)/);
    return m ? m[1] : "";
  })();

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Origin: SITE_HOST,
      Referer: `${SITE_HOST}/`,
      "User-Agent": UA,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { __raw: text.slice(0, 200) };
  }
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Authorization: `Bearer ${token}`,
      Origin: SITE_HOST,
      Referer: `${SITE_HOST}/`,
      "User-Agent": UA,
    },
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { __raw: text.slice(0, 200) };
  }
}

/** Every item in the response, wherever it sits. */
function collectItems(data) {
  const out = [];
  const walk = (node, depth) => {
    if (!node || typeof node !== "object" || depth > 6) return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n, depth + 1);
      return;
    }
    if (node.detailPath && (node.title || node.cover)) {
      out.push(node);
      return;
    }
    for (const v of Object.values(node)) walk(v, depth + 1);
  };
  walk(data, 0);
  return out;
}

function report(label, data) {
  const items = collectItems(data);
  const withTrailer = items.filter(
    (i) => i.trailer && i.trailer.videoAddress && i.trailer.videoAddress.url
  );
  console.log(`\n=== ${label}`);
  console.log(`  items: ${items.length}`);
  console.log(
    `  with a trailer: ${withTrailer.length}${
      items.length ? ` (${Math.round((withTrailer.length / items.length) * 100)}%)` : ""
    }`
  );
  if (items[0]) {
    console.log(`  first item keys: ${Object.keys(items[0]).join(", ")}`);
    if (withTrailer[0]) {
      console.log(`  trailer: ${withTrailer[0].trailer.videoAddress.url}`);
    }
  }
}

const home = await get("/home?host=boxmovies.org");
console.log(
  "home data keys:",
  Object.keys(home?.data || {}).join(", ") || JSON.stringify(home).slice(0, 200)
);
report("GET /home?host=boxmovies.org", home?.data);

const tab = await post("/tab-operating", { tabId: "ONEROOM_MOVIE" });
report("POST /tab-operating", tab?.data);

const filter = await post("/subject/filter", {
  page: 1,
  perPage: 28,
  channelId: 1,
  genre: "",
  country: "",
  year: "",
  language: "",
  sort: "ForYou",
});
report("POST /subject/filter", filter?.data);

const rankings = await post("/rankings", {}).catch(() => null);
if (rankings) report("POST /rankings", rankings?.data);
