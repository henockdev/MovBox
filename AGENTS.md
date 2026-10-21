<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

# Movbox — project context for AI agents

**Read `docs/HANDOFF.md` first.** It has the full project context, design system, deploy plan, and what's done vs. what's next.

## TL;DR
- **Project:** Movbox (Next.js 16 + Tailwind v4 frontend for a free, ad-supported streaming site at `movbox.xyz`)
- **Backend:** the thin stream relay (`MovBox-Api`) at `C:\projects\Learnning SE\MovBox-Api\` — one stateless Node server that talks to h5-api.aoneroom.com and carries every video + subtitle byte
- **Brand:** **Movbox** (rebranded from Hmovies). Burgundy-led cinematic dark theme — **DO NOT CHANGE THE COLORS** ("bro dont change the colors i love them").
- **Stack:** Next.js 16.3.1, React 19.2, TypeScript, Tailwind v4 (CSS-based config in `app/globals.css`), `next/font` for Inter + Cinzel
- **State:** All pages + all API routes built. The relay is stateless Node (no headless Chrome, ~60 MB RAM). The full streaming contract is in `docs/STREAMING-HANDOFF.md`.
- **Single source of truth:** `boxmovies.org` via h5-api. **No TMDB, no CinePro, no API keys needed.**
- **Conventions:** see "Conventions" section in `docs/HANDOFF.md`.

## Hard rules
- **Don't change the colors** (burgundy + cream + bg-deepest palette is the brand).
- **Don't re-add TMDB or CinePro.** They're dead code in `lib/`. Use `lib/boxmovies.ts`.
- **Video and subtitle bytes MUST go through the relay, never through Vercel.** `/api/sources` hands the player URLs that point at the relay's `/mp4` and `/subtitle`. `/api/video-proxy` and `/api/subtitle-proxy` are degraded fallbacks for raw upstream URLs only — do not route normal playback through them.
- **The quality ladder is ASCENDING and the smallest rung auto-plays.** Do not "fix" the sort order; the user picks a better rung from the quality menu.
- **Use the new key `movbox:watchlist`** for any new localStorage work. The legacy `hmovies:watchlist` is read-only for migration.

## Quick commands
```powershell
# Backend (the thin stream relay)
cd C:\projects\Learnning SE\MovBox-Api
node server.mjs

# Frontend
cd C:\projects\Learnning SE\MovBox
npm run dev

# Smoke test
cd C:\projects\Learnning SE\MovBox-Api
node test-relay.mjs
```

<!-- END:nextjs-agent-rules -->
