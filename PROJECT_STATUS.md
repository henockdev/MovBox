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

## 8. SEO (completed, live, do not regress)

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
- `scripts/generate-sitemap.mjs` — build-time sitemap, `PAGES_PER_CHANNEL`
  default **4** (≈20.7k URLs live, 594 videos), real `lastmod` from upstream
  release dates, never future-dated, per-episode watch URLs, 429 backoff.
- `app/robots.ts` — allows everything, disallows only `/api/` and `/admin/`,
  lists `/sitemap-index.xml` and `/sitemap.xml`.
- **Keep the `?s=&e=` episode URL scheme** — zero URL churn. Query-param
  canonicals are valid.

---

## 9. Verified test results

| Check | Result |
|---|---|
| `npm run typecheck` | **17 errors = baseline 17.** No regression. All pre-existing (`app/genres/[id]/page.tsx`, `app/profile/ProfileClient.tsx`, `app/watchlist/WatchlistClient.tsx`, `components/detail/*`, `components/watch/*AutoplayOverlay`, `lib/media.ts`, `lib/user-data.ts`). |
| `npx eslint .` | **105 problems / 51 errors** — baseline 106/51, one better, 0 new errors. |
| `npx next build` (Turbopack) | exit 0 |
| `npx next build --webpack` | exit 0 |
| Live Googlebot head probe | canonical + title + og:url all inside `<head>` |
| Live sitemap | `sitemap.xml` 20,724 locs · `video-sitemap.xml` 594 locs |
| Local prod `/api/sources` (key present) | `provider=onstream`, 4 rungs 1080→360, 11 caption tracks, host `bcdn.hakunaymatata.com` |
| Local prod `/api/video-proxy` on bcdn | 206, valid MP4 `ftyp` box |
| Local prod `/api/subtitle-proxy` | 200 `text/vtt`, 50,236 B, first line `WEBVTT` |
| Secret audit (`git grep -F`) | clean — secret absent from the tracked tree; `.env.local` is gitignored (`.gitignore:58`) |
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

All pushed to `main`. `git ls-remote origin main` =
`36e8de4…` — confirmed against the server, not just the local ref. Commit
identity `amdiyehenok-cmd <amdiyehenok@gmail.com>` is consistent across the
whole history.

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
4. **bcdn signed-URL expiry window is unmeasured.** `/api/sources` caches the
   ladder 60 s; a mid-playback expiry surfaces as a player error. No
   re-resolve-on-403 path exists in `/api/video-proxy`.
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

---

## 12. Next steps, in priority order

1. **Read the §6.3 region-test result** for commit `36e8de4` (poll
   `https://movbox.xyz/api/sources?detailPath=lupin-2rBwMMWNWZ&season=1&episode=1`
   and read `onstream.reason`). If `active: true` → the cutover is done;
   verify playback and update this document.
2. **If still 440:** pick a §6.4 option. The Cloudflare Worker is the cleanest
   (it also unlocks the app category tabs and keeps media bytes off the
   relay). Needs the owner's Cloudflare account.
3. **Build the categories that do not depend on api6:**
   - `Midnight` from `tab-operating?tabId=9` (h5-api, works today).
   - Decide the Midnight / 18+ content policy before publishing it on a
     public, indexable site (see §13).
4. **Clarify "Trading"** — most likely *Trending*, which already exists.
5. **Scrollable hero cards** (§13) — pure frontend over existing h5-api
   data, no backend dependency. This is the one workstream that can proceed
   in parallel with §6.
6. **Decide the TMDB genre-page problem** (§11.2).
7. **Write `docs/` content for the new category pages** so each one is
   unique and indexable, not a thin generated page.
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
