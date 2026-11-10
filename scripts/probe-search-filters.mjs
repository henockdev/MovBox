/**
 * Probe: what does POST /subject/search actually filter on?
 *
 * The app's search screen has a filter block (yearMin / yearMax / genres /
 * country / language). That block belongs to the *mobile* BFF
 * (`POST /subject-api/search/v2`). The site talks to the *web* BFF
 * (`POST /subject/search`), and whether it honours the same keys is not
 * documented anywhere — so it is measured here.
 *
 * Method: mint a bearer, then POST the same keyword with one filter varied
 * at a time and compare the returned detail paths. A filter that changes
 * nothing is not a filter and must not appear in the UI.
 *
 * Usage: node scripts/probe-search-filters.mjs
 */

const H5 = process.env.H5_API_BASE || "https://h5-api.aoneroom.com/wefeed-h5api-bff";
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
  const sc = r.headers.get("set-cookie") || "";
  const m = sc.match(/(?:^|,\s*)token=([^;]+)/i);
  if (!m) throw new Error("no token cookie");
  return m[1];
}

async function search(token, body) {
  const r = await fetch(`${H5}/subject/search`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      Authorization: `Bearer ${token}`,
      Origin: "https://boxmovies.org",
      Referer: "https://boxmovies.org/",
      "User-Agent": UA,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  let j = null;
  try {
    j = JSON.parse(t);
  } catch {}
  return { status: r.status, j, raw: t.slice(0, 300) };
}

function paths(res) {
  const items = res?.j?.data?.items;
  return Array.isArray(items) ? items.map((i) => i && i.detailPath).filter(Boolean) : [];
}

function pager(res) {
  const p = res?.j?.data?.pager || {};
  return { hasMore: p.hasMore, totalCount: p.totalCount, page: p.page };
}

const KEY = "love";

function compare(a, b) {
  const pa = new Set(paths(a));
  const pb = new Set(paths(b));
  let overlap = 0;
  for (const p of pa) if (pb.has(p)) overlap++;
  return { a: pa.size, b: pb.size, overlap, identical: pa.size === pb.size && overlap === pa.size };
}

function yearsOf(res) {
  const items = res?.j?.data?.items || [];
  const ys = items
    .map((i) => (i && i.releaseDate ? String(i.releaseDate).slice(0, 4) : null))
    .filter(Boolean);
  const counts = {};
  for (const y of ys) counts[y] = (counts[y] || 0) + 1;
  return { min: ys.sort()[0], max: ys.sort()[ys.length - 1], counts };
}

async function main() {
  const token = await mint();
  console.log("token minted ok\n");

  // --- 0. baseline -------------------------------------------------------
  const base = await search(token, { keyword: KEY, page: "1", perPage: 28, subjectType: 0 });
  console.log("BASELINE", { status: base.status, n: paths(base).length, pager: pager(base) });
  console.log("  sample:", paths(base).slice(0, 3));
  console.log("  years:", yearsOf(base));

  const variants = [
    ["subjectType=1 (movie)", { keyword: KEY, page: "1", perPage: 28, subjectType: 1 }],
    ["subjectType=2 (tv)", { keyword: KEY, page: "1", perPage: 28, subjectType: 2 }],
    ["subjectType=5 (short tv)", { keyword: KEY, page: "1", perPage: 28, subjectType: 5 }],
    ["filters.yearMin=2015", { keyword: KEY, page: "1", perPage: 28, subjectType: 0, filters: { yearMin: 2015 } }],
    ["yearMin=2015 (top level)", { keyword: KEY, page: "1", perPage: 28, subjectType: 0, yearMin: 2015 }],
    ["yearMax=2010", { keyword: KEY, page: "1", perPage: 28, subjectType: 0, yearMax: 2010 }],
    ["filters.yearMin/yearMax 2018-2020", { keyword: KEY, page: "1", perPage: 28, subjectType: 0, filters: { yearMin: 2018, yearMax: 2020 } }],
    ["genres=[Action]", { keyword: KEY, page: "1", perPage: 28, subjectType: 0, genres: ["Action"] }],
    ["filters.genres=[Action]", { keyword: KEY, page: "1", perPage: 28, subjectType: 0, filters: { genres: ["Action"] } }],
    ["genre=Action", { keyword: KEY, page: "1", perPage: 28, subjectType: 0, genre: "Action" }],
    ["country=United States", { keyword: KEY, page: "1", perPage: 28, subjectType: 0, country: "United States" }],
    ["filters.country=United States", { keyword: KEY, page: "1", perPage: 28, subjectType: 0, filters: { country: "United States" } }],
    ["language=English", { keyword: KEY, page: "1", perPage: 28, subjectType: 0, language: "English" }],
    ["filters.language=English", { keyword: KEY, page: "1", perPage: 28, subjectType: 0, filters: { language: "English" } }],
    ["sort=Rating", { keyword: KEY, page: "1", perPage: 28, subjectType: 0, sort: "Rating" }],
    ["sort=Hottest", { keyword: KEY, page: "1", perPage: 28, subjectType: 0, sort: "Hottest" }],
    ["sort=Latest", { keyword: KEY, page: "1", perPage: 28, subjectType: 0, sort: "Latest" }],
  ];

  for (const [label, body] of variants) {
    try {
      const res = await search(token, body);
      const c = compare(base, res);
      const y = yearsOf(res);
      console.log(
        `${label.padEnd(36)} status=${res.status} n=${paths(res).length} pager=${JSON.stringify(pager(res))} ` +
          `differsFromBase=${!c.identical} overlap=${c.overlap} years=${y.min}..${y.max}`
      );
      if (res.status !== 200 || !res.j) console.log("   RAW:", res.raw);
    } catch (e) {
      console.log(`${label.padEnd(36)} ERROR ${e.message}`);
    }
  }

  // --- suggest -----------------------------------------------------------
  try {
    const r = await fetch(`${H5}/subject/search-suggest`, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        Origin: "https://boxmovies.org",
        Referer: "https://boxmovies.org/",
        "User-Agent": UA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ keyword: "dra", perPage: 12 }),
    });
    const j = await r.json();
    console.log("\nSUGGEST (no bearer) status=", r.status);
    console.log("  data keys:", Object.keys(j.data || {}));
    console.log("  items:", JSON.stringify(j.data?.items || j.data?.list || []).slice(0, 500));
  } catch (e) {
    console.log("SUGGEST ERROR", e.message);
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
