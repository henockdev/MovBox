/**
 * Ask the upstream about every distinct title in the sitemap.
 *
 * The audit says ~70% of the sitemap's detail pages have no title, no h1 and
 * no og:image. Either the upstream no longer has those titles (dead sitemap
 * entries) or the local render fails. This separates the two: it asks the
 * upstream directly, one title at a time, and counts the answers.
 *
 * Usage: node scripts/probe-sitemap-titles.mjs [limit] [concurrency]
 */

import { readFile } from "node:fs/promises";

const BASE =
  process.env.H5_API_BASE || "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const SITE_HOST = "https://boxmovies.org";
const UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";
const LIMIT = Number(process.argv[2] || 200);
const CONC = Number(process.argv[3] || 8);

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

const xml = await readFile("public/sitemap.xml", "utf8");
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
  m[1].replace(/&amp;/g, "&")
);

// The detail path is the last segment of /movie/<id>, /tv/<id> and
// /watch/<kind>/<id>.
const detailPaths = [
  ...new Set(
    locs
      .map((u) => u.replace(/^https?:\/\/[^/]+/, ""))
      .filter((p) => /^\/(movie|tv|watch\/(movie|tv))\//.test(p))
      .map((p) => decodeURIComponent(p.split("/").pop().split("?")[0]))
      .filter(Boolean)
  ),
].slice(0, LIMIT);

console.log(`asking the upstream about ${detailPaths.length} distinct titles`);

const tally = {};
const missing = [];
let idx = 0;

async function worker() {
  while (idx < detailPaths.length) {
    const p = detailPaths[idx++];
    try {
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
      const key = `HTTP ${res.status}/code=${json?.code}`;
      tally[key] = (tally[key] || 0) + 1;
      if (res.status !== 200) missing.push(p);
    } catch (e) {
      tally[`error: ${e.message}`] = (tally[`error: ${e.message}`] || 0) + 1;
    }
  }
}

await Promise.all(Array.from({ length: CONC }, worker));

console.log(tally);
if (missing.length) {
  console.log(`\nmissing (${missing.length}):`);
  for (const m of missing.slice(0, 25)) console.log(`  ${m}`);
}
