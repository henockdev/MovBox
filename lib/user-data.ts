/**
 * User-scoped data — watchlist + watch history.
 *
 * If the user is signed in, this writes to Supabase (so the data
 * follows them across devices). If not, it falls back to the
 * localStorage-backed modules (lib/watchlist.ts, lib/history.ts).
 *
 * On sign-in, the localStorage data is automatically migrated to
 * Supabase so the user doesn't lose anything. The localStorage copy
 * is left in place as a quick offline cache.
 *
 * Server-side operations (admin tasks, migrations) go through the
 * service-role key in `lib/supabase-admin.ts`.
 */

import { createBrowserSupabase } from "@/lib/auth/browser";
import type { MediaCard } from "@/lib/types";
import {
  addToWatchlist as lsAdd,
  clearWatchlist as lsClear,
  getWatchlist as lsGet,
  removeFromWatchlist as lsRemove,
  type WatchlistEntry,
} from "@/lib/watchlist";
import {
  clearHistory as lsClearHistory,
  getHistory as lsGetHistory,
  recordProgress as lsRecord,
  type WatchHistoryItem,
} from "@/lib/history";

/**
 * The current session. `null` = anonymous (use localStorage).
 * We resolve this fresh on every call so sign-in / sign-out is
 * picked up immediately without re-rendering every consumer.
 */
async function currentUserId(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const supabase = createBrowserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------

/** Read the user's watchlist. Falls back to localStorage if anon. */
export async function getUserWatchlist(): Promise<WatchlistEntry[]> {
  const local = lsGet();
  const uid = await currentUserId();
  if (!uid) return local;

  try {
    const supabase = createBrowserSupabase();
    const { data, error } = await supabase
      .from("watchlist")
      .select(
        "detail_path, media_type, title, poster_path, backdrop_path, year, rating, added_at",
      )
      .eq("user_id", uid)
      .order("added_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map(rowToWatchlistEntry);
  } catch {
    return local; // offline / RLS error / network down
  }
}

/** Add an item. Writes to supabase when signed in, localStorage otherwise. */
export async function addUserWatchlist(item: MediaCard): Promise<void> {
  // Always update local for instant UI feedback.
  lsAdd(item);
  const uid = await currentUserId();
  if (!uid) return;
  try {
    const supabase = createBrowserSupabase();
    await supabase.from("watchlist").upsert(
      {
        user_id: uid,
        detail_path: String(item.id),
        media_type: item.type,
        title: item.title,
        poster_path: item.posterPath ?? null,
        backdrop_path: item.backdropPath ?? null,
        year: item.year ?? null,
        rating: item.rating ?? null,
        added_at: new Date().toISOString(),
      },
      { onConflict: "user_id,detail_path,media_type" },
    );
  } catch {
    /* local copy is the source of truth for now */
  }
}

/** Remove an item. */
export async function removeUserWatchlist(item: MediaCard): Promise<void> {
  lsRemove(item);
  const uid = await currentUserId();
  if (!uid) return;
  try {
    const supabase = createBrowserSupabase();
    await supabase
      .from("watchlist")
      .delete()
      .eq("user_id", uid)
      .eq("detail_path", String(item.id))
      .eq("media_type", item.type);
  } catch {
    /* ignore */
  }
}

/** Clear all. */
export async function clearUserWatchlist(): Promise<void> {
  lsClear();
  const uid = await currentUserId();
  if (!uid) return;
  try {
    const supabase = createBrowserSupabase();
    await supabase.from("watchlist").delete().eq("user_id", uid);
  } catch {
    /* ignore */
  }
}

/**
 * One-time migration: when the user signs in, push any localStorage
 * watchlist rows that aren't already in supabase. Safe to call
 * multiple times — duplicates are handled by the unique constraint.
 */
export async function migrateLocalWatchlistToSupabase(): Promise<{
  pushed: number;
  skipped: number;
}> {
  const uid = await currentUserId();
  if (!uid) return { pushed: 0, skipped: 0 };
  const local = lsGet();
  if (local.length === 0) return { pushed: 0, skipped: 0 };

  let pushed = 0;
  let skipped = 0;
  for (const item of local) {
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.from("watchlist").upsert(
        {
          user_id: uid,
          detail_path: String(item.id),
          media_type: item.type,
          title: item.title,
          poster_path: item.posterPath ?? null,
          backdrop_path: item.backdropPath ?? null,
          year: item.year ?? null,
          rating: item.rating ?? null,
          added_at:
            typeof item.addedAt === "number"
              ? new Date(item.addedAt).toISOString()
              : new Date().toISOString(),
        },
        { onConflict: "user_id,detail_path,media_type", ignoreDuplicates: true },
      );
      if (error) skipped++;
      else pushed++;
    } catch {
      skipped++;
    }
  }
  return { pushed, skipped };
}

// ---------------------------------------------------------------------------
// Watch history
// ---------------------------------------------------------------------------

/** Read the user's history. */
export async function getUserHistory(): Promise<WatchHistoryItem[]> {
  const local = lsGetHistory();
  const uid = await currentUserId();
  if (!uid) return local;

  try {
    const supabase = createBrowserSupabase();
    const { data, error } = await supabase
      .from("watch_history")
      .select(
        "detail_path, media_type, title, season, episode, progress_seconds, duration_seconds, poster_path, backdrop_path, last_watched",
      )
      .eq("user_id", uid)
      .order("last_watched", { ascending: false })
      .limit(24);
    if (error) throw error;
    return (data ?? []).map(rowToHistoryItem);
  } catch {
    return local;
  }
}

/** Record progress. */
export async function recordUserProgress(
  item: Omit<WatchHistoryItem, "lastWatched"> & {
    currentTime: number;
    duration: number;
  },
): Promise<void> {
  // Always update local.
  lsRecord(item);
  const uid = await currentUserId();
  if (!uid) return;
  try {
    const supabase = createBrowserSupabase();
    await supabase.from("watch_history").upsert(
      {
        user_id: uid,
        detail_path: item.detailPath,
        media_type: item.type,
        title: item.title,
        season: item.season ?? null,
        episode: item.episode ?? null,
        progress_seconds: item.currentTime,
        duration_seconds: item.duration,
        poster_path: item.posterUrl || null,
        backdrop_path: item.backdropUrl || null,
        last_watched: new Date().toISOString(),
      },
      {
        onConflict: "user_id,detail_path,media_type,season,episode",
      },
    );
  } catch {
    /* local copy is the source of truth */
  }
}

/** Clear all history. */
export async function clearUserHistory(): Promise<void> {
  lsClearHistory();
  const uid = await currentUserId();
  if (!uid) return;
  try {
    const supabase = createBrowserSupabase();
    await supabase.from("watch_history").delete().eq("user_id", uid);
  } catch {
    /* ignore */
  }
}

/** Remove a single history entry. */
export async function removeUserHistoryItem(
  detailPath: string,
  season?: number,
  episode?: number,
): Promise<void> {
  // Local copy first so the UI updates instantly.
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        "movbox:history:v1",
        JSON.stringify(
          (JSON.parse(window.localStorage.getItem("movbox:history:v1") || "[]") as WatchHistoryItem[]).filter(
            (it) =>
              !(
                it.detailPath === detailPath &&
                (it.season ?? null) === (season ?? null) &&
                (it.episode ?? null) === (episode ?? null)
              ),
          ),
        ),
      );
      window.dispatchEvent(new CustomEvent("movbox:history:updated"));
    } catch {
      /* ignore */
    }
  }
  const uid = await currentUserId();
  if (!uid) return;
  try {
    const supabase = createBrowserSupabase();
    let q = supabase
      .from("watch_history")
      .delete()
      .eq("user_id", uid)
      .eq("detail_path", detailPath);
    if (season == null) {
      q = q.is("season", null);
    } else {
      q = q.eq("season", season);
    }
    if (episode == null) {
      q = q.is("episode", null);
    } else {
      q = q.eq("episode", episode);
    }
    await q;
  } catch {
    /* ignore */
  }
}

