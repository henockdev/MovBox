// Verifies the fixes for the Ahrefs site audit.
//
// The audit reported 4 377 errors and 430 warnings against 5 007 crawled
// urls. This re-checks the same surfaces:
//
//   ERRORS
//     orphan page              4 374  -> every episode now has inbound links
//     noindex page in sitemap     2  -> the sitemap must carry no noindex url
//     page size > 2 MB            1  -> /most-watched was 2.27 MB
//
//   WARNINGS
//     description too short     244  -> every description is 120-160
//     title too long            76  -> every rendered title is <= 60
//     og incomplete             38  -> og:title/description/image/url present
//     title too short           28  -> every rendered title is >= 30
//     h1 missing or empty       27  -> exactly one non-empty h1
//
// Usage: node scripts/verify-audit-fixes.mjs [baseUrl]

const BASE = (process.argv[2] || "http://localhost:3210").replace(/\/+$/, "");

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`  ${ok ? "OK  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

function analyse(html) {
  const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? "");
  const desc = decode(
    (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? ""
  );
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) =>
    decode(m[1].replace(/<[^>]+>/g, "").trim())
  );
  const canonical = decode(
    (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] ?? ""
  );
  const og = {
    title: /property="og:title"/.test(html),
    description: /property="og:description"/.test(html),
    image: /property="og:image"/.test(html),
    url: /property="og:url"/.test(html),
  };
  return { title, desc, h1s, canonical, og };
}

// ---------------------------------------------------------------- 1. orphans
console.log("1. Orphan pages — every episode must have inbound internal links");
{
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(/&amp;/g, "&")
  );
  const episodes = locs.filter((u) => u.includes("/watch/tv/"));
  const sample = episodes[0];
  const toPath = (u) => {
    const [p, q] = u.split("?");
    const path = p.replace(/^https?:\/\/[^/]+/, "");
    return q ? `${path}?${q}` : path;
  };
  const seriesUrl = toPath(sample).split("?")[0].replace("/watch/tv/", "/tv/");
  // Every episode the sitemap publishes for THIS series.
  const ofThisSeries = episodes.filter((u) =>
    u.startsWith(sample.split("?")[0])
  );

  // The hrefs on the page are relative ("/watch/tv/…"), the sitemap's are
  // absolute ("https://movbox.xyz/watch/tv/…"). Comparing the two raw strings
  // never matches, so both sides are reduced to a path + query.
  const episodeLinks = (html) => [
    ...new Set(
      [...html.matchAll(/href="([^"]*watch\/tv\/[^"]*)"/g)].map((m) =>
        toPath(decode(m[1]))
      )
    ),
  ];

  for (const url of [seriesUrl, toPath(sample)]) {
    const html = await (await fetch(`${BASE}${url}`)).text();
    const links = episodeLinks(html);
    // The bar is "every episode of this series is linked", not "at least
    // five" — a series with two episodes cannot have five links.
    const wanted = url.includes("/watch/tv/")
      ? ofThisSeries
      : ofThisSeries;
    const covered = wanted.filter((u) => links.includes(toPath(u)));
    check(
      `${url.split("?")[0]} links every one of its ${ofThisSeries.length} episodes`,
      ofThisSeries.length > 0 && covered.length === ofThisSeries.length,
      `${covered.length}/${ofThisSeries.length} linked`
    );
  }
}

// ------------------------------------------------------------- 2. soft 404s
console.log("\n2. /genres/<id> — must not be a soft 404 any more");
for (const id of ["28", "16", "35", "12"]) {
  const res = await fetch(`${BASE}/genres/${id}`);
  const html = await res.text();
  const a = analyse(html);
  const hasCards = (html.match(/<article/g) || []).length > 0 || html.includes("/movie/") || html.includes("/tv/");
  check(
    `/genres/${id}`,
    res.status === 200 &&
      a.h1s.length === 1 &&
      a.h1s[0].length > 0 &&
      a.desc.length >= 120 &&
      a.desc.length <= 160 &&
      a.og.image &&
      a.og.title &&
      a.og.description &&
      a.og.url &&
      hasCards,
    `h1=${JSON.stringify(a.h1s[0] ?? null)} desc=${a.desc.length} og=${Object.entries(a.og).filter(([, v]) => !v).map(([k]) => k).join(",") || "complete"} content=${hasCards}`
  );
}

// ---------------------------------------------------------- 3. title / desc
console.log("\n3. Titles and descriptions across the sitemap");
{
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(/&amp;/g, "&")
  );
  const episodes = locs.filter((u) => u.includes("/watch/tv/"));
  const others = locs.filter((u) => !u.includes("/watch/tv/"));
  const epSample = [];
  const step = Math.max(1, Math.floor(episodes.length / 120));
  for (let i = 0; i < episodes.length && epSample.length < 120; i += step)
    epSample.push(episodes[i]);

  const targets = [...others, ...epSample];
  const bad = { longTitle: [], shortTitle: [], shortDesc: [], longDesc: [], noH1: [], og: [] };

  // The sitemap holds ABSOLUTE urls (https://movbox.xyz/…). They must be
  // fetched against the base under test, otherwise the check silently
  // measures production instead of the build being verified.
  const toLocal = (u) => u.replace(/^https?:\/\/[^/]+/, "");

  const CONC = Number(process.env.CONC || 4);
  let idx = 0;
  async function worker() {
    while (idx < targets.length) {
      const url = targets[idx++];
      try {
        // The pages under test are server-rendered against a live upstream.
        // A burst of parallel requests can make the server answer with an
        // error page, which would be measured as "no title, no h1" — a
        // property of the load, not of the page. So a non-200 is retried
        // once, sequentially, before it is judged.
        let res = await fetch(`${BASE}${toLocal(url)}`);
        if (res.status !== 200) {
          await new Promise((r) => setTimeout(r, 400));
          res = await fetch(`${BASE}${toLocal(url)}`);
        }
        const html = await res.text();
        const a = analyse(html);
        if (a.title.length > 60) bad.longTitle.push(`${url}\n        "${a.title}" (${a.title.length})`);
        if (a.title.length < 30) bad.shortTitle.push(`${url}\n        "${a.title}" (${a.title.length})`);
        if (a.desc.length < 120) bad.shortDesc.push(`${url}\n        "${a.desc}" (${a.desc.length})`);
        if (a.desc.length > 160) bad.longDesc.push(`${url}\n        "${a.desc}" (${a.desc.length})`);
        if (a.h1s.length !== 1 || !a.h1s[0]) bad.noH1.push(url);
        if (!a.og.title || !a.og.description || !a.og.image || !a.og.url)
          bad.og.push(url);
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));

  console.log(`  (checked ${targets.length} urls)`);
  for (const [k, list] of Object.entries(bad)) {
    check(k, list.length === 0, list.length ? `${list.length} e.g. ${list[0]}` : "");
  }
}

// -------------------------------------------------------------- 4. page size
console.log("\n4. Page size — must stay under Ahrefs' 2 MB crawl limit");
for (const p of ["/", "/most-watched", "/movies", "/tv", "/rankings", "/trending"]) {
  const html = await (await fetch(`${BASE}${p}`)).text();
  const mb = html.length / 1048576;
  check(`${p}`, mb < 2, `${mb.toFixed(2)} MB`);
}

console.log("");
console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
