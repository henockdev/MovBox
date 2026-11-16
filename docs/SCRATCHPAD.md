# Movbox — Scratchpad

> Running notes for the current session. Last updated: 2026-08-27 (rebrand + boxmovies-api v3.0.0 locked in).

---

## ⚠️ LATEST SESSION (2026-11-16) — read this first

**The owner's SEO error panel is still unidentified.** They pasted a fragment:
"Total Errors — High severity 5, Moderate severity 40, Low severity 8, 53
total; Total pages with errors 50; Error details". No tool name, no site name,
no error rows. Nothing in the repo maps to a High/Moderate/Low taxonomy
(`grep` for severity|doughnut|"Error details" → nothing). **Ask for the
"Error details" table** before guessing at a taxonomy.

What we could establish without it, and shipped (commit `0fba061`):

- The site's own audit is clean. `verify-audit-fixes.mjs` → ALL CHECKS PASSED
  over 983 URLs; `audit-url-quality.mjs` over 1,662 URLs → 0 HTTP ≥ 300, 0
  pages over 2 MB, 0 missing h1, 0 missing og, 0 short/long titles or
  descriptions, 0 canonical mismatches.
- The one real class of error we could find and fix: **dead URLs**. A sitemap
  can outlive the title it pointed at — the upstream drops titles, the URL
  stays published, the page answers 404 with a stub title ("Movie not found",
  16 chars) and a 42-char description. Every one of those reads as broken.
  All the not-found paths now return in-band copy (`missingContentSeo()` in
  `lib/seo.ts`), and they keep their 404 status.
- **The audit script itself was wrong.** `audit-url-quality.mjs` measured the
  RAW markup, so `Episodes &amp; Seasons` counted as 62 characters instead of
  58 — that alone produced 118 false "title too long" and 219 false
  "description too long". It decodes entities now. If you ever see a count of
  failed titles/descriptions, suspect the measuring script first.
- A real 404 inside a dynamic route renders an empty body (the h1 is only in
  the RSC payload). `verify-audit-fixes.mjs` no longer fails a non-200 for
  "no h1" — rendering an h1 inline would turn the 404 into a 200 soft-404.

New scripts: `scripts/find-dead-urls.mjs` (crawl the sitemap for status
errors), `scripts/verify-ads.mjs` (which ad units are in the served HTML).

---

## ⚠️ LATEST SESSION (2026-11-15) — read this first

The sections below are from 2026-08-27 and describe a different repo layout
(`C:\projects\HMovies`, a `boxmovies-api` backend, an Oracle Cloud deploy).
None of that is true any more. This block overrides it.

**Repo:** `C:\projects\learn\android-app-investigation\websites\movbox` —
public GitHub `https://github.com/henockdev/MovBox`, branch `main`, deployed
on **Vercel**. The deploy is a `git push` to `main`.

### Where the site actually stands

- **Bing:** 249 URLs indexed and still growing (63 → 249 since 2026-10-21),
  crawling hard (108 pages on 2026-11-12, its best day ever, right after the
  IndexNow push), zero 4xx, zero 5xx, zero robots blocks.
- **Impressions:** zero every day since **2026-10-21**. The traffic that came
  before was never content traffic — every query that ever clicked was a
  brand-alike query for a *different* brand (`moviebox.xyz`, `moviebox`,
  `moviebox.ng`, `officialmoviebox.co.uk`). Full analysis in
  `docs/BING-PERFORMANCE.md`.
- **Backlinks: zero.** `GetLinkCounts` → `TotalPages: 0`, every
  `AnchorCount: 0`. This is the missing ingredient and it is off-site work.
- **Do not delete the site from Bing Webmaster Tools and re-add it.** A
  property is not the domain's index; re-adding it resets the verified
  property, the IndexNow key and the crawl history for zero gain. The
  reasoning is in `docs/BING-PERFORMANCE.md`.

### What shipped this session

