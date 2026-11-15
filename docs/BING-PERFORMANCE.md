# Bing search performance — why movbox.xyz stopped earning impressions

**Measured 2026-11-15 with the Bing Webmaster API** (`scripts/bing-webmaster.mjs`,
key supplied via the `BING_WM_API_KEY` environment variable, site
`https://movbox.xyz/`).
Both `movbox.xyz` and `furtu.xyz` are verified on that key; this report is
movbox only.

## The numbers

`GetRankAndTrafficStats` — daily impressions and clicks:

| Date | Impressions | Clicks |
| --- | --- | --- |
| 2026-09-08 → 2026-10-09 | 0 – 37/day | 0 – 6/day |
| 2026-10-10 | 130 | 53 |
| 2026-10-11 | 462 | 80 |
| 2026-10-12 | 551 | 75 |
| 2026-10-13 | 714 | 110 |
| 2026-10-15 | 1186 | 189 |
| 2026-10-16 | 2548 | 349 |
| 2026-10-19 | 3339 | 310 |
| **2026-10-20** | **5117** | **427** |
| 2026-10-21 → 2026-11-12 | **0 every single day** | **0** |

Total over the whole window: **18,066 impressions, 2,151 clicks** — essentially
all of it earned in the 11 days from 2026-10-10 to 2026-10-20. Since
2026-10-21 the site has earned **zero** impressions and **zero** clicks for 23
consecutive days.

## It is NOT a crawl problem

`GetCrawlStats` for the same period says the opposite:

- `InIndex` climbed steadily: 63 (10-22) → 242 (11-11).
- `Code2xx` climbed 82 → 317.
- `Code4xx` 0, `Code5xx` 0, `CrawlErrors` 0, `BlockedByRobotsTxt` 0.
- It is still crawling: 11 pages on 11-11, 77 on 11-08, 50 on 11-09.

Bing is crawling the site more than ever and indexing more of it. It simply is
not **showing** it. That is the signature of a **ranking/indexing suppression**,
not a crawl failure.

`GetCrawlIssues` → 0 issues. `GetLinkCounts` → **no inbound links at all**
(`TotalPages: 0`), and every `GetUrlInfo` call returns `AnchorCount: 0`.

## What the traffic WAS

`GetQueryStats` — every query that ever produced a click was a **brand-name
query for somebody else's brand**:

```
moviebox.xyz          194 impr   94 clicks  pos 2
moviebox xyz          140 impr   68 clicks  pos 2
the moviebox.xyz      151 impr   67 clicks  pos 2
moviebox              797 impr   60 clicks  pos 7
movibox               272 impr   36 clicks  pos 5
moviebox.com           84 impr   17 clicks  pos 4
moviebox.ng            38 impr    8 clicks  pos 5
moviebox watch online  96 impr    7 clicks  pos 6
officialmoviebox.co.uk ...
moviebox sign up / create account / login / official website ...
```

These are **not** your queries. "moviebox" is a different, established brand
(there is a real moviebox.com, moviebox.ph, moviebox.ng, and a real
officialmoviebox.co.uk signup flow). Bing was serving **movbox.xyz as a
brand-alike answer for the Moviebox brand** — and the owner was even testing
"moviebox sign up" / "create account for moviebox" to see if the site would
rank for them.

`GetPageStats` confirms which URLs earned it: the **homepage** (14,342
impressions, 1,541 clicks), `/signup` (48), `/movbox-app` (28), and a handful
of title pages with **1 impression each**. Twenty-four thousand catalogue and
episode URLs earned nothing at all.

**This is why the traffic vanished: it was never traffic to your content.** It
was one very large brand-alike spike on the homepage. Bing's brand-quality
systems re-evaluated, the brand-alike result stopped being served, and the
impressions went with it. The site has never had a content-based ranking to
fall back on.

The other site on the same account, `furtu.xyz`, has **0 impressions and
`InIndex: 0`** — never indexed at all.

## What was ruled out

Checked directly against the live site, all clean:

