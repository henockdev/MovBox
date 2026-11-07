# Movbox — Handoff

> **Project:** Movbox — free, ad-supported movie / TV / anime streaming site
> **Domain:** `movbox.xyz` (bought on Spaceship, transfer to Cloudflare pending)
> **Repo:** `C:\projects\HMovies`
> **Backend:** `boxmovies-api` at `C:\Users\hp\.mavis\agents\mavis\workspace\boxmovies-api\` — drives `boxmovies.org` on the user's behalf. See `boxmovies-api/README.md`.

**Last updated:** 2026-08-27 (rebrand + boxmovies-api v3.0.0 — all features done, ready to deploy)

---

## ⚠️ CURRENT STATE (2026-11-06) — read this first

The sections below were written on 2026-08-27 and are **stale in two ways**.
This block overrides them.

| Stale text says | Reality now |
|---|---|
| Repo is `C:\projects\HMovies` | Repo is `C:\projects\learn\android-app-investigation\websites\movbox`, on GitHub at `https://github.com/henockdev/MovBox`, branch `main`. It **is** deployed and live at `movbox.xyz` on **Vercel** — not on Oracle Cloud. |
| "Deploy to Oracle Cloud Always Free" is the next step | That did not happen. Vercel is the production host. The deploy is a `git push` to `main`. |
| `boxmovies-api` is the backend | It is gone. The site calls `h5-api.aoneroom.com/wefeed-h5api-bff` directly from `lib/data.ts`, with a signed mobile-BFF path (`api6.aoneroom.com`) and a DigitalOcean stream relay as fallbacks. |

### The SEO / GEO recalibration (2026-11-06)

The owner reported *"since you edited it you ruined the SEO — no impressions and
clicks"*. Five real defects were found and fixed. **Read
[`docs/SEO-RECALIBRATION.md`](./SEO-RECALIBRATION.md) before touching metadata
again** — it has the before/after measurements, the reasoning, and the
regression scripts.

The one that mattered: `lib/data.ts` minted its bearer token with
`cache: "no-store"` and every catalogue fetch carried an `AbortSignal`. Both
opt a Next.js route out of static rendering, so **every page on the site was
served `private, no-cache, no-store` and re-rendered from scratch on every
request** — 3.7 s for the homepage, 5.5 s for `/most-watched`, across a
24 592-URL sitemap. The fix is `next: { revalidate }` on the fetches and a
promise race (`withTimeout`) for the timeout instead of an abort.

**Never reintroduce `cache: "no-store"` or an `AbortSignal` on a catalogue
fetch.** That is the single regression that kills the crawl.

### The subtitle bug (2026-11-06)

*"It lists the available subtitle but not rendering them."*

There were **two** defects. The second was the one that actually broke
production, and it was only visible in the browser's network log.

**1. The CORS preflight (production).** A browser `<track>` element **always**
fetches in CORS mode; a cross-origin `<video>` does not — it is no-cors.
That asymmetry is why the video played perfectly and not one subtitle cue
ever appeared.

`app/api/sources/route.ts` handed the browser a raw relay caption URL
whenever the path ended in `/subtitle`. The relay's preflight answers
`Access-Control-Allow-Origin: *` but omits
`Access-Control-Allow-Methods`, so Chrome rejects it and never issues the
request. Measured: all 14 caption requests (preflight + GET for 7 tracks)
failed instantly.

Every caption URL now goes through `/api/subtitle-proxy` — same-origin, no
preflight, and the proxy guarantees `text/vtt`. The relay host was already
on the proxy's allowlist.

**2. The track-mode race.** The player set `mode = "showing"` before the
cues existed (the proxy has to pull the `.srt` off the upstream CDN first,
which takes seconds), and Chrome's automatic text-track selection can put
the track back to `disabled` when it finally loads. The code had a comment
promising a `load` listener that was never registered; it is now. The
player's hook count is deliberately left fixed (the component notes a
cached-chunk crash from adding a hook), so the current intent is shared
through a module-level `WeakMap` rather than a ref.

**Apply when:** touching the player's text-track handling, or the caption
URL construction in `app/api/sources/route.ts`. If subtitles stop appearing,
check that every caption URL is proxied and that the `load` handler on each
`<track>` still calls `applySubtitleModes`.

### Regression suite

```
node scripts/verify-routes.mjs http://localhost:3210        # must print: 65/65 OK
node scripts/seo-structure-check.mjs http://localhost:3210   # must print: PROBLEMS: none
node scripts/probe-subtitles.mjs http://localhost:3210       # must print: all caption URLs are same-origin
node scripts/seo-probe.mjs http://localhost:3210
node scripts/seo-homepage-weight.mjs http://localhost:3210
```