| Commit | What |
|---|---|
| `4873ec4` | Trailer hover preview, mobile trailer sheet, mobile nav drawer, scroll fix |
| `8de0758` | Deploy-poll marker fixes |
| `3028144` | IndexNow key hosted at the root; all 24,610 URLs submitted (3 batches, HTTP 200) |
| `fe89de5` | Ranking shelf renders the whole group, not the first 12 |
| `29b3f28` | The Bing Webmaster diagnostic (`scripts/bing-webmaster.mjs`, `docs/BING-PERFORMANCE.md`) |
| `33c68ff` | Homepage 1.75 MB → 888 kB: icon sprite + extracted card classes |
| `105f8fd` | The docs: homepage weight work, and the "delete the site from Bing" answer |
| *(this session)* | **Microsoft Clarity installed** (`ze20elh5au`), with the 18+ surfaces kept out of the recording |
| *(this session)* | **Sitemap orphan fix** — only the episodes the upstream actually lists are published |

### Microsoft Clarity (2026-11-15)

The owner's snippet is installed, verbatim, in `lib/analytics/clarity.ts`
(`CLARITY_SNIPPET_BODY`) and run by `components/analytics/Clarity.tsx`.

The site has a real 18+ catalogue, and Microsoft's Clarity terms do not
allow a session recorder over it — so the tag is **never injected** on:

- `/category/midnight`
- `/rankings/adult-animation`, `/rankings/bl-story`
- any `/tv/<slug>`, `/movie/<slug>` or `/watch/…` page whose own genres
  or title mark it as adult

The decision is made in the browser before the tag is injected, because
the URL alone cannot tell an adult series from an ordinary one.

Proved in the browser (network log, local build):

| Page | Clarity traffic |
|---|---|
| `/` | tag 200 + `u.clarity.ms/collect` 204 — recording |
| `/category/midnight` | **none** |
| `/tv/kap-toyo-indGB7vWGf6` (18+) | **none** |
| `/` → click → `/category/midnight` | **none** on the 18+ page; recording resumes on the way back |

`scripts/verify-clarity.mjs` checks the markers in the served HTML.

### Sitemap orphan fix (2026-11-15)

`maxEp` was being treated as a COUNT of episodes, so the sitemap
published `/watch/tv/<id>/<s>/<e>` for every number up to it. The
upstream publishes the real list in `allEp`. The sitemap now publishes
only what the series page links: **25,074 → 21,468 URLs** (20,605 episode
URLs, 398 series), 0 orphans in the 34 sampled series.
`scripts/scan-orphan-episodes.mjs` is the guard.

### The homepage weight work (2026-11-15)

The homepage shipped **1,746,920 bytes**. Bing's own record of the document
was 1,482,201 bytes, with the `/genres` nav link at byte 1,470,463 and
`<footer>` at 1,469,390 — the tail sat at or past Bing's cut.

| | before | after |
|---|---|---|
| total | 1,746,920 | **887,775** (−49%) |
| markup (no scripts) | 1,472,343 | 622,561 |
| RSC flight payload | 268,208 | 259,332 |
| inline `<svg>` bytes | 627,182 | 225,476 |
| `class="…"` bytes | 662,057 | 203,100 |

Two changes, zero rendered-pixel difference:

1. **Icon sprite** (`components/ui/Icon.tsx`). Seven `<symbol>`s emitted once
   per document; every card icon is a `<use>`. The four card icons were
   inlining their path data 1,341 times over.
2. **Card classes extracted** into `@layer components` in `app/globals.css`,
   written with `@apply` so Tailwind expands them to the same declarations.

### The guards that now exist

- `scripts/verify-css-equivalence.mjs` — resolves the computed style of every
  part of the card, old classes vs new, at 3 viewports × 2 states × 22
  elements (11,182 property resolutions) and fails on any difference. It was
  proven to catch a deliberate `rounded-md` → `rounded-lg` regression before
  being trusted.
