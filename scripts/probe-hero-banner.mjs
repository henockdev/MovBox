// Does the h5-api publish the same BANNER block the app renders as its hero?
//
// The app's Trending page (its default tab) is:
//   1. a full-bleed 16:9 hero banner that auto-advances   <- the "BANNER" item
//   2. a compact slider strip of the same slides
//   3. poster rows + ranking sections
//
// The app reads that banner from the MOBILE bff (`api6`), whose shape is
// `data.items[]` with `itemType: "BANNER"` and `banner.banners[]`.
// The site reads the WEB bff (`h5-api`), whose shape is `data.operatingList[]`.
//
// The web's getBoxmoviesOperatingTab() currently DROPS every entry that has no
// `subjects` array - which is exactly where a banner entry would live. This
// probe answers whether there is a banner to pick up at all.
//
// Usage: node scripts/probe-hero-banner.mjs

const H5_API_BASE = "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const SITE_HOST = "https://boxmovies.org";
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

async function mintToken() {
  const r = await fetch(`${H5_API_BASE}/app/get-latest-app-pkgs?app_name=moviebox`, {
    headers: {
      Origin: SITE_HOST,
      Referer: `${SITE_HOST}/`,
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
    },
  });
  if (!r.ok) throw new Error(`token mint failed: HTTP ${r.status}`);
  const cookie = r.headers.get("set-cookie") || "";
  const m = cookie.match(/(?:^|,\s*)token=([^;]+)/i);
  if (!m) throw new Error("token mint: no token cookie");
  return m[1];
}

async function h5(path, token) {
  const r = await fetch(`${H5_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: SITE_HOST,
      Referer: `${SITE_HOST}/`,
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}: ${text.slice(0, 160)}`);
  return JSON.parse(text);
}

/** Describe one operating entry without dumping the whole payload. */
function describe(entry, index) {
  const keys = Object.keys(entry).sort();
  const out = {
    index,
    type: entry.type ?? entry.itemType ?? "?",
    title: entry.title ?? "",
    position: entry.position ?? entry.sort ?? "",
    keys,
  };
  const subjects = entry.subjects;
  out.subjects = Array.isArray(subjects) ? subjects.length : undefined;
  const banners = entry.banner?.banners ?? entry.banners ?? entry.bannerList;
  out.banners = Array.isArray(banners) ? banners.length : undefined;
  if (Array.isArray(banners) && banners.length) {
    out.bannerSample = banners.slice(0, 3).map((b) => ({
      keys: Object.keys(b).sort(),
      image: b.image ?? b.imageUrl ?? b.cover ?? b.coverUrl ?? null,
      subjectId:
        b.subject?.subjectId ?? b.subject?.id ?? b.subjectId ?? b.id ?? null,
      title: b.subject?.title ?? b.title ?? null,
    }));
  }
  return out;
}

const token = await mintToken();
console.log("token minted\n");

for (const path of [
  "/tab-operating?tabId=1",
  "/tab-operating?tabId=2",
  "/home?host=boxmovies.org",
]) {
  console.log("=".repeat(72));
  console.log(path);
  console.log("=".repeat(72));
  let json;
  try {
    json = await h5(path, token);
  } catch (e) {
    console.log(`  FAILED: ${e.message}\n`);
    continue;
  }
  const data = json?.data ?? {};
  console.log(`  data keys: ${Object.keys(data).sort().join(", ")}`);

  const operating = Array.isArray(data.operatingList) ? data.operatingList : [];
  console.log(`  operatingList: ${operating.length} entries`);
  for (const [i, entry] of operating.entries()) {
    const d = describe(entry, i);
    console.log(
      `   [${String(i).padStart(2)}] type=${String(d.type).padEnd(20)} ` +
        `pos=${String(d.position).padEnd(4)} subjects=${d.subjects ?? "-"} ` +
        `banners=${d.banners ?? "-"}  title=${JSON.stringify(d.title)}`,
    );
    if (d.bannerSample) console.log(`        banner sample: ${JSON.stringify(d.bannerSample, null, 2)}`);
  }

  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length) {
    console.log(`  items: ${items.length} entries (mobile-bff shape)`);
    for (const [i, entry] of items.entries()) {
      const d = describe(entry, i);
      console.log(
        `   [${String(i).padStart(2)}] itemType=${String(d.type).padEnd(20)} ` +
          `subjects=${d.subjects ?? "-"} banners=${d.banners ?? "-"} title=${JSON.stringify(d.title)}`,
      );
    }
  }
  console.log("");
}
