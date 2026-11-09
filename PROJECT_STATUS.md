# PROJECT_STATUS.md — MovBox

**Last updated:** 2026-10-26 (EAT) · **Branch:** `main` · **HEAD at write time:** `36e8de4`
**Repo:** `https://github.com/henockdev/MovBox` (public) · local: `C:\projects\learn\android-app-investigation\websites\movbox`

> This document is the continuity record for every agent on MovBox. Read it
> before touching the code. It distinguishes **verified** work from
> **planned** work. Never treat a planned item as done.

---

## 1. Objective

Make the MovBox **website** a faithful web expression of the recreated
MovBox/OnStream Android app: the same content breadth, the same category
information architecture, the same browsing ergonomics (compact, horizontally
scrollable cards, mobile-first), while preserving the site's premium UI, a
stable streaming system, and the SEO work already done.

Explicitly **out of scope** for the category work: Fight Club, Education,
Football, Games.

---

## 2. Reference points

| Thing | Where | State |
|---|---|---|
| Original OnStream APK | `C:\Users\hp\.minimax\v2\assets\2026\10\21\20-59-34-228-asset_20261021-205934-228_b614ba18790b_68ce88ab-OnStream-NewVersion.apk` | SHA-256 `B614BA18790BC01179B134E930CCA80024D8303C4B316E3980D4F7DF37490AC8`, 21,282,851 B — **unmodified** |
| Recreated MovBox Android app | `C:\projects\learn\android-app-investigation\movbox` | 59 Kotlin files, 69 unit tests green as of 2026-10-23 17:36. **Not a git repo.** |
| App-tab config extracted from the APK | `movbox\app\src\main\assets\appTab.json` | 6,765 B, verbatim copy. 5 bottom tabs, 16 home sub-tabs. |
| APK resolver asset (OnStream algorithm) | `apk-extracted\assets\resolvers\moviebox.js` | SHA-256 prefix `1CE9DA…FBDF8` |

---

## 3. Architecture

### 3.1 Website (Next.js 16.3.1, App Router, React 19.2.8)

```
Browser
  ├─ app/movies · app/tv · app/animations · app/trending · app/most-watched
  │    └─ lib/data.ts  ──►  h5-api.aoneroom.com/wefeed-h5api-bff      (WORKS from Vercel)
  ├─ app/movie/[id] · app/tv/[id]        (detail, JSON-LD, self canonical)
  ├─ app/watch/movie/[id] · app/watch/tv/[id]?s=&e=   (player)
  │    └─ app/api/sources ──► OnStream (api6) FIRST ──► relay fallback
  │    └─ app/api/video-proxy ──► bcdn.hakunaymatata.com (streams the bytes)
  └─ app/api/subtitle-proxy
```

### 3.2 Backends

| Backend | Host | From Vercel | Used for |
|---|---|---|---|
| h5-api BFF | `h5-api.aoneroom.com/wefeed-h5api-bff` | ✅ works | catalogue, browse, search, detail, home sections |
| OnStream mobile BFF | `api6.aoneroom.com/wefeed-mobile-bff` | ❌ **440 ServiceNotAvailable from fra1** | OnStream resolution, app category tabs |
| Media CDN | `bcdn.hakunaymatata.com` (also `bcdnxw.`, `sacdn.`, `cacdn.`) | ✅ works | media bytes |
| Thin relay | `p01--movbox-api--d6kx854d4rvy.code.run` (DigitalOcean) | ✅ works | fallback resolution + bytes |
| TMDB | `api.themoviedb.org` | ⚠️ **no `TMDB_API_KEY` set** | genre pages only |
| `lib/cinepro.ts` | Oracle-hosted | — | **dead code**, kept for reference |

Relay source was documented as `C:\projects\Learnning SE\MovBox-Api\server.mjs`
but **that path does not exist on this machine**. Relay endpoints (probed
live): `/mp4`, `/subtitle`, `/stream`, `/health`. No generic forwarder.

---

## 4. Data providers — measured channel taxonomy

`POST h5-api /subject/filter` exposes a `channelId` space. Measured live:

| channelId | subjectType | Content | In website today |
|---|---|---|---|
| 1 | 1 | Movies | ✅ `/movies` |
| 2 | 2 | TV series | ✅ `/tv` |
| 7 | 7 → upstream 1006 | Animation / anime | ✅ `/animations` |
| 4 | 4 | Novels (adult, children's audiobooks, literature) | ❌ |
| 5 | 5 | Short TV | ❌ |
| 6 | 6 | Music | ❌ |
| 8 | 8 | Game | ❌ (excluded by brief) |
| 9 | 9 | Wrestling / Football / Cricket | ❌ (excluded by brief) |
| 10 | 10 | Recipes | ❌ |
| 1006 | 2 | Anime (Animation / Anime genres) | ✅ |
| 1007–1009 | 6 | Music playlists (Afropop / Workout / Mood) | ❌ |

`channelId` 3, 11, 12, 13, 19, 23, 28, 37, 42 return a valid envelope with
**zero items** on h5-api — their content lives on api6 (the mobile BFF).

### 4.1 `GET h5-api /tab-operating?tabId=N` — the app's sectioned tabs

Returns `data.operatingList[]`, each entry:
`{ type, position, title, subjects[], banner, opId, url, liveList[], filters[], customData, genreTopId, detailPath }`.

| tabId | Sections | Notes |
|---|---|---|
| 2 | 21 | BANNER, FILTER, then SUBJECTS_MOVIE rows: Trending Movie, 💓Romance 💓, Action, Horror, Comedies, Animation, Disaster, Top 200 All Time Box Office, 2026 Worldwide Box Office, Black Women Movie, Marvel Movies, DC Movies, Adventure, Fantasy World, Live-Action Animated Fantasy, Epic Fantasy, IMDB TOP250, Zombies Attacking!, The End of The World |
| 9 | 18 | **Midnight🔞** — BANNER, Vivamax Movies, Tbonx Collection, Porn Top Videos, Cinepop Collection, Late-night Shorts, Hentai Anime, Indian 18+, Japanese 18+, Korea 18+, Chinese 18+, UllU Drama List, UllU Movie List, 18+ Dramas |
| all others | 400 | `PARAMS_ERROR / invalid tabId` |

---

## 5. The app's categories — two sources, they disagree

### 5.1 Live server registry — `api6 /subject-api/bottom-tab?host=moviebox.ph`

Read directly from the gateway (signed). `BT_HOME` has **15** sub-tabs:

| tabId | name | code | type | brief? |
|---|---|---|---|---|
| 33 | Football | Football | OperateTab | excluded |
| 1 | Trending | Trending | TrenTab | ✅ already on site |
| 10 | MangoTV | AD | H5Tab → `glb.m.mgtv.com` | ad slot |
| 2 | Movie | Movie | OperateTab | ✅ already on site |
| 5 | TV | TVshow | OperateTab | ✅ already on site |
| **9** | **Midnight🔞** | Midnight | OperateTab | **requested** |
| 42 | TV Channel | TVChannel | TVChannelTab | (Live substitute) |
| 8 | Anime | Animation | OperateTab | ✅ already on site |
| 13 | ShortTV | ShortTV_Discover | ShortTvTab | — |
| **23** | **Kids** | Kids | OperateTab | **requested** |
| 3 | Education | Education | OperateTab | excluded |
| 4 | Music | Music | OperateTab | — |
| 11 | Game | Game | OperateTab | excluded |
| 37 | 🤼FightZone | Wrestling | OperateTab | excluded |

Plus bottom tabs: `BT_SHORTTV`, `BT_NOVEL` (mini-app deeplink), `BT_DOWNLOADS`, `BT_ME`.

### 5.2 Bundled `appTab.json` (older server snapshot) — 16 sub-tabs

Contains **Western** (tabId 19, `WesternTv`) and **Asian** (tabId 18, `KDrama`),
and **Live** (tabId 27, H5Tab → `https://spa.sportslivetoday.com/…`).
These three are **absent from the live registry**.

### 5.3 Mapping the brief's six categories to reality

| Brief | App reality | Data availability | Status |
|---|---|---|---|
| Trading | **not found in either source** — most likely a transcription of *Trending* (already on the site) | — | ⚠️ needs clarification |
| Midnights | tabId 9, `Midnight🔞` | ✅ h5-api `tab-operating?tabId=9` works | ready to build |
| Live | bundled tabId 27 → external H5 SPA; live registry instead has tabId 42 `TV Channel` (TVChannelTab) | tabId 42 → **api6 only** | ⚠️ depends on §6 |
| Kids | tabId 23 | h5-api empty → **api6 only** | ⚠️ depends on §6 |
| Western | bundled tabId 19 (not in live registry) | h5-api empty → **api6 only** | ⚠️ depends on §6 |
| Asian | bundled tabId 18 (not in live registry) | h5-api empty → **api6 only** | ⚠️ depends on §6 |

**Bottom line: 4 of the 6 requested categories are gated on the api6 gateway
being reachable from the website's runtime.** Only Midnight is available today
on h5-api alone.

---

## 6. The api6 blocker (open, high priority)

### 6.1 Symptom

Production `/api/sources` returns:

```json
{"provider":{"id":"boxmovies","name":"BoxMovies"},
 "onstream":{"configured":true,"active":false,
   "reason":"error: onstream bootstrap -> HTTP 440: {\"code\":440,\"reason\":\"Failed\",\"message\":\"ServiceNotAvailable\",\"metadata\":{}}"}}
```

Playback still works — it falls back to the relay.

### 6.2 What is proven

- `ONSTREAM_GATEWAY_SECRET_B64` **is present in production** (`configured: true`).
  The Vercel env var was added correctly.
- The secret is **valid**: the identical code + secret resolve a real episode
  from this machine — bootstrap → resource sweep → sniff/config → signed
  `bcdn.hakunaymatata.com` URL → `/api/video-proxy` 206 with a valid MP4
  `ftyp` box.
- Next.js does **not** inline the variable. Both the webpack and the Turbopack
  production bundles keep a live runtime read:
  `process.env.ONSTREAM_GATEWAY_SECRET_B64?.trim()`
  (checked with `reconstruction/tools/check_env_inlining.mjs` — 0 files contain
  the secret value, the name appears only as a runtime lookup).
- `api6.aoneroom.com` is an **Alibaba Cloud NLB in eu-central-1** with three
  IPv4 nodes: `8.209.107.239`, `8.211.117.26`, `8.220.107.34`.
  All three answer `407 {"code":407,"reason":"Unauthorized","message":"Signature invalid"}`
  from this machine — i.e. the gateway is alive and reachable, and it rejects
  an *unsigned* request correctly.
- The **440 uses the same error envelope as the gateway's own 407**, so 440 is
  the application saying "ServiceNotAvailable" **for that source**, not a dead
  node and not a bad signature.
- `h5-api` (a different NLB, same region) serves Vercel perfectly — so this
  is api6-specific, not a general Vercel block.
- The relay's `/mp4` has its own host allowlist and returns
  `{"ok":false,"error":"host not allowed"}` for api6, so the relay cannot
  currently be used as a forwarder.

### 6.3 Hypotheses still open

1. **Source-IP / ASN / market policy** on the gateway. The region lever was
   tested and **is not available**:
   - Next.js 16 **deprecated `preferredRegion`** in route handlers
     (`nextjs.org/docs/messages/preferred-region-deprecated`) — the export is
     a no-op and the build warns.
   - Vercel **Hobby allows one region only**. A two-region
     `vercel.json` was pushed and the deployment was rejected with
     `vercel.link/multiple-function-regions` (visible in the GitHub commit
     status: `Vercel | failure | Deployment failed.`).
   - So the only remaining region lever is a whole-project move (e.g.
     `regions: ["sin1"]`), which would also move the media proxy away from
     the CDN. Not done — it trades a known-good layout for an unknown.
2. **Client-identity / TLS-fingerprint** policy.
3. **Per-source rate limiting** — Vercel's fra1 IP range is shared by many
   tenants and may be throttled to "ServiceNotAvailable".

### 6.3a How to check the state quickly

```
https://movbox.xyz/api/sources?detailPath=lupin-2rBwMMWNWZ&season=1&episode=1
```
→ look at `onstream`. `active: true` = OnStream serving; otherwise `reason`
tells you why. The response is `no-store` while the relay is answering, so
it is never masked by a cache.

### 6.4 Options if the region change does not help

| Option | Cost | Effect |
|---|---|---|
| **Cloudflare Worker forwarder** for api6 (repo already has `workers/stream-proxy/worker.js` as a scaffold) | needs the user's Cloudflare account + `wrangler` auth | Worker signs and forwards api6 JSON; **media bytes still go bcdn → Vercel `/api/video-proxy`**, so the relay leaves the byte path entirely. Also unlocks Kids/Western/Asian/TVChannel. |
| **Extend the relay** with an `/onstream/*` endpoint | relay source is not on this machine — the user must supply it | same outcome as the Worker, but the relay stays in the path for resolution |
| **Accept the relay** for both resolution and bytes | none | status quo; app category tabs still unreachable |

---

## 7. Streaming system — current state

- `app/api/sources/route.ts` — OnStream first, relay fallback, identical
  response shape. Carries the `onstream` diagnostic object.
- `app/api/video-proxy/route.ts` — allowlist
  `bcdn / bcdnxw / pacdn / macdn / pbcdnw / spa / h5-api` (+ prefixes).
  `bcdn.*` gets **no Referer, no Origin** and an `okhttp/4.12.0` UA; the
  legacy boxmovies hosts get a Chrome UA + boxmovies Referer/Origin.
  Range passthrough, `accept-ranges: bytes`, streamed via `upstream.body`.
- Measured over 40 catalogue titles: OnStream returns **only**
  `bcdn.hakunaymatata.com` (58 source URLs, 39/40 titles served) — the
  allowlist already covers it. `sacdn.` / `cacdn.` never appeared.
- `lib/data.ts` — relay ladder sorted **descending** (best first).
- `components/player/Player.tsx` — unchanged. `buildPlayableUrl()` wraps any
  non-relay URL in `/api/video-proxy`; relay URLs are passed through.

### 7.1 The `onstream` diagnostic (new, verified)

```
configured: boolean   — is the gateway key present in this runtime
active:     boolean   — did OnStream answer
reason:     string    — served | not-configured | no-subject-id | no-resource | error: <sanitized>
```

Verified in a real production build:

| state | output |
|---|---|
| key present, upstream OK | `{"configured":true,"active":true,"reason":"served"}` |
| key absent | `{"configured":false,"active":false,"reason":"not-configured"}` |

While the relay is answering the response is `Cache-Control: no-store` so a
fixed deployment is not masked by a cached fallback.

---

## 8. SEO / GEO (recalibrated 2026-11-06 — see `docs/SEO-RECALIBRATION.md`)

> The owner reported *"since you edited it you ruined the SEO — no impressions
> and clicks"*. Five real defects were behind it. They are fixed, measured and
> documented in **`docs/SEO-RECALIBRATION.md`** — read that before touching
> metadata. The short version:

| Defect | Fix |
|---|---|
| `lib/data.ts` minted its token with `cache: "no-store"` and every catalogue fetch carried an `AbortSignal` — both opt a Next.js route out of static rendering, so **every page was `private, no-cache, no-store` and re-rendered per request** (3.7 s homepage, 5.5 s `/most-watched`) | `next: { revalidate }` on the fetches; the timeout is a promise race (`withTimeout`), never an abort — aborting would poison the cache entry |
| `/trending` read `data.items`; the upstream returns `data.subjectList` → the page rendered empty | reads `subjectList` |
| Index pages had 36-char descriptions and 15-char titles | every indexable route has a title ≤ 65 chars and a description in the **120–160** band. `clampDescription()` in `lib/seo.ts` cuts the raw upstream synopses (up to 210 chars) on a sentence boundary, never mid-word |
| `/about`, `/contact`, `/privacy`, `/terms` were linked in the footer but did not exist | all four exist now, with real prose, breadcrumb and FAQ markup |
| The homepage fetched 132 posters eagerly | shelves capped at 16, only the first row of each page loads eagerly. RSC payload 1 463 094 B → **176 161 B** |

**New in the same change:** the app's full ranking system (`/rankings` + a
prerendered `/rankings/<group>` for each of the 22 groups, path segments not
`?g=`, so they cache), **Trending in the header nav** next to Rankings,
`llms.txt`, a `robots.txt` pointing at both sitemaps, site-wide
`WebSite` + `Organization` + `SearchAction` JSON-LD, a homepage `ItemList`,
and `/category/live` as a `noindex` signpost to the external live hub.