- `scripts/verify-icon-sprite.mjs` — every `<use>` resolves to a symbol.
- `scripts/verify-page-weight.mjs` — every page inside a byte budget.
- `scripts/verify-ranking-shelf.mjs` — the chip's count matches the row.

### Known open issues

- **A `notFound()` thrown inside a dynamic route renders an empty HTML body**
  (the content arrives only in the RSC payload), so a non-JS crawler sees an
  empty page for `/movie/<slug>`-style URLs. Pre-existing; the status code
  is a correct 404 and the page is `noindex`, so the indexing impact is nil.
  `scripts/verify-audit-fixes.mjs` reports it as 3 failures (short title,
  short description, no `<h1>`) — those failures are on the **live** site
  too, not something a recent change introduced.
- **The 404 page's title is 29 characters** ("404 — Page Not Found | Movbox"),
  one under the 30 minimum, and its description is 42 characters against a
  120–160 band.
- **`/category/live` is `noindex`** and the Midnight / 18+ shelves are still
  in the sitemap — an open owner decision.
- **`TMDB_API_KEY` is unset** and `lib/tmdb.ts` is still wired.
- **Website OnStream cutover** (`api6.aoneroom.com` answers 440/441) is
  parked; the relay is production.

---

## Current state ✅

- **Frontend** at `C:\projects\HMovies` — all pages, all API routes, full rebrand to **Movbox**.
- **Backend** at `C:\Users\hp\.mavis\agents\mavis\workspace\boxmovies-api\` — v3.0.0, single Chrome page, ~200 MB RAM.
- **Dev servers** both running:
  - `boxmovies-api` on `localhost:4000` (PID 7900, ~50 MB)
  - Next.js dev on `localhost:3000` (PID 10068, ~310 MB)
- **All endpoints verified** end-to-end (8/8 API routes 200, 4 quality sources, 13 subtitles per movie).
- **Rebrand complete** — no user-visible "Hmovies" text remains (only legacy `hmovies:watchlist` localStorage event name for backward compat).
- **boxmovies-api cleaned up** — 34 debug/test/log files deleted, fresh README written, `.gitignore` added.
- **Frontend docs updated** — fresh `HANDOFF.md`, `AGENTS.md` (still TODO), this scratchpad.

---

## What changed in this session (2026-08-27)

### Rebrand → Movbox
- `lib/constants.ts`: `SITE_NAME = "Movbox"`, `SITE_URL = "https://movbox.xyz"`.
- `app/layout.tsx`, all page metadata.
- `components/layout/Header.tsx`, `Footer.tsx`, `Logo.tsx`, `SearchBar.tsx`.
- `app/manifest.ts`: `name: "Movbox"`, `short_name: "Movbox"`.
- `lib/watchlist.ts`: `KEY = "movbox:watchlist"`, reads legacy `hmovies:watchlist` for migration.
- `components/home/MovieCard.tsx`: visible "Movbox" placeholder.
- `components/watch/WatchSession.tsx`: visible "Movbox" placeholder.
- Code comments: `lib/boxmovies.ts`, `lib/types.ts`, `app/globals.css`, `app/api/home/route.ts`, `lib/cinepro.ts`.

### Cleanup
- 34 test/debug/log files deleted from `boxmovies-api/`:
  - `debug-player.mjs`, `debug-stream.mjs`
  - `test-*.mjs` (28 files) except `test-smoke.mjs` (which is in `package.json` scripts and was restored)
  - `verify.mjs`
  - `err.log`, `out.log`, `server.err`, `server.log`, `server.stderr.log`, `server.stdout.log`
- Fresh `boxmovies-api/README.md` (the old one was a moviebox-js-sdk template leftover).
- Fresh `boxmovies-api/.gitignore`.
- Dev server logs in frontend root (`dev.log`, `dev.err`, `dev.stdout.log`, `dev.stderr.log`) are gitignored; the live ones couldn't be cleared because the dev server holds them open — they regenerate on every restart.

### Chrome zombies
- 59 leaked headless Chrome processes killed (6.3 GB RAM freed).
- Server now leaves 1 Chrome page at rest (used for /stream only).

### Fresh docs
- `docs/HANDOFF.md` rewritten from scratch — reflects current Movbox + boxmovies-api state.
- `docs/SCRATCHPAD.md` (this file) — current.
- `AGENTS.md` (project root) — **still TODO**, says "Hmovies + CinePro + Phase 1" — needs update.

---

## Deploy plan (not done yet)

### Step 1: Oracle Cloud Always Free
1. Sign up at `cloud.oracle.com` (free tier — no charge).
2. Create a VM.Standard.E2.1.Micro instance:
   - Image: Ubuntu 22.04 (aarch64 OR x86 — x86 is easier for Chrome)
   - Shape: VM.Standard.E2.1.Micro (1 OCPU, 1 GB RAM — Always Free eligible)
   - Region: Frankfurt (eu-frankfurt-1)
   - VCN: default, public subnet
   - SSH key: upload your public key
3. Note the public IP. Add ingress rules:
   - `0.0.0.0/0 : 22` (SSH)
   - `0.0.0.0/0 : 80` (HTTP)
   - `0.0.0.0/0 : 443` (HTTPS)
   - (Cloudflare will proxy, so you can also lock 80/443 to Cloudflare IPs only — but free tier can be finicky)

### Step 2: Initial server setup
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx nodejs npm google-chrome-stable
# Node 20:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
# PM2:
sudo npm install -g pm2
```

