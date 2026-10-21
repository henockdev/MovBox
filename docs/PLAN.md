# Hmovies — Implementation Plan

## Goals

1. Build a beautiful, pixel-accurate frontend for a movie/TV streaming site.
2. Match the user's design (cinematic dark + burgundy) on desktop, tablet, mobile.
3. Hook into a self-hosted CinePro (OMSS) backend for stream sources.
4. Deploy to **Oracle Cloud Always Free** (backend) + **Cloudflare Pages** (frontend) for ~$10/year total (just the domain).
5. Be smart about free-tier limits so the service stays online.

## Constraints

- **No money** (except a ~$10/year domain).
- **No payment / subscription** — the "Pricing" / "Payment" / "Sign In" / "Sign Up" pages are visual representation only. We monetize via ads.
- **Backend currently 2/14 providers alive** (VixSrc + FshareTV) — UI must handle "no sources" gracefully.
- **Mobile + tablet + desktop responsive is mandatory.**

## Architecture

```
                          ┌─────────────────────┐
   Browser                │  Cloudflare Pages   │   (free, global CDN)
       │                  │  hmovies.xyz        │
       │                  └──────────┬──────────┘
       │                             │
       │                             ▼
       │                  ┌─────────────────────┐
       │                  │  Cloudflare Tunnel  │   (free, no public ports)
       │                  │  api.hmovies.xyz    │
       │                  └──────────┬──────────┘
       │                             │
       │                             ▼
       │              ┌──────────────────────────┐
       └─────────────►│  Oracle Cloud A1.Flex   │   (Always Free, 1 instance)
                      │  ARM, 2 OCPU, 12 GB RAM  │
                      │                          │
                      │  ┌────────────────────┐  │
                      │  │ Docker Compose:    │  │
                      │  │  • CinePro backend │  │
                      │  │  • Caddy (HTTPS)   │  │
                      │  │  • Postgres        │  │
                      │  └────────────────────┘  │
                      └──────────────────────────┘
```

## Design System (locked)

- **Brand:** Hmovies (H = user's name, "movies" wordmark)
- **Palette:** see `docs/DESIGN.md` for the full token list
- **Fonts:** Inter (body) + Cinzel (display headlines)
- **Tone:** Cinematic dark with burgundy-led accents
- **No light mode** for v1

## Pages (scope)

| Page | Path | Status | Phase |
|---|---|---|---|
| Home | `/` | ✅ Done | 1 |
| 404 | `*` | ✅ Done | 1 |
| Movies browse | `/movies` | ⏳ | 2 |
| Movie detail | `/movies/[id]` | ⏳ | 2 |
| TV browse | `/tv` | ⏳ | 2 |
| TV detail | `/tv/[id]` | ⏳ | 2 |
| TV season view | `/tv/[id]/season/[s]` | ⏳ | 2 |
| Player (movie) | `/watch/movie/[id]` | ⏳ | 2 |
| Player (TV) | `/watch/tv/[id]/[s]/[e]` | ⏳ | 2 |
| Search | `/search` | ⏳ | 2 |
| Watchlist | `/watchlist` | ⏳ | 2 |
| Genres | `/genres` | ⏳ | 2 |
| Genre detail | `/genres/[id]` | ⏳ | 2 |
| Trending | `/trending` | ⏳ | 2 |
| Coming Soon | `/coming-soon` | ⏳ | 2 |
| Login | `/login` | ⏳ visual | 2 |
| Signup | `/signup` | ⏳ visual | 2 |
| Pricing | `/pricing` | ⚪ skip | — |
| Payment | `/payment` | ⚪ skip | — |

## SEO (technical, applied throughout)

- ✅ Per-page `<Metadata>` (title, description, OG, Twitter)
- ✅ Canonical URL
- ✅ Open Graph + Twitter Card on home (extend to all pages in Phase 2)
- ✅ `app/sitemap.ts` (extend with dynamic entries from TMDB in Phase 2)
- ✅ `app/robots.ts`
- ✅ `app/manifest.ts` (PWA)
- ⏳ JSON-LD: `Movie`, `TVSeries`, `Person`, `Review`, `AggregateRating`, `BreadcrumbList` on detail pages
- ⏳ Per-page Open Graph images (generated via `next/og`)
- ⏳ Hreflang if multilingual (skipped for v1)

**Honest note on SEO:** streaming aggregator sites have natural SEO limits because Google deprioritizes thin/scraper pages. The site will be **technically perfect** for SEO, but ranking for high-competition "watch [movie] online" queries is a 6-12 month long game. Fastest wins: branded search, long-tail, Google rich results (rating stars via JSON-LD).

## Deployment plan (Phase 3, after frontend is complete)

### 1. Domain
Buy `hmovies.xyz` (or `.site`) via **Cloudflare Registrar** — at-cost pricing, ~$10/year.

### 2. Oracle Cloud Always Free
- A1.Flex instance: 2 OCPU + 12 GB RAM (leaves 2 OCPU + 12 GB as headroom)
- Image: **Oracle Linux 8 / Ubuntu 22.04 aarch64**
- **Critical:** never `stop` the instance. Use `reboot` if you need to restart, otherwise Oracle may reclaim it.

### 3. Backend on Oracle
Docker Compose with three services:
- `cinepro` — your fork, exposing port 3000
- `caddy` — reverse proxy + auto-HTTPS via Cloudflare DNS challenge
- `postgres` — optional, only if/when we add real auth/watchlist persistence

Persistent volumes for `node_modules`, `dist/`, `postgres_data`.

### 4. Cloudflare Tunnel
- `cloudflared` runs on the Oracle box, dials out to Cloudflare
- `api.hmovies.xyz` → `http://localhost:3000` (CinePro)
- Zero firewall ports open. Oracle IP is hidden.

### 5. Frontend on Cloudflare Pages
- Connect GitHub repo
- Build command: `npm run build`
- Output: `.next/`
- Env vars: `NEXT_PUBLIC_CINEPRO_BASE=https://api.hmovies.xyz`, `TMDB_API_KEY`, `NEXT_PUBLIC_SITE_URL=https://hmovies.xyz`
- Custom domain: `hmovies.xyz` → automatic SSL

### 6. Supabase (only when we wire real auth)
- Free tier
- Anti-pause: Cloudflare Worker cron pings the project every 3 days

## Cost summary

| Item | Cost |
|---|---|
| Domain | ~$10/year |
| Oracle Always Free | $0 |
| Cloudflare Pages | $0 |
| Cloudflare Tunnel | $0 |
| TMDB API | $0 |
| Supabase free (anti-pause worker) | $0 |
| **Total** | **~$10/year** |

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Oracle reclaims idle instance | `reboot` only, never `stop`. Health check Worker to detect down. |
| Cloudflare Pages down | Out of our control. Use their status page to monitor. |
| TMDB rate limit (40 req/sec) | ISR cache (`revalidate: 3600`), no real-time fetches. |
| CinePro provider death (frequent) | UI handles "no sources" gracefully. Log provider health for monitoring. |
| Supabase pause (7d no traffic) | Cloudflare Worker cron ping every 3 days. |
| Domain expires | Auto-renew enabled in Cloudflare. |
| Backend crashes | Docker restart policy `always`. |

## Phase boundaries

- **Phase 1 (scaffold):** Done. Project shell, design system, home page, layout.
- **Phase 2 (pages):** All browse/detail/player/search/etc pages. ~10-12 pages.
- **Phase 3 (deploy):** Oracle backend + Cloudflare Pages + Tunnel + domain.
- **Phase 4 (polish):** SEO JSON-LD on all pages, accessibility audit, performance pass, ad slots, analytics.
