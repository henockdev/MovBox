/**
 * Probe the upstream /detail endpoint directly.
 *
 * Two questions:
 *   1. What does the upstream answer for a detail path that does not exist?
 *      (the shape that decides "missing" vs "the call failed")
 *   2. Does the upstream rate-limit a burst of detail calls?
 *
 * Usage: node scripts/probe-detail-upstream.mjs [burst]
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
  tokenJson?.data?.accessToken ||
  (() => {
    const setCookie = tokenRes.headers.get("set-cookie") || "";
    const m = setCookie.match(/token=([^;]+)/);
    return m ? m[1] : "";
  })();
console.log("token:", token ? `${token.slice(0, 12)}…` : "(none)");

async function detail(path) {
  const res = await fetch(
    `${BASE}/detail?detailPath=${encodeURIComponent(path)}`,
    {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Authorization: `Bearer ${token}`,
        Origin: SITE_HOST,
        Referer: `${SITE_HOST}/`,
        "User-Agent": UA,
      },
    }
  );
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep the raw text */
  }
  return {
    path,
    status: res.status,
    code: json?.code,
    msg: json?.msg ?? json?.message,
    subjectKeys: json?.data?.subject ? Object.keys(json.data.subject).length : 0,
    subjectTitle: json?.data?.subject?.title ?? json?.data?.subject?.name ?? null,
    raw: json ? undefined : text.slice(0, 160),
  };
}

console.log("\n--- a detail path that does not exist");
console.log(await detail("zzz-not-a-real-title-xyz"));

console.log("\n--- a real one");
console.log(await detail("night-shift-OrzxiVFi4A4"));

const burst = Number(process.argv[2] || 30);
console.log(`\n--- burst of ${burst} distinct detail calls`);
const paths = [];
for (let i = 0; i < burst; i++) {
  paths.push(`burst-probe-${i}-${Math.random().toString(36).slice(2, 10)}`);
}
const started = Date.now();
const results = await Promise.all(paths.map((p) => detail(p)));
const statuses = {};
for (const r of results) {
  const key = `${r.status}/code=${r.code}`;
  statuses[key] = (statuses[key] || 0) + 1;
}
console.log(`done in ${Date.now() - started} ms`);
console.log(statuses);
console.log("sample:", results[0]);
