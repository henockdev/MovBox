// 1) Does /subject/filter actually paginate, and does it report `hasMore`?
//    The browse grid shows "You've reached the end." whenever hasMore is false,
//    so a missing/incorrect hasMore is exactly "it stops at the end".
//
// 2) Which tab-operating tabs exist, and which ranking groups does each one
//    carry? The app shows a ranking chip row on EVERY tab (Movie, TV, Anime).
//
// Usage: node scripts/probe-browse-and-tabs.mjs

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
  const m = (r.headers.get("set-cookie") || "").match(/(?:^|,\s*)token=([^;]+)/i);
  if (!m) throw new Error("no token");
  return m[1];
}

async function h5Get(path, token) {
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
  if (!r.ok) return { __error: `HTTP ${r.status}: ${text.slice(0, 100)}` };
  return JSON.parse(text);
}

async function h5Post(path, body, token) {
  const r = await fetch(`${H5_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: SITE_HOST,
      Referer: `${SITE_HOST}/`,
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) return { __error: `HTTP ${r.status}: ${text.slice(0, 100)}` };
  return JSON.parse(text);
}

const token = await mintToken();

console.log("=".repeat(74));
console.log("1) /subject/filter pagination");
console.log("=".repeat(74));

for (const channelId of [1, 2, 1006]) {
  console.log(`\n--- channelId=${channelId}`);
  for (const page of [1, 2, 3, 10]) {
    const json = await h5Post(
      "/subject/filter",
      {
        page,
        perPage: 28,
        channelId,
        genre: "",
        country: "",
        year: "",
        language: "",
        sort: "ForYou",
      },
      token
    );
    if (json.__error) {
      console.log(`  page ${page}: ${json.__error}`);
      continue;
    }
    const d = json?.data ?? {};
    console.log(
      `  page ${String(page).padStart(2)}: items=${String(d.items?.length ?? "-").padStart(3)}` +
        `  hasMore=${JSON.stringify(d.hasMore)}` +
        `  nextPage=${JSON.stringify(d.nextPage)}` +
        `  totalCount=${JSON.stringify(d.totalCount)}` +
        `  dataKeys=[${Object.keys(d).join(",")}]`,
    );
  }
}

console.log("");
console.log("=".repeat(74));
console.log("2) /tab-operating tabs and their ranking groups");
console.log("=".repeat(74));

for (let tabId = 0; tabId <= 12; tabId++) {
  const json = await h5Get(`/tab-operating?tabId=${tabId}`, token);
  if (json.__error) {
    console.log(`tabId=${tabId}: ${json.__error}`);
    continue;
  }
  const list = json?.data?.operatingList ?? [];
  const rows = list
    .filter((e) => Array.isArray(e.subjects) && e.subjects.length)
    .map((e) => `${e.title}(${e.subjects.length})`);
  const banner = list.find((e) => e?.type === "BANNER");
  console.log(
    `tabId=${tabId}: ${list.length} entries  banner=${banner ? banner.title : "-"}\n` +
      `          ${rows.join(" | ")}`,
  );
}
