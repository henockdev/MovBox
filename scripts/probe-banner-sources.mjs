// Which upstream response carries the app's hero banner, and how many slides?
//
// Candidates:
//   GET /tab-operating              (no tabId) -> the 34-group list the site
//                                     already calls for /rankings
//   GET /tab-operating?tabId=2      -> "Banner_movie" + "Trending Movie" row
//   GET /home?host=boxmovies.org    -> "Banner_Africa"
//
// If /tab-operating (no tabId) already carries a BANNER, the hero costs ZERO
// extra upstream calls.
//
// Usage: node scripts/probe-banner-sources.mjs

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
  if (!r.ok) return { __error: `HTTP ${r.status}: ${text.slice(0, 120)}` };
  return JSON.parse(text);
}

const token = await mintToken();

const paths = [
  "/tab-operating",
  "/tab-operating?tabId=2",
  "/tab-operating?tabId=9",
  "/home?host=boxmovies.org",
];

for (const path of paths) {
  const json = await h5(path, token);
  console.log("=".repeat(74));
  console.log(path);
  if (json.__error) {
    console.log(`  ${json.__error}`);
    console.log("");
    continue;
  }
  const list = json?.data?.operatingList ?? [];
  console.log(`  operatingList entries: ${list.length}`);
  const banners = list.filter((e) => e?.type === "BANNER");
  console.log(`  BANNER entries: ${banners.length}`);
  for (const b of banners) {
    const items = b?.banner?.items ?? [];
    console.log(`   title="${b.title}"  slides=${items.length}`);
    for (const it of items.slice(0, 5)) {
      const img = it?.image?.url ?? "";
      const subj = it?.subject ?? {};
      console.log(
        `     - "${it.title ?? subj.title}"  ${img.slice(0, 78)}` +
          `  ${img ? `(${it.image?.width}x${it.image?.height})` : ""}` +
          `  genre=${subj.genre ?? "-"} country=${subj.countryName ?? "-"}` +
          `  rating=${subj.imdbRatingValue ?? "-"} detailPath=${it.detailPath ?? subj.detailPath ?? "-"}`,
      );
    }
    if (items.length > 5) console.log(`     … ${items.length - 5} more`);
  }
  // The first content section tells us which "tab" this list is.
  const firstContent = list.find((e) => e?.type === "SUBJECTS_MOVIE" && Array.isArray(e.subjects) && e.subjects.length);
  if (firstContent) {
    console.log(`  first content section: "${firstContent.title}" (${firstContent.subjects.length} subjects)`);
  }
  console.log("");
}
