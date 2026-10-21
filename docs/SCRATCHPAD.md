# Movbox — Scratchpad

> Running notes for the current session. Last updated: 2026-08-27 (rebrand + boxmovies-api v3.0.0 locked in).

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

---

## Next-agent checklist (when user says "continue")

1. **If "continue deploy":** walk through the 8 deploy steps above. Start with Oracle Cloud signup.
2. **If "continue rebrand":** nothing left to do — rebrand is complete. Check the user isn't asking for a logo or new color.
3. **If "fix X":** start both servers, hit the failing endpoint, check `boxmovies-api/err.log` and `boxmovies-api/server.stderr.log` for hints. 90% of bugs are upstream h5-api returning a different shape than expected.
4. **If "add a page":** follow the existing pattern. Server Component for data, Client Component for interactivity.
5. **Don't change the colors.** Don't refactor without reason. Don't add TMDB / CinePro back.
6. **Update this scratchpad** when you make progress so the next agent knows the state.
