/**
 * Probe the upstream's LIST endpoints for trailer / preview data.
 *
 * The hover-preview feature needs a video for every card. The detail
 * endpoint carries `subject.trailer.videoAddress.url`, but a list endpoint
 * may not — and if it does not, every hover would cost one upstream call
 * (which the upstream rate-limits).
 *
 * This dumps the raw shape of a list item and of its detail, and says
 * which video-ish fields exist.
 *
 * Usage: node scripts/probe-trailer-fields.mjs
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
    return { __raw: text.slice(0, 300) };
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
    return { __raw: text.slice(0, 300) };
  }
}

/** Walk an object and report every key that looks like a video/preview. */
function findVideoKeys(obj, path = "", out = []) {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    if (typeof v === "string" && /^https?:\/\//.test(v)) {
      if (/trailer|preview|video|sample|teaser|clip/i.test(p)) out.push(p);
    } else if (v && typeof v === "object") {
      findVideoKeys(v, p, out);
    }
  }
  return out;
}

console.log("=== POST /subject/search (a browse page)");
const search = await post("/subject/filter", {
  page: 1,
  perPage: 28,
  channelId: 1,
  genre: "",
  country: "",
  year: "",
  language: "",
  sort: "ForYou",
});
console.log("raw response keys:", Object.keys(search?.data || {}));
console.log(
  "raw response head:",
  JSON.stringify(search?.data || search).slice(0, 400)
);
const list =
  search?.data?.items || search?.data?.subjectList || search?.data?.subjects || [];
console.log("items:", list.length);
if (list[0]) {
  console.log("item keys:", Object.keys(list[0]).join(", "));
  console.log("video-ish keys in the item:", findVideoKeys(list[0]));
  console.log(
    "sample item:",
    JSON.stringify(
      {
        title: list[0].title,
        detailPath: list[0].detailPath,
        videoAddress: list[0].videoAddress,
        trailer: list[0].trailer,
        cover: list[0].cover,
      },
      null,
      2
    )
  );
}

console.log("\n=== GET /detail for the first item");
if (list[0]?.detailPath) {
  const d = await get(
    `/detail?detailPath=${encodeURIComponent(list[0].detailPath)}`
  );
  const subject = d?.data?.subject || {};
  console.log("subject keys:", Object.keys(subject).join(", "));
  console.log("video-ish keys in the detail:", findVideoKeys(d?.data || {}));
  console.log(
    "trailer:",
    JSON.stringify(subject.trailer ?? null, null, 2).slice(0, 900)
  );
  console.log(
    "resource keys:",
    Object.keys(d?.data?.resource || {}).join(", ")
  );
  console.log(
    "resource.videoAddress:",
    JSON.stringify(d?.data?.resource?.videoAddress ?? null, null, 2).slice(
      0,
      700
    )
  );
}

console.log("\n=== POST /home (the BANNER / section shape)");
const home = await post("/home", {});
const homeKeys = findVideoKeys(home?.data || {});
console.log("video-ish keys in /home:", homeKeys.slice(0, 20));
