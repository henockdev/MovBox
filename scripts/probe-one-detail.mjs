/**
 * Ask the upstream about a handful of detail paths.
 *
 * Usage: node scripts/probe-one-detail.mjs <detailPath> [...]
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

const paths = process.argv.slice(2);
for (const p of paths) {
  const res = await fetch(
    `${BASE}/detail?detailPath=${encodeURIComponent(p)}`,
    {
      headers: {
        Accept: "application/json, text/plain, */*",
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
  } catch {}
  console.log(
    `${p} -> HTTP ${res.status} code=${json?.code} title=${JSON.stringify(
      json?.data?.subject?.title ?? null
    )}`
  );
}
