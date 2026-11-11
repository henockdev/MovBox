/**
 * Submit the site's URLs to IndexNow in bulk.
 *
 * IndexNow's bulk endpoint accepts up to 10,000 URLs per request:
 *
 *   POST https://api.indexnow.org/indexnow
 *   {
 *     "host": "movbox.xyz",
 *     "key": "<the key>",
 *     "keyLocation": "https://movbox.xyz/<key>.txt",
 *     "urlList": ["https://movbox.xyz/...", ...]
 *   }
 *
 * The key file must be reachable at `keyLocation` BEFORE the first
 * submission, or the request is rejected with 403.
 *
 * Usage:
 *   node scripts/submit-indexnow.mjs [baseUrl] [--dry-run]
 *
 * Flags:
 *   --dry-run   collect and report the URLs, but send nothing
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const DRY_RUN = process.argv.includes("--dry-run");

/** The key, and the file that hosts it at the site root. */
const KEY = "ff581ff75ad04c45b503b462b52155c4";
const KEY_LOCATION = `${BASE}/${KEY}.txt`;

/** IndexNow's bulk limit. */
const BATCH_SIZE = 10000;

/** The sitemaps that make up the indexable URL set. */
const SITEMAPS = ["public/sitemap.xml", "public/video-sitemap.xml"];

function hostOf(url) {
  return new URL(url).host;
}

/**
 * Pull every <loc> out of a sitemap. The video sitemap repeats the same
 * <loc> values as the main sitemap (a URL with a <video:video> block), so
 * the two lists are merged and de-duplicated at the end.
 *
 * The episode URLs carry a query string, and in XML that `&` is written as
 * `&amp;`. That is correct in the sitemap file, but IndexNow wants the raw
 * URL — `?s=1&e=10`, not `?s=1&amp;e=10` — so the entities are decoded.
 */
function locsFrom(xml) {
  const out = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    out.push(decodeXmlEntities(m[1].trim()));
  }
  return out;
}

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function main() {
  const all = [];
  for (const rel of SITEMAPS) {
    const xml = await readFile(join(ROOT, rel), "utf8");
    const locs = locsFrom(xml);
    console.log(`${rel}: ${locs.length} <loc> entries`);
    all.push(...locs);
  }

  // De-duplicate, and keep only URLs that belong to THIS host — IndexNow
  // rejects a mixed-host batch.
  const seen = new Set();
  const urls = [];
  for (const u of all) {
    if (seen.has(u)) continue;
    if (hostOf(u) !== hostOf(BASE)) {
      console.log(`  skipping (different host): ${u}`);
      continue;
    }
    seen.add(u);
    urls.push(u);
  }

  console.log(`\nunique URLs for ${hostOf(BASE)}: ${urls.length}`);

  if (DRY_RUN) {
    console.log("first 5:", urls.slice(0, 5));
    console.log("last  5:", urls.slice(-5));
    console.log("\n--dry-run: nothing sent.");
    return;
  }

  const batches = [];
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    batches.push(urls.slice(i, i + BATCH_SIZE));
  }
  console.log(`batches: ${batches.length} (max ${BATCH_SIZE} each)\n`);

  let ok = 0;
  let failed = 0;

  for (const [i, urlList] of batches.entries()) {
    const body = {
      host: hostOf(BASE),
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList,
    };
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.ok) {
      ok++;
      console.log(
        `batch ${i + 1}/${batches.length}: ${urlList.length} urls -> HTTP ${res.status} ${res.statusText}`
      );
    } else {
      failed++;
      console.log(
        `batch ${i + 1}/${batches.length}: ${urlList.length} urls -> HTTP ${res.status} ${res.statusText} :: ${text.slice(0, 400)}`
      );
    }
    // Be polite to the IndexNow endpoint between batches.
    if (i < batches.length - 1) await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\nsent ${batches.length} batches: ${ok} accepted, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
