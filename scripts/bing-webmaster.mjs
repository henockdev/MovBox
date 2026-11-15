/**
 * Bing Webmaster API — indexation and search-performance diagnostics.
 *
 * The API key is read from the BING_WM_API_KEY environment variable so it
 * never lands in source control (this repo is public).
 *
 *   $env:BING_WM_API_KEY = "<key>"
 *   node scripts/bing-webmaster.mjs [siteUrl]
 *
 * With no siteUrl, the script asks Bing which sites the key owns
 * (GetUserSites) and uses the movbox.xyz one.
 *
 * WHAT THIS SHOWS (measured 2026-11-15, site: https://movbox.xyz/)
 *
 *   - GetUserSites        → both https://movbox.xyz/ and https://furtu.xyz/
 *                           are verified on this key.
 *   - GetRankAndTrafficStats → daily impressions/clicks. This is the answer
 *                           to "why no impressions".
 *   - GetQueryStats       → the top queries, with clicks and position.
 *   - GetPageStats        → which URL earned the impressions.
 *   - GetCrawlStats       → daily crawl/index state. Proves whether the
 *                           site is being crawled at all.
 *   - GetUrlInfo          → per-URL index state (discovery, last crawl,
 *                           document size, anchors).
 *
 * NOTE ON THE ENDPOINT NAMES. Bing's JSON API 404s on the names that look
 * obvious ("GetSiteMaps", "GetIndexCoverage", "GetSiteStats", "GetIndexedUrls",
 * "GetUrlSubmissionInfo"). The methods that actually answer this question are
 * GetUserSites, GetRankAndTrafficStats, GetQueryStats, GetPageStats,
 * GetCrawlStats, GetCrawlIssues, GetLinkCounts, GetUrlInfo, GetKeywordStats.
 *
 * The site list uses `Url`, not `SiteUrl`, and `IsVerified`, not `Verified`.
 */

import { writeFile } from "node:fs/promises";

const KEY = process.env.BING_WM_API_KEY;
if (!KEY) {
  console.error("Set BING_WM_API_KEY first.");
  process.exit(1);
}

const API = "https://ssl.bing.com/webmaster/api.svc/json";

async function call(method, params = {}) {
  const search = new URLSearchParams({ apikey: KEY, ...params });
  const res = await fetch(`${API}/${method}?${search}`, {
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* Bing answers some faults with a bare body */
  }
  return { status: res.status, text: text || "(empty body)", json };
}

/** Bing's dates look like /Date(1788764400000-0700)/ — make them readable. */
function bingDate(s) {
  const m = String(s).match(/\/Date\((-?\d+)/);
  if (!m) return "never";
  const v = Number(m[1]);
  if (v < 0) return "never";
  return new Date(v).toISOString().slice(0, 10);
}

function flatten(obj, prefix = "", depth = 0, out = []) {
  if (!obj || typeof obj !== "object" || depth > 3) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (k === "__type") continue;
    if (Array.isArray(v)) {
      out.push(`${prefix}${k}: [${v.length}]`);
      if (v.length && typeof v[0] === "object") flatten(v[0], `${prefix}  `, depth + 1, out);
    } else if (typeof v === "object") {
      out.push(`${prefix}${k}:`);
      flatten(v, `${prefix}  `, depth + 1, out);
    } else {
      out.push(`${prefix}${k}: ${v}`);
    }
  }
  return out;
}

async function main() {
  const lines = [];
  const say = (s = "") => {
    lines.push(s);
    console.log(s);
  };

  const sites = await call("GetUserSites");
  say(`GetUserSites -> HTTP ${sites.status}`);
  const list = sites.json?.d ?? [];
  for (const s of list) say(`  ${s.Url}  (verified: ${s.IsVerified ?? "?"})`);

  // ONLY movbox.xyz — the other site on this key is a different project.
  const site = process.argv[2] || list.find((s) => String(s.Url).includes("movbox.xyz"))?.Url;
  if (!site) {
    say("\nNo movbox.xyz site on this key.");
    await writeFile("bwt-report.txt", lines.join("\n"), "utf8");
    return;
  }
  say(`\nQuerying site: ${site}\n${"=".repeat(60)}`);

  const P = { siteUrl: site };

  // 1. The traffic timeline — the "why no impressions" answer.
  const t = await call("GetRankAndTrafficStats", P);
  const tr = t.json?.d ?? [];
  say(`\n--- GetRankAndTrafficStats (${tr.length} days) ---`);
  let ti = 0, tc = 0;
  for (const r of tr) {
    ti += r.Impressions || 0;
    tc += r.Clicks || 0;
  }
  say(`  TOTAL: impressions=${ti} clicks=${tc}`);
  say("  last 21 days:");
  for (const r of tr.slice(-21)) {
    say(`    ${bingDate(r.Date)}  impressions=${r.Impressions} clicks=${r.Clicks}`);
  }

  // 2. Which queries, which pages.
  for (const method of ["GetQueryStats", "GetPageStats"]) {
    const r = await call(method, P);
    say(`\n--- ${method} --- HTTP ${r.status}`);
    const rows = r.json?.d ?? [];
    const withData = rows.filter((x) => (x.Impressions ?? 0) > 0 || (x.Clicks ?? 0) > 0);
    say(`  rows=${rows.length}, with impressions/clicks=${withData.length}`);
    for (const x of withData.slice(0, 25)) {
      say(
        `  ${bingDate(x.Date)}  ${String(x.Query ?? "").slice(0, 58).padEnd(60)} impr=${String(x.Impressions ?? 0).padStart(6)} clicks=${String(x.Clicks ?? 0).padStart(5)} pos=${x.AvgImpressionPosition ?? "-"}`
      );
    }
  }

  // 3. Crawl health — is Bing still crawling?
  const c = await call("GetCrawlStats", P);
  say(`\n--- GetCrawlStats (last 14 days) --- HTTP ${c.status}`);
  const cr = c.json?.d ?? [];
  for (const r of cr.slice(-14)) {
    say(
      `  ${bingDate(r.Date)}  crawled=${r.CrawledPages} inIndex=${r.InIndex} 2xx=${r.Code2xx} 4xx=${r.Code4xx} 5xx=${r.Code5xx} errors=${r.CrawlErrors} blocked=${r.BlockedByRobotsTxt}`
    );
  }

  for (const method of ["GetCrawlIssues", "GetLinkCounts", "GetKeywordStats"]) {
    const r = await call(method, P);
    say(`\n--- ${method} --- HTTP ${r.status}`);
    for (const line of flatten(r.json)) say(`  ${line}`);
  }

  // 4. Per-URL index state.
  say(`\n--- GetUrlInfo ---`);
  for (const u of [
    `${site}`,
    `${site}signup`,
    `${site}movies`,
    `${site}tv`,
    `${site}trending`,
    `${site}most-watched`,
    `${site}rankings`,
  ]) {
    const r = await call("GetUrlInfo", { siteUrl: site, url: u });
    const x = r.json?.d;
    if (!x) {
      say(`  ${u.replace(site, "/")}  HTTP ${r.status} ${r.text.slice(0, 60)}`);
      continue;
    }
    say(
      `  ${u.replace(site, "/").padEnd(16)} http=${x.HttpStatus} discovered=${bingDate(x.DiscoveryDate)} lastCrawled=${bingDate(x.LastCrawledDate)} size=${x.DocumentSize} anchors=${x.AnchorCount} children=${x.TotalChildUrlCount}`
    );
  }

  await writeFile("bwt-report.txt", lines.join("\n"), "utf8");
  say("\n\n[written to bwt-report.txt]");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
