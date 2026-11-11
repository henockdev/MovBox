/**
 * Submit the site's URLs to IndexNow in bulk, PRIORITY FIRST.
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
 * The URLs are ordered so the ones that matter most go first: the static
 * routes (home, browse screens, genres, categories, blog, legal) and the
 * title pages (movie/tv) are worth far more than the 24k episode pages,
 * and episode pages are the bulk of the set. If the run is interrupted,
 * the important pages are already submitted.
 *
 * Usage:
 *   node scripts/submit-indexnow.mjs [baseUrl] [--dry-run] [--all]
 *
 * Flags:
 *   --dry-run   collect and report the URLs, but send nothing
 *   --all       send every URL (default: the first 10,000)
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const BASE = (process.argv[2] || "https://movbox.xyz").replace(/\/+$/, "");
const DRY_RUN = process.argv.includes("--dry-run");
const SEND_ALL = process.argv.includes("--all");

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

/**
 * How much a URL matters, for ordering only.
 *
 *   0 = a static route or a title page  (home, /movies, /genres/…, /movie/…)
 *   1 = an episode page                 (/watch/tv/…?s=1&e=10)
 *
 * Episode pages are ~97% of the set. If the submission is cut short, the
 * pages a visitor actually lands on should already be in.
 */
function priorityOf(url) {
  return url.includes("/watch/") ? 1 : 0;
}

async function main() {
  const all = [];
  for (const rel of SITEMAPS) {
    const xml = await readFile(join(ROOT, rel), "utf8");
    const locs = locsFrom(xml);
    console.log(`${rel}: ${locs.length} <loc> entries`);
    all.push(...locs);
  }

  // De-duplicate, keep only this host's URLs, and order by priority.
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

  const priority = urls.filter((u) => priorityOf(u) === 0);
  const episodes = urls.filter((u) => priorityOf(u) === 1);
  const ordered = [...priority, ...episodes];

  console.log(`\nunique URLs for ${hostOf(BASE)}: ${ordered.length}`);
  console.log(`  priority (static + title pages): ${priority.length}`);
  console.log(`  episode pages:                   ${episodes.length}`);

  const toSend = SEND_ALL ? ordered : ordered.slice(0, BATCH_SIZE);
  if (!SEND_ALL && ordered.length > BATCH_SIZE) {
    console.log(
      `\nsending the first ${toSend.length} (the rest need a --all run)`
    );
  }

  if (DRY_RUN) {
    console.log("\nfirst 8:", toSend.slice(0, 8));
    console.log("last 8: ", toSend.slice(-8));
    console.log("\n--dry-run: nothing sent.");
    return;
  }

  const batches = [];
  for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
    batches.push(toSend.slice(i, i + BATCH_SIZE));
  }
  console.log(`\nbatches: ${batches.length} (max ${BATCH_SIZE} each)\n`);

  let ok = 0;
  let failed = 0;

  for (const [i, urlList] of batches.entries()) {
    const body = {
      host: hostOf(BASE),
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList,
    };
    const label = `batch ${i + 1}/${batches.length} (${urlList.length} urls)`;

    // 429 means "too many requests, potential spam". Back off and retry the
    // same batch rather than dropping those URLs on the floor.
    let attempt = 0;
    let res = null;
    let text = "";
    while (attempt < 4) {
      attempt++;
      res = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      });
      text = await res.text();
      if (res.status !== 429) break;
      const wait = 30_000 * attempt;
      console.log(`  ${label}: HTTP 429, retrying in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }

    if (res.ok) {
      ok++;
      console.log(`  ${label} -> HTTP ${res.status} ${res.statusText}`);
    } else {
      failed++;
      console.log(
        `  ${label} -> HTTP ${res.status} ${res.statusText} :: ${text.slice(0, 400)}`
      );
    }
    // Be polite to the IndexNow endpoint between batches.
    if (i < batches.length - 1) await new Promise((r) => setTimeout(r, 10_000));
  }

  console.log(`\nsent ${batches.length} batches: ${ok} accepted, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