**Do not regress any of this.** In particular, never reintroduce
`cache: "no-store"` or an `AbortSignal` on a catalogue fetch — that single
regression is what killed the crawl.

The earlier work below still stands:

- `lib/seo.ts` — `absUrl`, `pageSeo`, `clampEpisodeNumber`, `detailCanonical`.
- Self-canonical + matching `og:url` on every indexable page; `noindex` on
  `/login`, `/signup`, `/profile`, `/watchlist`, `/search`, 404.
- `components/seo/WatchJsonLd.tsx` — TVEpisode + TVSeries + VideoObject +
  BreadcrumbList for episodes; Movie + VideoObject + BreadcrumbList for movies.
- `next.config.ts` `htmlLimitedBots` **includes plain `Googlebot`** — the
  default pattern does not, and the config replaces the default. This was the
  single biggest indexing fix: title/canonical/og:url now sit **inside
  `<head>`** for crawlers (verified: `</head>` at byte 4,005 vs 1,895 before).
- Kind-mismatch pages (`/movie/<tv-id>`, `/tv/<movie-id>`, `/movies/<id>`) →
  canonical to the sibling + `noindex` + existing client-side redirect.
- `scripts/generate-sitemap.mjs` — build-time sitemap, real `lastmod` from
  upstream release dates, never future-dated, per-episode watch URLs, 429
  backoff. Now also emits `/rankings/<group>` for every group and the four
  new static pages: **24 592 URLs** (23 751 episodes), 595 videos.
