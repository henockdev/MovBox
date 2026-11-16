#!/usr/bin/env node
/**
 * Which ad units are actually present in the served HTML of each page type?
 *
 * Read-only: it fetches the pages and looks for the network's own script
 * URLs. It does not click anything.
 *
 * Usage: node scripts/verify-ads.mjs [base-url]
 */

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");

const UNITS = {
  "Adsterra social bar (31080288)": "pl31180787.profitableratecpmnetwork.com",
  "Adsterra popunder (31080286)": "pl31180785.profitableratecpmnetwork.com",
  "Hilltop banner (7538401)": "conventionalresponse.com/bvXEV",
  "Hilltop video slider (7538385)": "conventionalresponse.com/baX_V",
  "Hilltop VAST (7538417)": "butterygrandmother.com/dlm.FazMd",
};

const PAGES = [
  ["/", "homepage"],
  ["/movies", "browse"],
  ["/tv/campus-drivers-english-ShHvTvEttW4", "series detail"],
  ["/watch/tv/campus-drivers-english-ShHvTvEttW4?s=1&e=1", "watch"],
];

for (const [path, label] of PAGES) {
  let html;
  let status = 0;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0" },
    });
    status = res.status;
    html = await res.text();
  } catch (e) {
    console.log(`\n${label} (${path}) -> ERROR ${e.message}`);
    continue;
  }
  console.log(`\n${label}  (${path})  HTTP ${status}, ${html.length} bytes`);
  for (const [name, needle] of Object.entries(UNITS)) {
    console.log(`  ${html.includes(needle) ? "present" : "absent "}  ${name}`);
  }
}
