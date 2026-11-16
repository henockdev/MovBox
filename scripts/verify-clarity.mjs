/**
 * Verify the Microsoft Clarity integration.
 *
 *   node scripts/verify-clarity.mjs http://localhost:3210
 *   node scripts/verify-clarity.mjs https://movbox.xyz
 *
 * What it proves:
 *
 *   1. The installation is marked in the served HTML (the head carries
 *      <meta name="clarity-project" content="ze20elh5au">) and the tag
 *      itself is really in the shipped client bundle.
 *   2. The 18+ routes mark themselves excluded AND masked, so the tag is
 *      never injected there and their content is never recorded.
 *   3. An 18+ title's own page carries both markers.
 *   4. An ordinary title's page carries neither marker.
 *
 * The tag is injected at runtime (that is what keeps it off the 18+
 * pages), so "the tag does not load here" is a browser question — the
 * network log in the browser is where that is proved.
 */

const base = (process.argv[2] || "http://localhost:3210").replace(/\/$/, "");
const PROJECT_ID = "ze20elh5au";

let failures = 0;

function check(name, ok, detail = "") {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function html(path) {
  const r = await fetch(`${base}${path}`, {
    headers: { "User-Agent": "movbox-verify/1.0" },
  });
  if (!r.ok && r.status !== 404) {
    throw new Error(`${path} -> HTTP ${r.status}`);
  }
  return await r.text();
}

const hasMeta = (s) =>
  s.includes(`name="clarity-project"`) && s.includes(PROJECT_ID);
const hasExclude = (s) => s.includes('data-clarity-exclude="true"');
const hasMask = (s) => s.includes('data-clarity-mask="true"');

function firstTvSlug(s) {
  const m = s.match(/href="\/tv\/([^"?#]+)"/);
  return m ? m[1] : null;
}

console.log(`Clarity verification against ${base}\n`);

// ---- 1. the installation is marked and really shipped ------------------
console.log("Installation");
for (const path of ["/", "/movies", "/trending", "/rankings"]) {
  const s = await html(path);
  check(`${path} carries the clarity-project marker`, hasMeta(s));
}

const home = await html("/");
const chunkUrls = [...home.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map(
  (m) => m[1]
);
let chunkWithTag = null;
for (const url of chunkUrls.slice(0, 40)) {
  const s = await (await fetch(`${base}${url}`)).text();
  if (s.includes(PROJECT_ID)) {
    chunkWithTag = url;
    break;
  }
}
check(
  "the shipped client bundle contains the Clarity tag",
  !!chunkWithTag,
  chunkWithTag ? "" : `no chunk of ${chunkUrls.length} carried the project id`
);

// ---- 2. the 18+ routes are excluded and masked -------------------------
console.log("\n18+ routes are excluded and masked");
for (const path of [
  "/category/midnight",
  "/rankings/adult-animation",
  "/rankings/bl-story",
]) {
  const s = await html(path);
  check(`${path} marks itself excluded`, hasExclude(s));
  check(`${path} masks its content`, hasMask(s));
}

// ---- 3. an 18+ title's page is excluded and masked --------------------
console.log("\n18+ titles are excluded and masked");
const midnight = await html("/category/midnight");
const adultSlug = firstTvSlug(midnight);
if (!adultSlug) {
  check("found an 18+ title to test", false, "no /tv/ link on /category/midnight");
} else {
  const s = await html(`/tv/${adultSlug}`);
  check(`/tv/${adultSlug} marks itself excluded`, hasExclude(s));
  check(`/tv/${adultSlug} masks its content`, hasMask(s));
}

// ---- 4. an ordinary title's page is untouched --------------------------
console.log("\nOrdinary titles are untouched");
const normalSlug = firstTvSlug(home);
if (!normalSlug) {
  check("found an ordinary title to test", false, "no /tv/ link on the homepage");
} else {
  const s = await html(`/tv/${normalSlug}`);
  check(`/tv/${normalSlug} is NOT excluded`, !hasExclude(s));
  check(`/tv/${normalSlug} is NOT masked`, !hasMask(s));
}

console.log(
  failures === 0
    ? "\nALL CLARITY CHECKS PASSED"
    : `\n${failures} CLARITY CHECK(S) FAILED`
);
process.exit(failures === 0 ? 0 : 1);