Run them against a local production build (`npx next build && npx next start
-p 3210`), not only against the live site.

`probe-subtitles.mjs` is the guard for the subtitle bug: it exits non-zero if
any caption URL points at a foreign origin, or if any track does not come
back as valid WebVTT. `wait-for-deploy.mjs` and `wait-for-subtitle-fix.mjs`
poll the live site for a finished deploy.

Note for a local run: `api6.aoneroom.com` is reachable from this machine but
answers **440** from Vercel, so the local build takes the OnStream path and
production takes the relay fallback. Both paths are covered by the fix, but
only production exercises the relay one — verify it there.

### Metadata rules (violated once already)

- The root layout sets `title.template = "%s | Movbox"`. **Do not put `| Movbox`
  in a `title`** — it renders as `… | Movbox | Movbox`. `lib/seo.ts` documents this.
- Meta descriptions belong in the **120–160 character** band. Below 120 Google
  rewrites them; above 160 it truncates mid-word. `clampDescription()` in
  `lib/seo.ts` handles the upstream synopses on the detail pages.
- Every indexable route needs: a title ≤ 65 chars, a description in the band,
  a self-canonical, an `og:url` matching it, exactly one `<h1>`, and JSON-LD.
- The site's identity markup (`WebSite` + `Organization` + `SearchAction`) is
  in `components/seo/SiteJsonLd.tsx` and is mounted in the root layout — it
  belongs on every page.

---

## What Movbox is

A free, ad-supported streaming site that wraps **boxmovies.org** with our own **luxury, premium UI**. Burgundy-led cinematic dark theme — colors are user-approved and **must NOT change** ("bro dont change the colors i love them").