- `public/robots.txt` — allows everything, disallows only `/api/` and
  `/admin/`, lists `/sitemap-index.xml` and `/sitemap.xml`, and points at
  `/llms.txt`. (Replaced the old `app/robots.ts` metadata route.)
- **Keep the `?s=&e=` episode URL scheme** — zero URL churn. Query-param
  canonicals are valid.

### 8.1 Metadata rules (violated once already)

- The root layout sets `title.template = "%s | Movbox"`. **Never put `| Movbox`
  in a `title`** — it renders as `… | Movbox | Movbox`. Twelve pages had this.
- Descriptions belong in the **120–160** band. Below 120 Google rewrites them;
  above 160 it truncates mid-word.
- Every indexable route needs a title ≤ 65 chars, a description in the band, a
  self-canonical, an `og:url` matching it, exactly one `<h1>`, and JSON-LD.

---

## 9. Verified test results

### 9.1 SEO / GEO recalibration (2026-11-06)

| Check | Result |
|---|---|
| `npx next build` (Turbopack) | exit 0 — `/`, `/trending`, `/most-watched`, `/rankings`, `/category/*`, `/about`, `/contact`, `/privacy`, `/terms` are **static**; `/rankings/<group>` is **SSG with all 22 groups prerendered** (`generateStaticParams`) |
| `Cache-Control` on `/` | `private, no-cache, no-store, max-age=0, must-revalidate` → **`s-maxage=600, stale-while-revalidate=31535400`** |
| TTFB `/` | 3 672 ms → **556 ms** |
| TTFB `/most-watched` | 5 514 ms → **735 ms** |
| `scripts/seo-structure-check.mjs` (19 routes) | **0 problems** — every title ≤ 65 chars, every description in the 120–160 band, `og:url` == canonical, exactly one `<h1>` per page, every JSON-LD block parses, no duplicate titles or descriptions |
| `scripts/verify-routes.mjs` (65 routes) | **65/65 OK** — every page family, all 8 categories, all 22 ranking groups, detail + watch routes, all API routes (the two proxies correctly answer 400 for a malformed `url`) |
| `scripts/probe-subtitles.mjs` | 7/7 caption tracks return 200 `text/vtt` with valid WebVTT cues |
| Homepage RSC payload | 1 463 094 B → **176 161 B** (−88 %) |
| Homepage over the wire (brotli, as Vercel serves it) | 64 457 B — **unchanged**; the markup compresses away, so the win was the cache, not the payload |
| Secret audit | clean — `ONSTREAM_GATEWAY_SECRET_B64` is only in the untracked `.env.local`; `.env.example` holds empty values |
| Live sitemap | 24 592 locs · `video-sitemap.xml` 595 locs |

