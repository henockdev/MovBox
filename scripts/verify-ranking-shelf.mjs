/**
 * The ranking shelf must show the WHOLE group, like the app does.
 *
 * The upstream's ranking groups hold 10–20 titles, and the app's
 * `RankingSectionView` renders `group?.items.orEmpty()` with no cap at all.
 * The web shelf used to truncate the row at 12 while the chip beside it
 * advertised the group's real count — so the row contradicted its own
 * label, and the last titles of every ranking were unreachable without a
 * click through to the full list.
 *
 * This check reads the rendered HTML and compares:
 *   - the chip's count (the upstream's own number)
 *   - the number of rank badges in the ranked row
 * They must be equal.
 *
 * Usage: node scripts/verify-ranking-shelf.mjs [baseUrl] [path ...]
 */

const BASE = (process.argv[2] || "http://localhost:3210").replace(/\/+$/, "");
const PATHS = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ["/tv", "/movies", "/animations", "/category/live"];

/** The chip's count: the upstream's own number for that group. */
function chipCounts(html) {
  return [
    ...html.matchAll(
      /aria-pressed="(?:true|false)"[\s\S]{0,600}?tabular-nums[^>]*>\s*(\d+)\s*</g
    ),
  ].map((m) => Number(m[1]));
}

/** The ranked row is the <ol> that holds the rank badges. */
function rankBadges(html) {
  const ol = html.match(/<ol class="no-scrollbar[^"]*"[\s\S]*?<\/ol>/);
  if (!ol) return [];
  return [...ol[0].matchAll(/>(TOP \d+|\d+)<\/span>/g)].map((m) => m[1]);
}

let failed = 0;

for (const path of PATHS) {
  const url = `${BASE}${path}`;
  let html = "";
  try {
    const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
    html = await res.text();
  } catch (e) {
    console.log(`ERR  ${path} — ${e.message}`);
    failed++;
    continue;
  }

  const chips = chipCounts(html);
  const badges = rankBadges(html);

  if (!chips.length) {
    console.log(`SKIP ${path} — no ranking shelf on this page`);
    continue;
  }

  const expected = chips[0];
  const actual = badges.length;

  if (actual === expected) {
    console.log(
      `PASS  ${path}  the ranked row shows all ${actual} titles the chip advertises`
    );
  } else {
    failed++;
    console.log(
      `FAIL  ${path}  the chip advertises ${expected} titles but the row renders ${actual}`
    );
  }
}

console.log(failed ? `\n${failed} failed` : "\nall checks passed");
if (failed) process.exit(1);
