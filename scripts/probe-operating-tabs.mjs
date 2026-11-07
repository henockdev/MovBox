// Which /tab-operating tabId carries the ranking groups?
//
// The app's Trending tab showed "Series Rankings" (Popular / TOP100 / Anime /
// K-Drama) and "Movie Rankings". The site has to build the same page from the
// web BFF, so we need to know which tabId answers with those groups.

const BASE = "https://h5-api.aoneroom.com/wefeed-h5api-bff";

const r = await fetch(`${BASE}/app/get-latest-app-pkgs?app_name=moviebox`, {
  headers: {
    Origin: "https://boxmovies.org",
    Referer: "https://boxmovies.org/",
    Accept: "application/json, text/plain, */*",
  },
});
const token = (r.headers.get("set-cookie") || "").match(/token=([^;]+)/)?.[1];
if (!token) {
  console.log("no token, status", r.status);
  process.exit(1);
}

const H = {
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
  Origin: "https://boxmovies.org",
  Referer: "https://boxmovies.org/",
};

for (const tabId of ["", "1", "2", "3", "4", "5", "6", "7", "8", "9", "13"]) {
  const path = tabId ? `/tab-operating?tabId=${tabId}` : "/tab-operating";
  try {
    const res = await fetch(`${BASE}${path}`, { headers: H });
    const json = await res.json();
    const list = json?.data?.operatingList || [];
    const withItems = list.filter((o) => Array.isArray(o.subjects) && o.subjects.length);
    console.log(
      `tab=${(tabId || "-").padEnd(3)} status=${res.status} code=${json?.code} groups=${String(list.length).padStart(3)} withItems=${String(withItems.length).padStart(3)}  ${withItems.slice(0, 6).map((o) => `${o.title}(${o.subjects.length})`).join(", ")}`
    );
  } catch (e) {
    console.log(`tab=${tabId || "-"} ERR ${e.message}`);
  }
}