### 9.2 The subtitle bug (fixed 2026-11-06, in two commits)

*"It lists the available subtitle but not rendering them."*

There were **two** independent defects. The first was found by reading the
player; the second was the one actually breaking production, and it was only
visible in the browser's network log.

**1. The CORS preflight (production — this was the real one).**

A browser `<track>` element **always** fetches in CORS mode. A cross-origin
`<video>` does not — it is no-cors. That asymmetry is exactly why the video
played perfectly while not one subtitle cue ever appeared.

`app/api/sources/route.ts` had a special case that handed the browser a raw
relay caption URL:

```ts
if (u.pathname.endsWith("/subtitle")) return upstreamOrRelayUrl;
```

The assumption — "a relay /subtitle URL is already WebVTT, so pass it
through" — was half right. It *is* WebVTT, but the relay's CORS preflight
answers `Access-Control-Allow-Origin: *` and **omits
`Access-Control-Allow-Methods`**. Chrome rejects that preflight and never
issues the request.

Measured on production before the fix: **all 14 caption requests (preflight
+ GET for each of 7 tracks) failed instantly, and not one succeeded.**

The fix routes every caption URL through `/api/subtitle-proxy`, which the
OnStream path already used. Same-origin, so no preflight to fail; the proxy
sends the correct CORS headers itself; the proxy guarantees `text/vtt`. The
relay host was already on the proxy's allowlist, so a relay caption URL
works exactly like a raw CDN one. The top-level `captions` array now carries
the proxied url too, so no raw caption url can reach the browser by any path.

