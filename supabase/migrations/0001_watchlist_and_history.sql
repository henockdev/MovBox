-- ============================================================================
-- Movbox — Watchlist + Watch History (sync to Supabase)
-- ============================================================================
--
-- This migration adds two user-scoped tables and the RLS policies
-- needed for the Watchlist page and Continue Watching feature to
-- sync across devices.
--
-- How to run:
--   1. Open https://supabase.com/dashboard/project/hbbbayvqnoydxpqfbxwx
--   2. Click SQL Editor (left sidebar)
--   3. Click "+ New query"
--   4. Paste this entire file
--   5. Click "Run" (or press Cmd/Ctrl+Enter)
--   6. Done — the Next.js app will pick up the tables on its next
--      request, no restart needed.
--
-- Safe to re-run: every CREATE uses IF NOT EXISTS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- watchlist
-- ---------------------------------------------------------------------------
-- One row per (user, media). detailPath is the boxmovies unique
-- key (e.g. "the-matrix-abc123"). type is "movie" or "tv".

create table if not exists public.watchlist (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  detail_path text        not null,
  media_type  text        not null check (media_type in ('movie', 'tv')),
  title       text        not null,
  poster_path text,
  backdrop_path text,
  year        text,
  rating      numeric(4,1),
  added_at    timestamptz not null default now(),
  -- One row per (user, detail_path, media_type) — user can't add the
  -- same movie/show twice.
  unique (user_id, detail_path, media_type)
);

create index if not exists watchlist_user_id_idx
  on public.watchlist (user_id, added_at desc);

-- ---------------------------------------------------------------------------
-- watch_history
-- ---------------------------------------------------------------------------
-- One row per (user, show, season, episode) — when the user watches
-- the same episode again, we upsert the position.

create table if not exists public.watch_history (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  detail_path       text        not null,
  media_type        text        not null check (media_type in ('movie', 'tv')),
  title             text        not null,
  season            integer,
  episode           integer,
  -- Note: PostgreSQL reserves `current_time` as a system function, so
  -- the column is named `progress_seconds` instead. The Next.js
  -- client (lib/user-data.ts) writes `progress_seconds` to match.
  progress_seconds  numeric     not null default 0,
  duration_seconds  numeric     not null default 0,
  poster_path       text,
  backdrop_path     text,
  last_watched      timestamptz not null default now(),
  unique (user_id, detail_path, media_type, season, episode)
);

create index if not exists watch_history_user_id_idx
  on public.watch_history (user_id, last_watched desc);

-- ---------------------------------------------------------------------------
-- Row Level Security — each user can only read/write their own rows.
-- ---------------------------------------------------------------------------

alter table public.watchlist     enable row level security;
alter table public.watch_history enable row level security;

-- Drop any existing policies so this script is idempotent.
drop policy if exists "own rows only" on public.watchlist;
drop policy if exists "own rows only" on public.watch_history;
drop policy if exists "own insert" on public.watchlist;
drop policy if exists "own insert" on public.watch_history;
drop policy if exists "own update" on public.watchlist;
drop policy if exists "own update" on public.watch_history;
drop policy if exists "own delete" on public.watchlist;
drop policy if exists "own delete" on public.watch_history;

create policy "own rows only"
  on public.watchlist
  for select
  using (auth.uid() = user_id);

create policy "own insert"
  on public.watchlist
  for insert
  with check (auth.uid() = user_id);

create policy "own update"
  on public.watchlist
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own delete"
  on public.watchlist
  for delete
  using (auth.uid() = user_id);

create policy "own rows only"
  on public.watch_history
  for select
  using (auth.uid() = user_id);

create policy "own insert"
  on public.watch_history
  for insert
  with check (auth.uid() = user_id);

create policy "own update"
  on public.watch_history
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own delete"
  on public.watch_history
  for delete
  using (auth.uid() = user_id);
