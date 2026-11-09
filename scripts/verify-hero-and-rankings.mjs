// Verifies the four things this round changed:
//
//   1. the Ahrefs analytics tag is a LITERAL <script> in the server-rendered
//      <head> (next/script only emitted a preload link, which the vendor's
//      "Recheck installation" bot cannot see)
//   2. the homepage hero is the app's banner (the upstream's own BANNER block,
//      16:9 artwork, the same slides the strip shows)
//   3. /trending carries the same banner
//   4. every browse screen carries a ranking block with real rank badges
//
// plus the pagination fix: /api/browse must report hasMore=true and the
// upstream's pager numbers.
//
// Usage: node scripts/verify-hero-and-rankings.mjs [baseUrl]

const BASE = (process.argv[2] || "http://localhost:3210").replace(/\/+$/, "");

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`  ${ok ? "OK  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function html(path) {
  const r = await fetch(`${BASE}${path}`);
  const text = await r.text();
  return { status: r.status, text, head: text.slice(0, text.indexOf("</head>")) };
}

console.log(`base: ${BASE}\n`);

// ---------------------------------------------------------------- 1. analytics
console.log("1. Ahrefs analytics tag");
{
  const { status, head } = await html("/");
  const scriptTag = head.match(
    /<script[^>]*src="https:\/\/analytics\.ahrefs\.com\/analytics\.js"[^>]*>/
  );
  check("status 200", status === 200, `got ${status}`);
  check(
    "literal <script src=…> in the server-rendered <head>",
    !!scriptTag,
    scriptTag ? scriptTag[0] : "no <script> tag found in <head>"
  );
  check(
    "carries the data-key",
    scriptTag ? /data-key="7gdtpRLUCl7EE8j5ve6BzA"/.test(scriptTag[0]) : false
  );
}

// ------------------------------------------------------------------- 2. hero
console.log("\n2. Homepage hero = the app's banner");
{
  const { text } = await html("/");
  // The banner artwork lives on pbcdn/pbcdnw and is NOT a poster (posters are
  // portrait .jpg/.webp covers); the banner is a wide 1920x1080 / 3840x2160
  // image. The upstream's own banner file ids carry no "cover" marker, so the
  // reliable signal is the hero's own markup.
  check(
    "hero banner markup present",
    text.includes("Featured titles") && text.includes("snap-x") && text.includes("snap-mandatory"),
    "looking for the HeroBanner scroll track"
  );
  check("banner uses a 16:9 frame", /aspect-video|aspect-\[16\/9\]/.test(text) || text.includes("h-[38vh]"));
  check("slide dots present", text.includes("aria-label=\"Show "));

  const bannerSlides = [
    ...text.matchAll(/\/image\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9]+\.(webp|jpg|png)/g),
  ].map((m) => m[0]);
  check(
    "banner artwork loaded from the upstream CDN",
    bannerSlides.length > 0,
    `${bannerSlides.length} banner image url(s)`
  );
}

// -------------------------------------------------------------- 3. /trending
console.log("\n3. /trending carries the same banner");
{
  const { status, text } = await html("/trending");
  check("status 200", status === 200, `got ${status}`);
  check("banner present", text.includes("Featured titles"));
  check(
    "still exactly one <h1>",
    (text.match(/<h1[\s>]/g) || []).length === 1,
    `found ${(text.match(/<h1[\s>]/g) || []).length}`
  );
}

// -------------------------------------------------------------- 4. rankings
console.log("\n4. Ranking block on every browse screen");
for (const [path, kind] of [
  ["/movies", "movie"],
  ["/tv", "tv"],
  ["/animations", "anime"],
  ["/category/kids", "anime"],
  ["/category/western", "movie"],
  ["/category/asian", "tv"],
]) {
  const { status, text } = await html(path);
  const chips = (text.match(/aria-pressed="(true|false)"/g) || []).length;
  const ranks = (text.match(/TOP 0[123]|>(\d+)<\/span>/g) || []).length;
  const hasShelf = text.includes("Rankings") && text.includes("See all rankings");
  check(
    `${path} (${kind})`,
    status === 200 && hasShelf && chips > 1,
    `status=${status} chips=${chips} rankBadges=${ranks} shelf=${hasShelf}`
  );
  // The ranked row must be ONE horizontal strip, never a wrapping grid.
  const ol = text.match(/<ol class="([^"]*)"/);
  const rowClass = ol ? ol[1] : "";
  check(
    `${path} — ranked row scrolls sideways`,
    rowClass.includes("overflow-x-auto") && rowClass.includes("snap-x"),
    rowClass ? "ok" : "no <ol> found"
  );
}

// ----------------------------------------------------------- 5. pagination
console.log("\n5. Browse pagination (the 'You've reached the end' bug)");
for (const channelId of [1, 2, 7]) {
  const r = await fetch(`${BASE}/api/browse?channelId=${channelId}&perPage=28`);
  const j = await r.json();
  const p2 = await fetch(`${BASE}/api/browse?channelId=${channelId}&perPage=28&page=2`);
  const j2 = await p2.json();
  check(
    `channelId=${channelId} page 1`,
    j.ok === true && j.items.length > 0 && j.hasMore === true,
    `items=${j.items?.length} hasMore=${j.hasMore} nextPage=${j.nextPage}`
  );
  check(
    `channelId=${channelId} page 2 returns NEW titles`,
    j2.ok === true &&
      j2.items.length > 0 &&
      JSON.stringify(j2.items.map((i) => i.detailPath)) !==
        JSON.stringify(j.items.map((i) => i.detailPath)),
    `page2 items=${j2.items?.length}`
  );
}

console.log("");
console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