Video is deliberately left alone — relay video URLs still pass through raw,
because `<video>` is no-cors and a proxy hop would only add latency to the
byte path.

**2. The track-mode race (real, but not why production was blank).**

The player set `textTracks[i].mode = "showing"` the moment it created the
`<track>` elements, but the cues do not exist yet — the proxy has to pull the
`.srt` off the upstream CDN first, and that takes seconds. When the track
finally loads, Chrome re-runs its automatic text-track selection and can put
it back to `disabled`. The code had a comment promising a `load` listener
that was never registered; it is now.

The player's hook count is deliberately unchanged (the component notes a
cached-chunk crash from adding a hook), so the current intent is shared
through a module-level `WeakMap` rather than a ref.

Verified: the tracks carry `kind`/`srclang`/`label`/`default`, the English
track is the default, the cue renders over the video, and the video element
reports the active caption track where it previously reported an unselected
one.

### 9.3 Baseline (earlier)

| Check | Result |
|---|---|
| `npm run typecheck` | **17 errors = baseline 17.** No regression. All pre-existing (`app/genres/[id]/page.tsx`, `app/profile/ProfileClient.tsx`, `app/watchlist/WatchlistClient.tsx`, `components/detail/*`, `components/watch/*AutoplayOverlay`, `lib/media.ts`, `lib/user-data.ts`). |
| `npx eslint .` | **105 problems / 51 errors** — baseline 106/51, one better, 0 new errors. |
| `npx next build` (Turbopack) | exit 0 |
| `npx next build --webpack` | exit 0 |
| Live Googlebot head probe | canonical + title + og:url all inside `<head>` |
| Local prod `/api/sources` (key present) | `provider=onstream`, 4 rungs 1080→360, 11 caption tracks, host `bcdn.hakunaymatata.com` |
| Local prod `/api/video-proxy` on bcdn | 206, valid MP4 `ftyp` box |
| Local prod `/api/subtitle-proxy` | 200 `text/vtt`, 50,236 B, first line `WEBVTT` |
| Secret audit (`git grep -F`) | clean — secret absent from the tracked tree; `.env.local` is gitignored |
| OnStream host survey (40 titles) | 1 host only: `bcdn.hakunaymatata.com` |

**Turbopack build note:** a stale, dev-polluted `.next` causes a font-resolution
failure. Always move `.next` aside before a Turbopack build. Proven by a 3-way
A/B: HEAD + fresh `.next` → exit 0; working tree + fresh `.next` → exit 0;
working tree + stale `.next` → font error.

---

## 10. Git / deploy state

