/**
 * Probe 2: can the *filter* endpoint take a keyword?
 *
 * Probe 1 proved that POST /subject/search ignores every filter key
 * (yearMin / yearMax / genres / country / language / sort all returned the
 * identical result set). The site's browse pages use POST /subject/filter,
 * which DOES honour genre / country / year / language / sort. If that
 * endpoint also accepts a keyword, the search page can offer real
 * upstream-side filtering instead of filtering a result set by hand.
 *
 * Also probes the signed mobile BFF (`api6.aoneroom.com`), which is the
 * original app's own search transport and the only endpoint known to carry
 * the app's filter block — but which answers 440 from Vercel.
 *
 * Usage: node scripts/probe-search-filters-2.mjs
 */

const H5 = process.env.H5_API_BASE || "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const MOBILE = "https://api6.aoneroom.com/wefeed-mobile-bff";
const UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

async function mint() {
  const r = await fetch(`${H5}/app/get-latest-app-pkgs?app_name=moviebox`, {
    headers: {
      Origin: "https://boxmovies.org",
      Referer: "https://boxmovies.org/",
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
    },
  });
  const m = (r.headers.get("set-cookie") || "").match(/(?:^|,\s*)token=([^;]+)/i);
  if (!m) throw new Error("no token cookie");
  return m[1];
}

async function post(base, path, body, token) {
  const headers = {
    Accept: "application/json, text/plain, */*",
    Origin: "https://boxmovies.org",
    Referer: "https://boxmovies.org/",
    "User-Agent": UA,
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const t = await r.text();
  let j = null;
  try {
    j = JSON.parse(t);
  } catch {}
  return { status: r.status, j, raw: t.slice(0, 400) };
}

function paths(res) {
  const d = res?.j?.data;
  const items = Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : [];
  return items.map((i) => (i && (i.detailPath || i.subject?.detailPath)) || null).filter(Boolean);
}

function pager(res) {
  const p = res?.j?.data?.pager || {};
  return { hasMore: p.hasMore, totalCount: p.totalCount };
}

function genresOf(res) {
  const d = res?.j?.data;
  const items = Array.isArray(d?.items) ? d.items : [];
  const out = {};
  for (const i of items) {
    const g = i?.genre || i?.subject?.genre;
    if (g) out[g] = (out[g] || 0) + 1;
  }
  return out;
}

async function main() {
  const token = await mint();
  console.log("token minted ok\n");

  console.log("=== A. /subject/filter with and without a keyword ===");
  const cases = [
    ["channelId=1 plain", { page: 1, perPage: 28, channelId: 1 }],
    ["channelId=1 keyword=love", { page: 1, perPage: 28, channelId: 1, keyword: "love" }],
    ["channelId=1 keyword=love genre=Action", { page: 1, perPage: 28, channelId: 1, keyword: "love", genre: "Action" }],
    ["channelId=1 keyword=love country=United States", { page: 1, perPage: 28, channelId: 1, keyword: "love", country: "United States" }],
    ["channelId=1 keyword=love year=2020", { page: 1, perPage: 28, channelId: 1, keyword: "love", year: "2020" }],
    ["channelId=1 keyword=love language=English", { page: 1, perPage: 28, channelId: 1, keyword: "love", language: "English" }],
    ["channelId=1 keyword=love sort=Rating", { page: 1, perPage: 28, channelId: 1, keyword: "love", sort: "Rating" }],
    ["channelId=1 keyword=zzzznotathing", { page: 1, perPage: 28, channelId: 1, keyword: "zzzznotathing" }],
  ];
  for (const [label, body] of cases) {
    try {
      const res = await post(H5, "/subject/filter", body, token);
      console.log(
        `${label.padEnd(42)} status=${res.status} n=${paths(res).length} pager=${JSON.stringify(pager(res))} genres=${JSON.stringify(genresOf(res))}`
      );
      if (res.status !== 200) console.log("   RAW:", res.raw);
    } catch (e) {
      console.log(`${label.padEnd(42)} ERROR ${e.message}`);
    }
  }

  console.log("\n=== B. the mobile BFF (the app's own search transport) ===");
  for (const [label, path, body] of [
    ["POST /subject-api/search/v2", "/subject-api/search/v2", { keyword: "love", page: 1, perPage: 30, subjectType: 0, version: "def99f2" }],
    ["GET  /subject-api/search/suggest", "/subject-api/search/suggest?keyword=dra", null],
  ]) {
    try {
      const r = await fetch(`${MOBILE}${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": UA,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const t = await r.text();
      console.log(`${label.padEnd(42)} status=${r.status} raw=${t.slice(0, 220)}`);
    } catch (e) {
      console.log(`${label.padEnd(42)} ERROR ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
