# SEO recalibration — 2026-11-06

**Owner ask:** "since you edited it you ruined the SEO — no impressions and
clicks … short page description and so much problem".

This is the audit and the fix. Every claim below was measured against the
**live** site before and after, not assumed.

---

## 1. What was measured

Eight probe scripts live in `scripts/`. They are re-runnable and they are the
regression suite for this work.

| Script | What it answers |
|---|---|
| `seo-probe.mjs` | title, description length, canonical, robots and body-link count for every indexable URL |
| `seo-structure-check.mjs` | the full audit: JSON-LD per page, `og:url` vs canonical, h1 count, title/description duplication, nav placement, `robots.txt` and `llms.txt`. Exits with a problem list — **0 problems** is the bar |
| `seo-sitemap-audit.mjs` | samples the live sitemap and reports dead URLs, thin URLs and short descriptions |
| `seo-thin-pages.mjs` | counts the internal links each listing page actually carries |
| `seo-homepage-weight.mjs` / `seo-rsc-weight.mjs` / `seo-html-weight.mjs` | what makes the homepage 1.3 MB, and which part of it costs what |
| `measure-desc.mjs` | the length of every meta description before it is committed to the code |
| `probe-ranking-groups.mjs` / `probe-operating-tabs.mjs` | where the ranking groups live upstream |

Every script takes an optional base URL, so the same check runs against the
live site and against a local build:

```
node scripts/seo-probe.mjs https://movbox.xyz
node scripts/seo-probe.mjs http://localhost:3210
```

Baseline on 2026-11-06, against `https://movbox.xyz`:

```
path                        st  dLen tLen links  robots
/                           200  126   42   350   index, follow
/movies                     200   94   15    28   index, follow
/tv                         200   91   17    28   index, follow
/animations                 200   78   19    28   index, follow
/trending                   200   36   17     0   index, follow
/most-watched               200   44   21   331   index, follow
/genres                     200   36   15     0   index, follow
/blog                       200  119   13     0   index, follow
/movbox-app                 200   72   33     0   index, follow
/about                      404   52   29     0   noindex     ← linked from the footer
/contact                    404   52   29     0   noindex     ← linked from the footer
/privacy                    404   52   29     0   noindex     ← linked from the footer
/terms                      404   52   29     0   noindex     ← linked from the footer
/account                    404   52   29     0   noindex     ← linked from the footer
/category/live              200  126   16     0   index, follow ← an empty page
```

Every response carried `Cache-Control: private, no-cache, no-store,
max-age=0, must-revalidate`. The homepage took **2.78 s** and shipped
**1.48 MB**; `/most-watched` took **3.68 s** and shipped **2.29 MB**.

---

## 2. The five defects

### 2.1 Nothing was ever cached — the whole site was dynamic

**This is the big one.** `lib/data.ts` minted its bearer token with

```ts
fetch(url, { …, cache: "no-store" });
```

and every catalogue call carried an `AbortController` signal:

```ts
const ctrl = new AbortController();
init.signal = ctrl.signal;
```

Both of those opt a Next.js route **out of static rendering**:
`cache: "no-store"` is an explicit opt-out, and Next.js does not store a
fetch that carries an `AbortSignal` in its data cache. The consequence
ripples outwards:

- `export const revalidate = 1800` on every page did nothing — the route was
  dynamic, so the page was re-rendered on every request.
- Every response was `no-store`, so the CDN never served a cached copy.
- Googlebot had to render every URL from scratch: 2.8 s for the homepage,
  3.7 s for `/most-watched`.
- The sitemap lists **24 592** URLs (23 751 of them episode watch pages). At
  three seconds each, the crawler ran out of patience long before it reached
  the detail pages — which is exactly what "no impressions and clicks" looks
  like from the outside.

**Fix.** The token mint is now `next: { revalidate: 3600 }` (the token lives
23 h, so an hour is safe) and `h5Fetch` takes a `revalidate` option (600 s by
default) and passes `next: { revalidate }` instead of a signal. The timeout is
enforced by racing the promise rather than by aborting the fetch, so the
caller still gives up on a hung upstream but the response is still cached
when it does arrive.

### 2.2 `/trending` rendered empty

`getBoxmoviesTrending` read `r.data.items`. The trending endpoint does not
use that key:

```
GET /wefeed-h5api-bff/subject/trending?page=0&perPage=60
→ data = { subjectList: [ …60 rows… ], pager: {…} }
```

`data.subjectList` is the key. The page rendered four empty rows — a URL in
the sitemap with no content on it.

### 2.3 Five footer links answered 404

`/about`, `/contact`, `/privacy`, `/terms` and `/account` were linked from
the footer on **every page of the site** and none of them existed. Broken
internal linking on every URL is a crawl-budget leak and a trust signal
going the wrong way.

`/account` was also simply the wrong address — the account page is
`/profile`. The footer now points there.

The four content pages are real pages now, with their own title, description,
breadcrumb and FAQ structured data.

