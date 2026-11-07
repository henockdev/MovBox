// What ranking groups does the web BFF expose to the site?
//
// The app's ranking screen reads `tab-operating` (mobile BFF) and
// `tab/ranking-list` (mobile BFF, unreachable from Vercel). The site uses the
// web BFF, so the ranking groups have to come from the web BFF's own home
// feed — the same operatingList the app's ranking shelves were built from.

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

const res = await fetch(`${BASE}/home?host=boxmovies.org`, { headers: H });
const json = await res.json();
const list = json?.data?.operatingList || [];
console.log("operatingList groups:", list.length);
console.log("");
for (const o of list) {
  const n = Array.isArray(o.subjects) ? o.subjects.length : 0;
  console.log(
    String(n).padStart(3),
    (o.type || "-").padEnd(18),
    JSON.stringify(o.title)
  );
}

// Does the web BFF expose a ranking endpoint of its own?
console.log("\n--- probing the web BFF for ranking routes ---");
for (const path of [
  "/ranking/list?categoryId=1&page=1&perPage=10",
  "/ranking/all",
  "/rank/all",
  "/tab/ranking-list?categoryId=1&page=1&perPage=10",
  "/tab-operating",
]) {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: H });
    const text = await res.text();
    const body = text.slice(0, 110).replace(/\s+/g, " ");
    console.log(`${res.status}  ${path}\n     ${body}`);
  } catch (e) {
    console.log(`ERR ${path} ${e.message}`);
  }
}