/** Migrate localStorage history to supabase. */
export async function migrateLocalHistoryToSupabase(): Promise<{
  pushed: number;
  skipped: number;
}> {
  const uid = await currentUserId();
  if (!uid) return { pushed: 0, skipped: 0 };
  const local = lsGetHistory();
  if (local.length === 0) return { pushed: 0, skipped: 0 };

  let pushed = 0;
  let skipped = 0;
  for (const item of local) {
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.from("watch_history").upsert(
        {
          user_id: uid,
          detail_path: item.detailPath,
          media_type: item.type,
          title: item.title,
          season: item.season ?? null,
          episode: item.episode ?? null,
          progress_seconds: item.currentTime,
          duration_seconds: item.duration,
          poster_path: item.posterUrl || null,
          backdrop_path: item.backdropUrl || null,
          last_watched: new Date(item.lastWatched).toISOString(),
        },
        {
          onConflict: "user_id,detail_path,media_type,season,episode",
          ignoreDuplicates: true,
        },
      );
      if (error) skipped++;
      else pushed++;
    } catch {
      skipped++;
    }
  }
  return { pushed, skipped };
}

// ---------------------------------------------------------------------------
// Row → typed conversion
// ---------------------------------------------------------------------------

function rowToWatchlistEntry(row: {
  detail_path: string;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  year: string | null;
  rating: number | null;
  added_at: string;
}): WatchlistEntry {
  return {
    id: row.detail_path,
    type: row.media_type,
    title: row.title,
    posterPath: row.poster_path ?? null,
    backdropPath: row.backdrop_path ?? null,
    year: row.year ?? "",
    rating: row.rating ?? 0,
    addedAt: new Date(row.added_at).getTime(),
    overview: "",
  };
}

function rowToHistoryItem(row: {
  detail_path: string;
  media_type: "movie" | "tv";
  title: string;
  season: number | null;
  episode: number | null;
  progress_seconds: number;
  duration_seconds: number;
  poster_path: string | null;
  backdrop_path: string | null;
  last_watched: string;
}): WatchHistoryItem {
  return {
    detailPath: row.detail_path,
    type: row.media_type,
    title: row.title,
    season: row.season ?? undefined,
    episode: row.episode ?? undefined,
    currentTime: Number(row.progress_seconds),
    duration: Number(row.duration_seconds),
    posterUrl: row.poster_path ?? "",
    backdropUrl: row.backdrop_path ?? row.poster_path ?? "",
    lastWatched: new Date(row.last_watched).getTime(),
  };
}