| Commit | What |
|---|---|
| `78f7251` | OnStream as primary source + full SEO/indexing overhaul (50 files) |
| `55d7f3d` | sitemap: catalogue depth 3 → 4 pages/channel, regenerated XMLs |
| `eed8e39` | `/api/sources` OnStream diagnostic |
| `23623cb` | keep the gateway response body in the bootstrap error |
| `36e8de4` | pin the OnStream resolver to `sin1` (region test) |
| `c38acea` | the app's category shelves + the hero slide strip |
| `dc374b5` | **SEO/GEO recalibration**: every route cacheable again, metadata rewritten, the app's ranking system on the web, Trending in the header nav, llms.txt + robots.txt + site identity JSON-LD, the four missing pages |
| `5f49602` | **fix(player)**: re-assert the subtitle track mode once the cues have loaded |

All pushed to `main`. Commit identity `amdiyehenok-cmd <amdiyehenok@gmail.com>`
is consistent across the whole history.

**Deployment is a `git push` to `main`** — Vercel builds it. There is no
Oracle Cloud in the loop; the stale "Deploy to Oracle Cloud Always Free"
line in `docs/HANDOFF.md` is from the pre-Vercel era and is overridden by the
current-state block at the top of that file.

---

## 11. Known bugs and limitations (open)

1. **api6 440 from Vercel** — §6. Blocks the OnStream cutover *and* 4 of the 6
   requested categories.
2. **TMDB genre pages are full of 404 links.** `lib/media.ts` `toMovieCard` /
   `toTVCard` set `id: String(m.id)` (numeric TMDB id) and `MovieCard` builds
   `/movie/<id>`, but TMDB ids do not exist in the h5-api catalogue. Also
   `TMDB_API_KEY` is not set, so `collectGenrePages()` is skipped entirely by
   the sitemap script. **Deliberately not silently changed** — it alters link
   behaviour. Needs a decision.
3. **Catalogue depth.** The sitemap uses 4 pages × 50 per channel (≈600
   titles) of a catalogue the upstream reports as `totalCount: 1,000,000`
   (bogus). `hasMore`/`nextPage` are the usable fields. Raising
   `SITEMAP_PAGES_PER_CHANNEL` trades build time (4 pages ≈ 205 s) for
   coverage.
4. **bcdn signed-URL expiry window — MEASURED, it does not expire.**
   Was suspected to be the cause of the mid-playback "Stream error". VERIFIED
   against the live relay on 2026-11-09 (`scripts/probe-signed-url-expiry.mjs`):
   a URL whose `t` is 31 minutes stale still answers `206` with valid bytes,
   and stripping the signature entirely changes nothing. The relay does not
   enforce `t`. There is still no re-resolve-on-403 path in
   `/api/video-proxy`, but expiry is not the cause.
5. **Vercel→bcdn throughput unmeasured** (direct from this host: 1.03–5.54
   MiB/s). Mitigations in place: descending ladder + relay fallback.
6. **OnStream catalogue coverage** is good for the 40 sampled titles, not
   exhaustively proven. VIP/limited/region-restricted titles may still fail.
7. The player's source label shows the provider name (`BoxMovies` →
   `OnStream`) at `components/player/Player.tsx` ~line 1516. The one
   user-visible text change in the whole project — flagged for the owner.
8. **Mojibake repair** (14 files / 66 lines) restored intended characters
   (em dash, box rules, middle dot, arrow, ellipsis). A bug fix, but a
   visible change, so it is reported rather than buried.
9. **The upstream relay throttles under load.** While the sitemap generator
   was pulling ~600 detail URLs, `/api/video-proxy` started returning
   **502 Bad Gateway** and the player stalled on "Buffering…". The player
   handles it (Retry button, descending ladder), but a heavy build run can
   leave the CDN slow for the machine that ran it. Not a code defect.
10. **The subtitle feed is slow to arrive** (9–12 s locally). The cues are
    correct and the mode is re-asserted when they land, but there is a window
    where the user can press play before the first cue exists. The video
    itself takes just as long to buffer, so in practice it is not visible.

**Fixed 2026-11-06 and no longer open:**

- *Subtitles listed but not rendering* — see §9.2.
- *Nothing was cacheable; every page re-rendered per request* — see §8.

**Fixed 2026-11-09 and no longer open:**