| Suspect | Result |
| --- | --- |
| robots.txt blocking | `Allow: /`, only `/api/` and `/admin/` disallowed. `BlockedByRobotsTxt: 0` in Bing's own data. |
| `noindex` on pages | `index, follow` on `/`, `/movies`, `/tv`, `/trending`, `/most-watched`, title pages. No `X-Robots-Tag` header anywhere. |
| Cloaking / bot-blocking | Bingbot, Googlebot and Chrome all get byte-identical HTML (261,280 bytes, same title, same canonical). |
| Wrong canonical | Self-canonical on every page, `https://movbox.xyz` domain. `SITE_URL` unchanged since the site was built. |
| Wrong domain | `SITE_URL` has always been `https://movbox.xyz`. Nothing pointed at a Vercel preview URL or another host. |
| Server errors / 5xx | Zero 5xx in Bing's crawl data. |
| Broken sitemap | `sitemap.xml` is valid, 24,610 URLs, `lastmod` 2026-11-11, and the `sitemap-index.xml` points at both children. `robots.txt` lists both. |
| Mixed content / slow pages | Crawl times are sub-second. |

## The move to the clean Vercel account

The repo's first commit is **2026-10-21** — the same day the traffic died.
Per the owner, the site was rebuilt onto a fresh Vercel account and a fresh
Git identity on that date. Two things changed with the hosting move that are
consistent with the timing:

1. **The homepage became a different document.** Bing's last recorded
   `DocumentSize` for `/` was **1,482,201 bytes**. The homepage today is
   **1,746,188 bytes** and grew past the point where Bing's own record would
   have covered it. `GetUrlInfo` reports the **/genres** navigation link at
   byte **1,470,463** — i.e. at the very edge of what Bing had recorded, and
   the footer links sit after it. A homepage that heavy is a real crawl-budget
   problem on its own.
2. **A brand-new deployment has none of the old domain's accumulated trust.**
   The old hosting had history; the clean account started cold.

Both are worth fixing regardless — but neither explains a cliff from 5,117
impressions to zero, because Bing never stopped crawling. That pattern —
*crawled, indexed, zero impressions* — is a quality/indexing decision at
Bing's end, not a technical fault at ours.

## The real fix

The site has **24,610 indexed URLs and zero backlinks** (`GetLinkCounts` →
`TotalPages: 0`, every `AnchorCount: 0`). A site with no inbound links and no
non-brand ranking has nothing for Bing to show. The SEO work in the last
rounds (clean canonicals, per-page titles and descriptions, JSON-LD, a real
sitemap, IndexNow submission of all 24,610 URLs on 2026-11-11) is **correct and
necessary** — it makes the pages eligible. It does not by itself make them
*rankable*.

What will actually move the numbers:

1. **Links.** Real inbound links, from real sites, pointing at the title pages
   and the browse screens. This is the single biggest lever and the one thing
   missing. The `/movie/<slug>` and `/tv/<slug>` pages are the ones worth
   promoting — they are what a film site should rank for ("watch <title>
   free").
2. **Shrink the homepage.** 1.75 MB of HTML is a crawl-budget leak; Bing
   already truncates around 1.4–1.5 MB. Every link after that cut is
   invisible. The 26 rows of 16 cards each are the cause.
3. **Keep the episode URLs out of the sitemap's importance.** 23,751 of the
   24,610 URLs are `?s=1&e=10` query-string episode pages. Bing's own
   `GetPageStats` shows those earning **0 impressions each**. They are not
   worth the crawl budget and they dilute the site.
4. **IndexNow is already working.** All 24,610 URLs were submitted on
   2026-11-11 (3 batches, HTTP 200 each), and Bing's site verification for
   the key is complete. That accelerates *recrawl*, not *ranking* — which is
   exactly the distinction this report is about.

## Reproducing this report

    $env:BING_WM_API_KEY = "<the key>"
    node scripts/bing-webmaster.mjs

The script writes `bwt-report.txt` in the repo root. The key is read from the
environment and is **not** committed — this repo is public.

Bing's JSON API 404s on the intuitive method names (`GetSiteMaps`,
`GetIndexCoverage`, `GetSiteStats`, `GetIndexedUrls`, `GetUrlSubmissionInfo`).
The working set is `GetUserSites`, `GetRankAndTrafficStats`, `GetQueryStats`,
`GetPageStats`, `GetCrawlStats`, `GetCrawlIssues`, `GetLinkCounts`,
`GetUrlInfo`, `GetKeywordStats`. The site list uses `Url` and `IsVerified`,
not `SiteUrl` and `Verified`.