The actual content (movie metadata, MP4 streams, subtitles) comes from boxmovies.org's hidden **h5-api** (`h5-api.aoneroom.com`). Our `boxmovies-api` server is a thin REST wrapper that:
1. Logs into boxmovies.org once to grab a Bearer token (cached for ~90 days).
2. Calls h5-api server-side (no Chrome needed for browse / search / detail).
3. Drives 1 headless Chrome page only for `/stream` (scrapes the player's pre-loaded MP4 quality state + listens for `/subject/caption`).

**No payment, no auth, no subscription.** The "Sign In" / "Pricing" buttons are visual placeholders.

---

## Architecture at a glance

```
┌─────────────────┐       ┌──────────────────┐       ┌──────────────────────┐
│  Browser        │       │  Movbox (Next.js) │       │  boxmovies-api       │
│  (movbox.xyz)   │  →    │  localhost:3000   │  →    │  localhost:4000      │
│                 │       │                  │       │                      │
│  RSC + Client   │       │  /api/* routes   │       │  fetch → h5-api      │
│  Components     │       │  (server-side)   │       │  Chrome → boxmovies  │
└─────────────────┘       └──────────────────┘       └──────────────────────┘
                                                                │
                                                                ▼
                                                     h5-api.aoneroom.com
                                                     + boxmovies.org (Chrome)
```

**Production deploy (pending):** Browser → Cloudflare Free → Nginx on Oracle Cloud Always Free (Frankfurt) → Next.js + boxmovies-api on the same VM, with `pm2`.

---

## Brand

| Old | New |
|---|---|
| Hmovies (or HMovies) | **Movbox** |
| `hmovies.xyz` / `hmovies.site` | `movbox.xyz` |
| CinePro (OMSS) backend | `boxmovies-api` (drives boxmovies.org) |
| TMDB fallback | removed — boxmovies.org is the single source of truth |
| `hmovies:watchlist` localStorage key | `movbox:watchlist` (legacy key still read for migration) |

**Watchlist migration note:** `lib/watchlist.ts` reads the legacy `hmovies:watchlist` key for backward compat, then re-saves under `movbox:watchlist` on next write. Both event names (`movbox:watchlist-change` and `hmovies:watchlist-change`) are dispatched/handled.

---

## Stack

- **Next.js 16.3.1** + **React 19.2** + **TypeScript** (strict)
- **Tailwind v4** (CSS-based config in `app/globals.css` — NO `tailwind.config.js`)
- **Fonts:** Inter (body) + Cinzel (display) via `next/font/google`
- **boxmovies-api:** Node 20 + Fastify 5 + puppeteer-core (uses system Chrome, no bundled Chromium)
- **Backend `boxmovies-api`:** `C:\Users\hp\.mavis\agents\mavis\workspace\boxmovies-api\`

---

## What's done (✅)

### Frontend (Movbox, all pages)
| Page | Path | Notes |
|---|---|---|
| Home | `/` | 21 themed sections + hero, full-bleed background |
| Movie detail | `/movie/[id]` | Luxury layout, "More Like This" |
| TV detail | `/tv/[id]` | Same template, type-detected |
| Movie player | `/watch/movie/[id]` | MP4 only, 4 quality sources, SRT/VTT subs, fullscreen, PiP, keyboard shortcuts |
| TV player | `/watch/tv/[id]?s=1&e=1` | Layout persists across `?s&e` changes (no remount) |
| Movies browse | `/movies` | Filter chips + sidebar, infinite scroll, channelId=1 |
| TV browse | `/tv` | channelId=2 |
| Animations | `/animations` | channelId=7 → upstream 1006 (1M+ titles) |
| Most watched | `/most-watched` | |
| Trending | `/trending` | |
| Coming soon | `/coming-soon` | "Movbox App — Coming Soon" (Android app download hub) |
| Search | `/search?q=&type=` | Typeahead via `POST /subject/search-suggest`, full results via `POST /subject/search` |
| Watchlist | `/watchlist` | localStorage, "Play All" CTA |
| Genres list | `/genres` | Card grid |
| Genre detail | `/genres/[id]` | Filtered grid |
| Login / Signup | `/login`, `/signup` | Visual only |
| 404 | `not-found.tsx` | Popcorn art |

### Frontend (API routes)
- `/api/home`, `/api/trending`, `/api/browse`, `/api/filter-options`
- `/api/search` (GET → uses POST /subject/search)
- `/api/search-suggest` (GET → uses POST /subject/search-suggest)
- `/api/detail` (GET)
- `/api/sources` (GET → relay `/stream`; returns the ladder + caption URLs, both already pointing at the relay's `/mp4` and `/subtitle` endpoints)
- `/api/video-proxy` — **degraded fallback only.** Raw upstream MP4 with `Referer: https://boxmovies.org/`. Normal playback never touches it.
- `/api/subtitle-proxy` — **degraded fallback only.** Converts SRT→VTT for raw upstream captions. The relay already serves WebVTT.

> **Media bytes never travel through Vercel.** The relay carries the video and
> the subtitles; Next.js only serves HTML and the ~2 KB `/api/sources` JSON.
> See `docs/STREAMING-HANDOFF.md` for the full contract.

### Stream relay (`MovBox-Api`)
A stateless Node server — no headless Chrome, no per-IP token pool on the hot
path. It authenticates with a stateless clock token (`X-Client-Token`) and
forwards the client's `Range` header verbatim. See
`docs/STREAMING-HANDOFF.md` for the endpoint contract and measured behaviour.

### Branding
- ✅ `lib/constants.ts` (SITE_NAME, SITE_URL)
- ✅ `app/layout.tsx` (metadata: title, OG, Twitter)
- ✅ `components/layout/Header.tsx`, `Footer.tsx`, `Logo.tsx`, `SearchBar.tsx`
- ✅ All page titles, descriptions, breadcrumb labels
- ✅ `app/manifest.ts` (PWA short_name: "Movbox")
- ✅ `lib/watchlist.ts` (new key + legacy compat)
- ✅ `components/home/MovieCard.tsx` (visible text)
- ✅ `components/watch/WatchSession.tsx` (visible text)
- ✅ All code comments updated

---

## What's NOT done yet (deploy + polish)

| Item | Priority | Notes |
|---|---|---|
| **Deploy to Oracle Cloud Always Free** | 🔴 high | Sign up, create VM.Standard.E2.1.Micro, Ubuntu 22.04, Frankfurt. See `docs/SCRATCHPAD.md` for the command list. |
| **Configure Cloudflare in front** | 🔴 high | Transfer DNS from Spaceship to Cloudflare (free), add A record, SSL Full mode, cache rules for `/api/home`, `/api/browse`, `/api/search`, `/api/detail`. |
| **Verify `/api/sources` end-to-end on prod** | 🔴 high | Re-test after deploy with `movbox.xyz` hostname. |
| **Real ads (AdSense / etc.)** | ⚪ low | No ad slots yet. Add `<AdSlot id="..." />` components when ready. |
| **Real auth** | ⚪ low | `lib/supabase.ts` is wired but unused. |
| **Cleanup `lib/cinepro.ts`** | ⚪ low | Dead code (we use `lib/boxmovies.ts` now). Comment marked it; safe to delete. |
| **Logo SVG** | ⚪ low | Currently a Cinzel "M" rendered in CSS. If the user provides a real SVG, swap it in `components/layout/Logo.tsx`. |

---

## How to run dev (current setup)

```powershell
# Terminal 1 — boxmovies-api
cd C:\Users\hp\.mavis\agents\mavis\workspace\boxmovies-api
npm start
# → http://localhost:4000/health

# Terminal 2 — Movbox frontend
cd C:\projects\HMovies
npm run dev
# → http://localhost:3000

# (Optional) Smoke test
cd C:\Users\hp\.mavis\agents\mavis\workspace\boxmovies-api
npm run smoke
```

`.env.local` needs only `NEXT_PUBLIC_BOXMOVIES_API=http://localhost:4000` (defaulted if not set). No TMDB, no CinePro, no API keys.

### Detached processes (avoid 30-min task cap)

The Mavis background-task wrapper kills processes after 30 min. Use `Start-Process`:

```powershell
Start-Process -FilePath "node" `
  -ArgumentList "server.mjs" `
  -WorkingDirectory "C:\Users\hp\.mavis\agents\mavis\workspace\boxmovies-api" `
  -RedirectStandardOutput "out.log" `
  -RedirectStandardError "err.log" `
  -WindowStyle Hidden
```

Check status:
```powershell
Get-Process node | Format-Table Id, @{N='RSS_MB';E={[math]::Round($_.WorkingSet64/1MB,1)}}, StartTime
Invoke-WebRequest http://localhost:4000/health -UseBasicParsing
```

---

## Conventions

- **Color tokens:** use the Tailwind v4 names defined in `app/globals.css` (`bg-deepest`, `text-cream`, `border`, `accent-bright`, etc.) — **do NOT hardcode hex values**. The burgundy palette is the brand.
- **Fonts:** `font-body` (Inter) for everything, `font-display` (Cinzel) for cinematic headlines.
- **Spacing:** prefer Tailwind's default scale; breakpoints are `sm` `md` `lg` (mobile-first).
- **Server vs client:** all data fetching is in Server Components by default. Use `"use client"` only for interactivity (search bar, header scroll, video player, watchlist button).
- **Images:** always via `next/image`. For boxmovies, use the `imageUrl()` helper in `lib/image.ts` (handles full URLs vs paths).
- **No `console.log`** in shipped code. Use proper error boundaries.
- **TypeScript:** strict. No `any`; narrow types.
- **Components:** Server Components by default. Mark `"use client"` only when you need hooks/events.
- **Icons:** from `lucide-react`. Don't import specific paths; let the bundler tree-shake.
- **Brand:** ALWAYS say "Movbox", never "Hmovies" in user-visible text. The `hmovies:watchlist` localStorage event is the ONLY legacy reference left (intentional for migration).

---

## Project tree (key files)

```
C:\projects\HMovies\
├── app/
│   ├── globals.css              # Tailwind v4 + Movbox design tokens
│   ├── icon.tsx                 # Dynamic favicon (burgundy M)
│   ├── layout.tsx               # Root layout
│   ├── manifest.ts              # PWA manifest (name: "Movbox")
│   ├── not-found.tsx            # 404 (popcorn art)
│   ├── page.tsx                 # Home (21 sections + hero)
│   ├── movie/[id]/page.tsx      # Luxury movie detail
│   ├── tv/[id]/page.tsx         # Luxury TV detail
│   ├── watch/
│   │   ├── movie/[id]/page.tsx  # Movie player
│   │   └── tv/[id]/page.tsx     # TV player (layout persists across s/e)
│   ├── movies/page.tsx          # Filterable browse (channelId=1)
│   ├── tv/page.tsx              # Filterable browse (channelId=2)
│   ├── animations/page.tsx      # Filterable browse (channelId=7)
│   ├── most-watched/page.tsx
│   ├── trending/page.tsx
│   ├── coming-soon/page.tsx     # "Movbox App — Coming Soon"
│   ├── search/page.tsx          # Search with type tabs
│   ├── watchlist/page.tsx
│   ├── genres/page.tsx
│   ├── genres/[id]/page.tsx
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── api/
│       ├── home/route.ts
│       ├── browse/route.ts
│       ├── filter-options/route.ts
│       ├── search/route.ts
│       ├── search-suggest/route.ts
│       ├── detail/route.ts
│       ├── sources/route.ts
│       ├── video-proxy/route.ts
│       └── subtitle-proxy/route.ts
│
├── components/
│   ├── ui/                      # Button, Badge, Skeleton, PageLoader
│   ├── layout/                  # Header, Footer, MobileNav, Logo, SearchBar
│   ├── home/                    # HeroCarousel, MovieCard, MovieRow, FilterChips, BrowseGrid, etc.
│   ├── watch/                   # Player, SourceList, WatchSession, ...
│   ├── watchlist/               # WatchlistButton
│   └── auth/                    # AuthLayout
│
├── lib/
│   ├── boxmovies.ts             # ⭐ PRIMARY backend client (replaces tmdb + cinepro)
│   ├── types.ts                 # BoxSource, BoxCaption, BoxMediaCard, BoxDetail, ...
│   ├── constants.ts             # SITE_NAME, SITE_URL, genres, quality levels
│   ├── watchlist.ts             # localStorage + legacy hmovies key
│   ├── image.ts                 # imageUrl() helper
│   ├── format.ts                # Date / rating / count formatters
│   ├── useSources.ts            # Client-side source cache hook
│   ├── utils.ts                 # cn() class merger
│   ├── supabase.ts              # Auth + DB (wired but unused)
│   ├── tmdb.ts                  # ⛔ DEAD CODE — kept for reference, no longer imported
│   └── cinepro.ts               # ⛔ DEAD CODE — kept for reference, no longer imported
│
├── docs/
│   ├── HANDOFF.md               # ← you are here
│   ├── SCRATCHPAD.md            # running notes
│   ├── PLAN.md                  # initial design plan
│   └── DESIGN.md                # design system reference
│
├── public/                      # Static assets
├── next.config.ts
├── tsconfig.json
├── package.json
├── .env.example
└── .env.local
```

---

## Next-agent checklist

When the user comes back and says "continue":

1. **Read this file first**, then `docs/SCRATCHPAD.md` for current state.
2. **If deploy is next:** follow the deploy steps in `docs/SCRATCHPAD.md` (Oracle Cloud + Cloudflare).
3. **If something broke:** start both servers (`npm start` in boxmovies-api, `npm run dev` in frontend), then hit each `/api/*` route and compare against `boxmovies-api/README.md`'s endpoint table.
4. **Don't refactor the existing code without reason.** The architecture is locked in (boxmovies-api as backend, no TMDB, no CinePro).
5. **Don't change the colors.** Burgundy-led cinematic dark theme is the brand.
6. **When you add a new shadcn-style primitive**, follow the `cva` pattern in `components/ui/Button.tsx`.
7. **Keep commits small + scoped.** One page = one commit.
8. **Update `docs/SCRATCHPAD.md`** as you go so the next agent knows the state.

---

## Known gotchas

- **The 60s preview vs full-movie CDN** — boxmovies.org uses different CDN signed URLs for preview (60s) vs full stream. The relay adds `Referer: https://boxmovies.org/` to every media request, which is what unlocks the full stream. Don't bypass the relay or you'll get 60-second videos.
- **Subject IDs are huge integers** (e.g. `8352681232614545872`). Use `detailPath` as the key in the frontend, not subjectId. The slug format is `<title>-<random10char>`.
- **boxmovies.org sometimes returns 404 for valid slugs** — it's a CDN race. The browser will retry automatically via the next /api/* call.
- **`/browse?channelId=7` upstream 1006** — boxmovies.org renames our `channelId=7` to upstream `1006` for the 1M+ anime catalog. We do the same rewrite in boxmovies-api. Don't "fix" it back to 7.
- **h5-api auth on the hot path is stateless** — `/subject/play` and `/subject/caption` accept a clock token (`X-Client-Token`), so there is no login, no Chrome, and no 90-day token expiry. The per-IP Bearer pool is only used for `/subject/search` and as a fallback.
- **No headless Chrome in the relay** — it is a plain Node server (~60 MB RAM), so there is no Chrome to leak, restart, or balloon. If you find yourself reaching for PM2 + Chrome, you are looking at the old architecture.
- **`dev.log`, `dev.err`, `dev.stdout.log`, `dev.stderr.log`** in the project root are dev-server noise, gitignored.
- **Background-task 30-min cap** — use `Start-Process` for anything you want to leave running.
- **CinePro / TMDB code** in `lib/` is dead. Don't import it. `lib/boxmovies.ts` is the only backend client.
