// What does /subject/filter actually return?
//
// The site read `data.hasMore` / `data.totalCount` / `data.nextPage`, but the
// upstream returns `data.pager` + `data.items` — so `hasMore` was ALWAYS
// undefined, therefore always false, and every browse grid stopped after the
// first 28 titles with "You've reached the end.".
//
// This dumps the real shape of `data.pager` so the pagination can be read off
// the upstream's own numbers.
//
// Usage: node scripts/probe-filter-pager.mjs

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

const token = await mintToken();

async function filter(page, perPage, channelId, extra = {}) {
  const r = await fetch(`${H5_API_BASE}/subject/filter`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: SITE_HOST,
      Referer: `${SITE_HOST}/`,
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      page,
      perPage,
      channelId,
      genre: "",
      country: "",
      year: "",
      language: "",
      sort: "ForYou",
      ...extra,
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

console.log("=== pager shape (channelId=1, perPage=28)");
for (const page of [1, 2, 5, 40, 41]) {
  const json = await filter(page, 28, 1);
  const d = json?.data ?? {};
  const pager = d.pager ?? {};
  const first = d.items?.[0]?.detailPath;
  const last = d.items?.[d.items.length - 1]?.detailPath;
  console.log(
    `  page ${String(page).padStart(2)}: pager=${JSON.stringify(pager)}\n` +
      `             items=${d.items?.length ?? 0}  first=${first ?? "-"}  last=${last ?? "-"}`,
  );
}

console.log("");
console.log("=== does perPage change the page size?");
for (const perPage of [10, 28, 50, 100]) {
  const json = await filter(1, perPage, 1);
  const d = json?.data ?? {};
  console.log(`  perPage=${String(perPage).padStart(3)}: items=${d.items?.length}  pager=${JSON.stringify(d.pager)}`);
}

console.log("");
console.log("=== last page behaviour");
for (const page of [38, 39, 40, 41, 42, 50]) {
  const json = await filter(page, 28, 1);
  const d = json?.data ?? {};
  console.log(`  page ${String(page).padStart(2)}: items=${d.items?.length ?? 0}  pager=${JSON.stringify(d.pager)}`);
}