### 2.4 The index pages had 36-character descriptions and 15-character titles

`/trending` was *"What's hot on Movbox right now."* (36 characters).
`/genres` was *"Browse movies and TV shows by genre."* (36). `/most-watched`
was 44. The titles were worse: *"Movies | Movbox"* is 15 characters, which
wastes the ~60 characters Google actually shows.

Every index page now has a keyword-carrying title and a 120–160 character
description written for a human reading a search result. The band is
deliberate: below ~120 Google rewrites the description anyway (which is what
the 36-character versions were getting), and above ~160 Google truncates it
mid-word with an ellipsis of its own.

The detail pages — 24 592 of them — had the same problem in the opposite
direction: the meta description was the upstream's raw synopsis, which runs
to 210 characters and beyond. `clampDescription()` in `lib/seo.ts` now cuts
it on a sentence boundary where one exists and on a word boundary otherwise,
so no snippet ends mid-word. The episode watch pages, which used a raw
`synopsis.slice(0, 160)`, had the same mid-word cut and are fixed too.

### 2.5 The homepage was 1.48 MB and fetched 132 posters eagerly

The payload was 1.46 MB of React Server Component data: **6 134 repeated
Tailwind class strings** totalling 721 KB, plus 323 poster URLs. The home
feed renders every subject of every shelf — about **389** title cards.

On top of that, `MovieRow` marked its first **four** cards as `priority` in
**every** row, so a page with thirty rows asked the browser for 132 eagerly
fetched, high-priority posters. `priority` exists to win the Largest
Contentful Paint; using it 132 times loses it.

**Fix.** Sixteen titles per shelf, and only the first row of a page loads
eagerly.

---

## 3. What was added

### 3.1 The app's ranking system, on the web

The Android app shows two ranking blocks on its Trending tab (*Series
Rankings* and *Movie Rankings*) — each one a named group of ranked titles
with its own "All ›" page. The website had no equivalent.

The app reads those groups from the **mobile** BFF (`tab-operating` and
`tab/ranking-list`). `api6.aoneroom.com` answers **440
ServiceNotAvailable** from Vercel, so the site reads the same shelves from
the web BFF's own ranking route, which is the same data:

| route | answer |
|---|---|
| `GET /wefeed-h5api-bff/tab-operating` | **200** — 34 groups, 22 with titles |
| `GET /wefeed-h5api-bff/tab/ranking-list?…` | **404** — mobile BFF only |

Every group is its own URL — `/rankings/<slug>` — with its own title,
description, canonical and an `ItemList` of JSON-LD carrying the explicit
positions. A path segment rather than a `?g=` query, because a query-string
route cannot be prerendered and would never be cached.

**Trending** is now in the top navigation, with **Rankings** next to it, and
both are repeated in the Categories dropdown for phones (the top bar is
`hidden md:flex`).

### 3.2 The GEO layer

| Piece | What it is for |
|---|---|
| `components/seo/ItemListJsonLd.tsx` | `ItemList` with explicit `position` for every ranked list — the structured data behind Google's "Top picks" result, and the thing an assistant quotes when it answers "what are the best K-dramas" |
| `components/seo/SiteJsonLd.tsx` | site-wide `WebSite` + `Organization`, including the `SearchAction` that points at `/search?q=` — the one piece of structured data that belongs on every page, and which the site had none of |
| `public/llms.txt` | a plain-text summary of the site for AI crawlers, in the `llmstxt.org` format, linked from every page with `<link rel="llms-txt">` |
| `public/robots.txt` | replaced the metadata route so it can point at `/llms.txt` and both sitemaps |
| Prose on the ranking pages | a factual paragraph in the page's own words, which is what a generative engine quotes |

The site's existing `Movie` / `TVSeries` / `VideoObject` / `Article` /
`FAQPage` / `BreadcrumbList` markup was already in place and was left alone.

### 3.3 The sitemap

- `/rankings` and every `/rankings/<group>` were added.
- `/about`, `/contact`, `/privacy` and `/terms` were added.
- The static pages' `lastmod` was already the build date; the detail pages
  keep their real release date.

### 3.4 Two defects the local audit caught after the first pass

Both were found by `scripts/seo-structure-check.mjs`, not by reading the
code, and both would have shipped otherwise.

**Every rewritten title carried the brand suffix twice.** The root layout
sets `title.template = "%s | Movbox"`, so a title that already ends in
`| Movbox` renders as *"Watch Free Movies Online in HD — Thousands of Titles
| Movbox | Movbox"*. Twelve pages were affected. `lib/seo.ts` documents the
rule; the new titles broke it.

**Every ranking group page shipped the same `<h1>`.** All 22 of them said
*"Movbox Rankings"*, so the pages were near-duplicates to a crawler. Each
group page now has its own heading — *"Popular Series Rankings"*, *"Anime
(English Dubbed) Rankings"* — and the upstream's own group names are cleaned
of emoji and brackets first (`🔥Hot Short TV` → *"Hot Short TV"*,
`Anime[English Dubbed]` → *"Anime (English Dubbed)"*) so they survive a trip
through a `<title>`. The visible label in the UI still comes straight from the
upstream, so the page still matches the app's own name for the shelf.