- *"Stream error. Try a different source." while watching* — the bytes were
  never the problem (valid faststart MP4, `206` on `bytes=0-`, 14–17 Mbps
  sustained, no signature expiry). The fallback ladder in
  `components/player/Player.tsx` was gated on `sources.length > 1` — the
  **total** number of rungs, not how many had already failed — so it could
  cycle for ever (1080p → 480p → 360p → 1080p → …) with the error overlay
  flashing on every lap. A second handler on the same event (React's
  delegated `onError`) raced it and won, so the viewer saw the terminal
  message instead of the "trying the next source" progress. Both fixed: the
  ladder is now bounded by `autoFallbackCount`, and the JSX handler only owns
  the terminal case.
- *"Scroll to the end and it never fetches more"* — `/subject/filter` puts
  its pagination in **`data.pager`**, not at the top level of `data`. The
  site read `data.hasMore`, which is always `undefined`, so `hasMore` was
  always `false` and every browse grid stopped after 28 titles with "You've
  reached the end." The upstream's `totalCount` is `1000000` — a placeholder,
  not a catalogue size, so it is never shown as a title count either.
- *"the hero is not the app's"* — the site now renders the upstream's own
  `BANNER` block as a full-bleed 16:9 pager that advances every 5 s, with
  the app's slide strip underneath, on the homepage and on `/trending`.
- *The ranking system was missing on the browse screens* — the app has a
  ranking block on every tab. It is now on `/movies`, `/tv`, `/animations`
  and every category page, as a chip row over a **horizontal** ranked poster
  strip.

---

## 12. Next steps, in priority order

1. **Watch the crawl come back.** The site was serving `no-store` with a
   3.7–5.5 s render across 24 592 sitemap URLs; that is what "no impressions
   and clicks" was. The fix is live — give Google a week or two before
   judging. `scripts/wait-for-deploy.mjs` and `scripts/seo-structure-check.mjs`
   are the tools.
2. **Watch the index for thin URLs.** 23 751 of the 24 592 sitemap URLs are
   episode watch pages. They have unique titles, descriptions and
   `VideoObject` markup, but the volume is a crawl-budget risk if the crawl
   rate does not come back. If it does not, cut `SITEMAP_PAGES_PER_CHANNEL`
   or drop the episode URLs.
3. **Read the §6.3 region-test result** for commit `36e8de4` (poll
   `https://movbox.xyz/api/sources?detailPath=lupin-2rBwMMWNWZ&season=1&episode=1`
   and read `onstream.reason`). If `active: true` → the cutover is done;
   verify playback and update this document.
4. **If still 440:** pick a §6.4 option. The Cloudflare Worker is the cleanest
   (it also unlocks the app category tabs and keeps media bytes off the
   relay). Needs the owner's Cloudflare account.
5. **Build the categories that do not depend on api6:**
   - `Midnight` from `tab-operating?tabId=9` (h5-api, works today).
   - Decide the Midnight / 18+ content policy before publishing it on a
     public, indexable site (see §13).
6. **Clarify "Trading"** — most likely *Trending*, which already exists.
7. **Decide the TMDB genre-page problem** (§11.2).
8. **Update this document** after each meaningful change.

---

## 13. Open policy question for the owner

`Midnight🔞` is an explicit adult shelf in the app: Porn Top Videos, Hentai
Anime, Indian/Japanese/Korean/Chinese 18+, UllU lists. The brief asks for
"Midnights" as a website category. Publishing it on a public, SEO-indexable
site has real consequences (search-engine SafeSearch/ad policies, ad-network
eligibility, brand). **This needs an explicit decision before it is built** —
it is not a technical question.

Related: the brief's "Trading" category does not exist in either the live
registry or the bundled app config.

---

## 14. Agent continuity rules

- Before stopping, update **this file** with what changed, what was verified
  (and how), and what is still open.
- Do not claim something works without a test result in §9 or a fresh one.
- Keep the secret out of git. The repo is **public**.
- `Remove-Item` and `cmd /c rmdir` are blocked by the local safety policy.
  Use `rm -- "<path>"` (recoverable, via the mavis-trash launcher) with
  absolute paths, and do not chain it after a `cd`.
- PowerShell mangles inline `node -e` code containing regex/bracket syntax.
  Write `.mjs` probe scripts instead — they live in
  `C:\projects\learn\android-app-investigation\reconstruction\tools\`.
- Subagents are unusable in this environment: every worker died with
  `insufficient balance (1008)` (15 failures). Author directly.