### Step 3: Upload code
From your local machine:
```powershell
# Compress the frontend (excluding node_modules, .next)
cd C:\projects\HMovies
Compress-Archive -Path .\* -DestinationPath ..\movbox-frontend.zip -Force

# Same for boxmovies-api
cd C:\Users\hp\.mavis\agents\mavis\workspace\boxmovies-api
# (no node_modules; npm install on server)
```

Then `scp` to the Oracle box:
```bash
scp movbox-frontend.zip ubuntu@<ORACLE_IP>:~/
scp -r C:\Users\hp\.mavis\agents\mavis\workspace\boxmovies-api ubuntu@<ORACLE_IP>:~/boxmovies-api
```

### Step 4: Install + build
```bash
# Frontend
cd ~/movbox-frontend
unzip ../movbox-frontend.zip
npm ci --omit=dev
npm run build

# Backend
cd ~/boxmovies-api
npm ci --omit=dev
```

### Step 5: PM2 ecosystem
Create `~/ecosystem.config.js`:
```js
module.exports = {
  apps: [
    {
      name: 'boxmovies-api',
      cwd: '/home/ubuntu/boxmovies-api',
      script: 'server.mjs',
      instances: 1,
      max_memory_restart: '400M',
      env: { PORT: 4000, NODE_ENV: 'production' }
    },
    {
      name: 'movbox-frontend',
      cwd: '/home/ubuntu/movbox-frontend',
      script: 'npm',
      args: 'start',
      instances: 1,
      max_memory_restart: '500M',
      env: { PORT: 3000, NODE_ENV: 'production', NEXT_PUBLIC_BOXMOVIES_API: 'http://localhost:4000' }
    }
  ]
};
```

