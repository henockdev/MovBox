/**
 * The homepage's own rows: do their items carry a trailer?
 *
 * The homepage is built from `operatingList[].subjects[]`, and the earlier
 * probe mixed them up with the BANNER entries (which nest the subject).
 * This one looks only at the rows the homepage renders.
 *
 * Usage: node scripts/probe-home-rows.mjs
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

const res = await fetch(`${BASE}/home?host=boxmovies.org`, {
  headers: {
    Accept: "application/json, text/plain, */*",
    Authorization: `Bearer ${token}`,
    Origin: SITE_HOST,
    Referer: `${SITE_HOST}/`,
    "User-Agent": UA,
  },
});
const json = await res.json();
const operating = json?.data?.operatingList || [];

console.log(`operatingList sections: ${operating.length}`);
for (const o of operating) {
  const subjects = Array.isArray(o.subjects) ? o.subjects : [];
  const withTrailer = subjects.filter(
    (s) => s.trailer && s.trailer.videoAddress && s.trailer.videoAddress.url
  );
  const keys = subjects[0] ? Object.keys(subjects[0]).join(", ") : "-";
  console.log(
    `\n  "${o.title}" [${o.type}] subjects=${subjects.length} withTrailer=${withTrailer.length}`
  );
  console.log(`    item keys: ${keys}`);
  if (subjects[0]) {
    console.log(
      `    sample: ${subjects[0].title} — trailer=${
        subjects[0].trailer?.videoAddress?.url ? "YES" : "no"
      }`
    );
  }
}