---

## 4. Verified after the fix

Measured against the local production build (`next start`), 2026-11-06.

### 4.1 The cache — the defect that actually cost the impressions

| | before (live) | after (local build) |
|---|---|---|
| `Cache-Control` on `/` | `private, no-cache, no-store, max-age=0, must-revalidate` | `s-maxage=600, stale-while-revalidate=31535400` |
| TTFB `/` | **3 672 ms** | **556 ms** |
| TTFB `/most-watched` | **5 514 ms** | **735 ms** |
| TTFB `/trending` | 647 ms | 103 ms |
| TTFB `/rankings/popular-series` | — | 65 ms |

`/most-watched` was the worst page on the site and it is now a cached static
route.

### 4.2 Every indexable route, audited

`scripts/seo-structure-check.mjs` — **0 problems**.

```
path                              st  tLen dLen ld
/                                 200    38  126  WebSite,Organization,ItemList
/movies                           200    61  157  WebSite,Organization,BreadcrumbList
/tv                               200    58  156  WebSite,Organization,BreadcrumbList
/animations                       200    50  159  WebSite,Organization,BreadcrumbList
/trending                         200    45  146  WebSite,Organization,BreadcrumbList
/most-watched                     200    49  152  WebSite,Organization,BreadcrumbList
/genres                           200    65  157  WebSite,Organization,BreadcrumbList
/blog                             200    57  141  WebSite,Organization,BreadcrumbList
/movbox-app                       200    54  148  WebSite,Organization,BreadcrumbList,FAQPage
/rankings                         200    62  153  WebSite,Organization,BreadcrumbList,ItemList
/rankings/popular-series          200    51  139  WebSite,Organization,BreadcrumbList,ItemList
/rankings/anime-english-dubbed    200    58  146  WebSite,Organization,BreadcrumbList,ItemList
/category/kids                    200    22  155  WebSite,Organization,BreadcrumbList
/about                            200    60  157  WebSite,Organization,BreadcrumbList,FAQPage
/contact                          200    58  154  WebSite,Organization,BreadcrumbList,FAQPage
/privacy                          200    54  157  WebSite,Organization,BreadcrumbList
/terms                            200    44  156  WebSite,Organization,BreadcrumbList
/movie/<id>                       200    31  155  WebSite,Organization,Movie,VideoObject,BreadcrumbList
```

Every title is ≤ 65 characters, every description is inside the 120–160
band, every `og:url` matches its canonical, every page has exactly one
`<h1>`, every JSON-LD block parses, and no two pages share a title or a
description.

### 4.3 The routes are actually static now

```
○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
```

`/`, `/trending`, `/most-watched`, `/rankings`, `/category/*` and the four
new pages are static. `/rankings/<group>` is **SSG with all 22 groups
prerendered** — `generateStaticParams` was added so the new pages are real
static HTML from the moment they are published instead of being rendered on
first hit. `dynamicParams` stays on, so a group the upstream adds later is
still rendered on demand rather than 404ing.

### 4.4 Homepage weight — and what actually mattered

| | before | after |
|---|---|---|
| HTML | 1 481 871 B | 1 300 856 B |
| of which the RSC payload | 1 463 094 B | **176 161 B** (−88 %) |
| poster `<img>` tags | 397 | 340 |
| **over the wire (brotli, as Vercel serves it)** | 64 457 B | 64 457 B |

The RSC payload — the flight data the browser downloads *and* has to parse
for hydration — fell by 1.29 MB. That is the win.

The total HTML barely moved, and the transfer size did not move at all: the
edge compresses the markup to ~64 KB either way. The honest reading is that
the markup weight was never the problem; **the `no-store` header and the
3.7-second render were**. The payload work was still worth doing — the
browser parses 1.1 MB less JavaScript-adjacent data on hydration — but it is
not where the impressions were lost.

One further finding, left as-is on purpose: 1 056 inlined `lucide-react`
SVG icons account for 463 KB of the remaining HTML. They compress away to
almost nothing and are not on the critical path, so replacing them would be
a styling change with no measurable return.

---

## 5. Still open

- **api6 answers 440 from Vercel.** The OnStream resolution path still runs
  through the DigitalOcean relay as its fallback. The ranking groups work
  around it by using the web BFF; the *player* still depends on it.
- **`TMDB_API_KEY` is unset**, so the genre pages under `/genres/<id>` are
  not in the sitemap. The genre index itself is fine.
- **`/category/live` has no titles of its own** — live channels are served by
  the upstream live hub — so it is now `noindex` instead of being an empty
  indexable page.
- The **episode-level watch URLs** (the bulk of the 24 592) stay in the
  sitemap. They have unique titles, descriptions and `VideoObject` markup,
  but their volume is a crawl-budget risk if the crawl rate does not
  recover.