Then:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# (run the command pm2 startup prints)
```

### Step 6: Nginx
Create `/etc/nginx/sites-available/movbox`:
```nginx
server {
  listen 80;
  server_name movbox.xyz www.movbox.xyz;

  # Cache static assets
  location /_next/static/ {
    proxy_pass http://localhost:3000;
    proxy_cache_valid 200 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  # API + pages
  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 90s;  # /stream can take 5-8s
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/movbox /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 7: Cloudflare
1. Sign up at `dash.cloudflare.com` (free plan).
2. Add site `movbox.xyz` (it'll scan existing DNS records).
3. **Transfer DNS from Spaceship to Cloudflare** (free):
   - In Spaceship, get the Cloudflare nameservers (`anna.ns.cloudflare.com`, etc.).
   - Update the nameservers at your registrar.
4. In Cloudflare DNS, add an A record:
   - Name: `@`, Content: `<ORACLE_IP>`, Proxy: **Proxied** (orange cloud).
5. SSL/TLS → set mode to **Full** (not Full Strict — Oracle's self-signed cert is OK since we terminate at Cloudflare).
6. Caching → Configuration:
   - Add cache rule for `/api/home`, `/api/browse`, `/api/search-suggest` → Edge cache TTL: 5 min, Browser TTL: 1 min.
   - Add cache rule for `/api/detail` → Edge cache TTL: 1 hour (subject details don't change often).
   - Add cache rule for `/api/sources` → Bypass cache (signed URLs are short-lived).
7. Page Rules / Transform Rules:
   - Force HTTPS for all paths.

### Step 8: Verify
- `https://movbox.xyz/` should show the Movbox home with 21 sections.
- `https://movbox.xyz/movies`, `/tv`, `/animations` should work.
- `https://movbox.xyz/search?q=avengers` should return results.
- Click any movie → detail → "Watch Now" → player should load with MP4 + subs.

---

## Open questions for the user

- **Ads:** the user said they'll "enable ads" but hasn't specified which (AdSense? house ads? something else?). No ad slots exist yet — we'd add `<AdSlot id="..." />` components when ready.
- **Auth:** no real auth in v1. `lib/supabase.ts` is wired but unused. If/when the user wants login: Supabase is the choice (already configured for email + Google OAuth).
- **Logo file:** currently a Cinzel "M" rendered in CSS. If the user provides a real SVG, swap it in `components/layout/Logo.tsx`.
- **Domain transfer ETA:** Spaceship → Cloudflare nameserver update can take 24-48h to propagate. Plan deploy for when that's done.

---

## Decisions / context (for the next agent)

- **No TMDB, no CinePro** — `boxmovies.org` via h5-api is the single source of truth. `lib/tmdb.ts` and `lib/cinepro.ts` are dead code, kept for reference only.
- **No function/React component props from server to client** — pass icon name strings, never imported components. (RSC boundary.)
- **`imageUrl()` helper** detects full URLs vs TMDB-style paths. We use it everywhere.
- **Home page section filtering** — `SKIP_TITLES` set in `app/page.tsx` + content-fingerprint dedupe. Hero fallback: `Popular Series` + `Popular Movie` first, then backfill from other sections.
- **Animation uses `/browse?channelId=7`** — `boxmovies-api` rewrites upstream to `1006` for the 1M+ catalog.
- **5-min h5-api TTL cache** in boxmovies-api (LRU, 100 entries max). 2-min stream cache.
- **Infinite scroll, NO scroll-to-top** — `IntersectionObserver` with 600px rootMargin. Browser remembers position when navigating to detail and back.
- **Dedup by `detailPath`** in BrowseGrid + SearchClient. h5-api returns duplicate slugs for the same movie (e.g. "Pinocchio" 2022 vs 2026) — we key on `type::detailPath` to keep both.
- **SearchBar 200ms debounce** with `AbortController`. Suggester is server-side (`POST /subject/search-suggest`).
- **Typeahead returns keyword STRINGS only** (subject: null) — actual searches go to `POST /subject/search` with `subjectType` (0/1/2/3).
- **Layout-level data fetch** for watch pages (revalidate 3600) — only runs once per title. `TVWatchProvider` context passes data from layout to page. `router.replace(url, { scroll: false })` for soft nav.
- **No scroll-to-top on filter reset** — just re-fetch with the new filters. The intersection observer picks it up.
- **`hmovies:watchlist` legacy key** — read for backward compat, never written. New key is `movbox:watchlist`. Both event names dispatched/handled for one release.

---

## Recent bug history (resolved)

| Date | Bug | Fix |
|---|---|---|
| 2026-08-27 | /home empty (21 sections showed 0 cards) | `boxmovies-api /home` now reads `operatingList[].subjects[]` (was reading the old `sections[].medias[]` shape) |
| 2026-08-27 | /detail returned empty | `boxmovies-api /detail` fixed to read `r.data` (was `r.data.data`) |
| 2026-08-27 | /stream returned 0 sources | `boxmovies-api /stream` now reads `Artplayer.instances[0].option.quality` (was trying to click through Artplayer's UI) |
| 2026-08-27 | Animations page only had 36 items | `/browse?channelId=7` rewrites to upstream `1006` → 1M+ titles |
| 2026-08-27 | Search returned 0 for short queries | `POST /subject/search` with explicit `subjectType` (was passing type as string instead of number) |
| 2026-08-27 | Player showed 60s preview | `/api/video-proxy` sets `Referer: https://boxmovies.org/` so the CDN serves the full video |
| 2026-08-27 | Subtitle CORS errors | `/api/subtitle-proxy` rewrites SRT/VTT URLs through Next.js with correct Referer |
| 2026-08-27 | Background task wrapper killed node processes at 30 min | Switched to `Start-Process` for detached processes |
| 2026-11-09 | Watch pages served **three** `<h1>`s (the loader rendered its own heading on top of the page's) | `PageLoader`'s big label is a `<p>` now; the page keeps the only `<h1>` |
| 2026-11-09 | A crawler burst made h5-api answer **429**, and the `catch { return null }` turned those into "not found" — hundreds of live titles served as an empty 200 | `h5Fetch()` retries 429/5xx with a jittered backoff; `getBoxmoviesDetailOutcome()` separates `missing` from `error`; a refused call renders the title from the URL instead of a 404 |
| 2026-11-09 | **Every 404 in the site answered HTTP 200 with an empty body** | The root `app/loading.tsx` is a Suspense boundary, so the shell flushed before `notFound()` could set the status. Removed it; `/login` and `/watch/tv/[id]` got their own `<Suspense>` for `useSearchParams()` |
| 2026-11-09 | Title cap was 52, but the template suffix is 9 chars → the rendered title hit 61 | `MAX_TEMPLATE_TITLE = 60 − 9 = 51`, applied centrally in `pageSeo()` |
| 2026-11-09 | Descriptions under 120 chars were never fixed — `clampDescription()` could only shorten | The clamp now *extends* a short description with one site-level tail; it is idempotent, and the pages no longer pre-clamp before `pageSeo()` |
| 2026-11-09 | `clampTitle()` stripped **any** trailing parenthetical ("Why We Built Movbox (And Why It's Free)" → "Why We Built Movbox") | It now only strips a trailing language/dub tag, and never one that contains a year |
| 2026-11-09 | The sitemap had no `/genres/<id>` URL — the generator asked TMDB, and TMDB_API_KEY is unset | The generator reads the genre ids out of `lib/genres.ts` |
| 2026-11-21 | **Scrolling down yanked the page back up to the hero.** `HeroSlideStrip` followed the auto-advancing banner with `scrollIntoView({ inline: "center" })` — `scrollIntoView` scrolls *every* scrollable ancestor, including the window, so each 5-second slide change re-scrolled the whole document up to the hero | The strip now scrolls its own track with `track.scrollTo({ left })` computed from `getBoundingClientRect()` deltas, and an `IntersectionObserver` stops it entirely when the strip is off-screen. `HeroBanner` also pauses its auto-advance when the hero is not in view |
| 2026-11-21 | **The mobile trailer button did nothing.** The `<button>` was a child of the card `<Link>` — invalid HTML, and the browser swallowed the click (the `onClick` never ran) | The trailer button is now a **sibling** of the link, not a child, in `MovieCard` and `SearchResultRow`. A `<button>` inside an `<a>` is never allowed |
| 2026-11-21 | **Hovering a card on the homepage did nothing** — the home rows used a different card converter that dropped the trailer | One converter for the whole site: `lib/cards.ts` `toMediaCard()` carries `trailerUrl`/`trailerPosterUrl`/`country`/`genres`; `lib/adapters.ts` re-exports it and `/trending` + `/most-watched` import from `@/lib/cards` |
| 2026-11-11 | **The ranking row stopped at 12 while its own chip said 16.** `toShelfGroups(selected, 12)` truncated every group to 12 titles, but the chip beside it carried the upstream's real count — so the row contradicted its own label and the last titles of every ranking were unreachable without a click through | The cap is gone: `toShelfGroups()` now returns the group's full list, like the app's `RankingSectionView` (`group?.items.orEmpty()`). The upstream's groups hold 10–20 titles |

---

## The trailer preview (2026-11-21)

The card popup the owner asked for, taken from the app's own `PreviewStage`.

- **Desktop** — `components/media/HoverPreview.tsx`. A portal to `<body>` (so the scroll rows never clip it), positioned from the card's `getBoundingClientRect()`, above the card and falling back below when there is no room. 380 px wide, 16:9, muted autoplay loop with the trailer's own poster, a mute toggle, a progress line, the title, `★ rating · year · country · genres`, and Play + Details links. `useHoverPreview()` opens it only on `(hover: hover) and (pointer: fine)`, with a 250 ms close grace so the pointer can travel into the panel, and Escape closes it.
- **Mobile** — `components/media/TrailerSheet.tsx`. A bottom sheet (portal, blurred backdrop, drag handle, swipe-down to dismiss, body scroll lock, Escape) with the same trailer, meta and links.
- **Where the trailer comes from** — `trailer.videoAddress.url` and `trailer.cover.url` on the list endpoints (`/home`, `/subject/filter`), present on 85–95 % of items. `macdn.aoneroom.com` serves the MP4 directly (HTTP 200, `video/mp4`, **no Referer needed**), so the trailer is a plain `<video src>` and the bytes never touch Vercel.
- **Zero extra upstream calls** — the trailer rides on the card the list endpoint already returned.
- `app/globals.css` carries the keyframes (`previewPop`, `sheetUp`, `backdropIn`, `drawerIn`). There is no `tailwindcss-animate` plugin in this project, so `animate-in …` classes do nothing — use the hand-written classes.

## The mobile nav drawer (2026-11-21)

`components/layout/MobileDrawer.tsx` — a portal to `<body>` (`role="dialog"`, `aria-modal`, `z-[95]`), a panel that slides in from the left at 86 % width (max 340 px), a blurred backdrop, an X close button, Escape to close, body scroll lock, closes on route change, and highlights the active route. Sections: **Primary** (Home, Trending, Rankings, Movies, TV Shows, Animations, Most Watched, Genres, Movbox App), **Categories** (the 8 from `lib/categories.ts`), **Account** (Sign In, My List, Settings), **Company** (About, Blog, Contact, Privacy, Terms). The header carries the `md:hidden` dash button (`aria-label="Open the navigation menu"`).

---

## Next-agent checklist (when user says "continue")

1. **If "continue deploy":** walk through the 8 deploy steps above. Start with Oracle Cloud signup.
2. **If "continue rebrand":** nothing left to do — rebrand is complete. Check the user isn't asking for a logo or new color.
3. **If "fix X":** start both servers, hit the failing endpoint, check `boxmovies-api/err.log` and `boxmovies-api/server.stderr.log` for hints. 90% of bugs are upstream h5-api returning a different shape than expected.
4. **If "add a page":** follow the existing pattern. Server Component for data, Client Component for interactivity.
5. **Don't change the colors.** Don't refactor without reason. Don't add TMDB / CinePro back.
6. **Update this scratchpad** when you make progress so the next agent knows the state.
