/**
 * Watch history — client-side, localStorage-backed.
 *
 * The Player calls `recordProgress()` every 5s while the user is
 * watching. The home page reads the result via `getHistory()` and
 * renders a "Continue Watching" row above the home carousels.
 *
 * Why localStorage first (instead of Supabase):
 *   - zero latency, no API round-trip
 *   - works for anonymous users (no login required to track)
 *   - sufficient for v1; we'll sync to Supabase once the
 *     watchlist + profile work is solid
 *
 * The key is per-tab (one history per device/browser).
 */

const KEY = "movbox:history:v1";
const MAX_ITEMS = 12; // show at most 12 in the Continue Watching row

export interface WatchHistoryItem {
  /** Unique boxmovies detailPath (the "id" in our URL). */
  detailPath: string;
  /** "movie" | "tv" */
  type: "movie" | "tv";
  /** Display title. */
  title: string;
  /** For TV, which season/episode. For movies, undefined. */
  season?: number;
  episode?: number;
  /** Where the user paused. */
  currentTime: number;
  /** Total duration. */
  duration: number;
  /** URL to the show's poster. */
  posterUrl: string;
  /** Backdrop (16:9) image — better for the row. */
  backdropUrl: string;
  /** ms since epoch. */
  lastWatched: number;
}

function readAll(): WatchHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WatchHistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeAll(items: WatchHistoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    // Fire a custom event so the home page can re-render the row
    // when the user finishes an episode (no need to refresh).
    window.dispatchEvent(new CustomEvent("movbox:history:updated"));
  } catch {
    /* quota / disabled — silently skip */
  }
}

function keyFor(item: Pick<WatchHistoryItem, "detailPath" | "season" | "episode">) {
  // Movies: detailPath. TV: detailPath + season + episode.
  if (item.season == null || item.episode == null) return item.detailPath;
  return `${item.detailPath}#s${item.season}e${item.episode}`;
}

/**
 * Record a watch position. Called by the Player every 5s. We dedupe
 * by the (detailPath, season, episode) key — the latest progress
 * for a given show+episode replaces the older one. The list is
 * sorted by lastWatched desc and capped at MAX_ITEMS.
 */
export function recordProgress(
  item: Omit<WatchHistoryItem, "lastWatched" | "currentTime" | "duration"> & {
    currentTime: number;
    duration: number;
  },
): void {
  const list = readAll();
  const k = keyFor(item);
  // Drop if completed (>95% watched) — user finished it.
  const completed =
    item.duration > 0 && item.currentTime / item.duration > 0.95;
  if (completed) {
    writeAll(list.filter((it) => keyFor(it) !== k));
    return;
  }
  // Drop if barely started (<10s or <2%) — accidental click, not
  // a real "continue watching" intent.
  if (item.currentTime < 10 || item.duration > 0 && item.currentTime / item.duration < 0.02) {
    return;
  }
  const entry: WatchHistoryItem = {
    ...item,
    lastWatched: Date.now(),
  };
  const idx = list.findIndex((it) => keyFor(it) === k);
  if (idx >= 0) {
    list[idx] = entry;
  } else {
    list.unshift(entry);
  }
  // Sort newest first + cap.
  list.sort((a, b) => b.lastWatched - a.lastWatched);
  writeAll(list.slice(0, MAX_ITEMS));
}

/** Remove a single entry (e.g. user clicks "remove from history"). */
export function removeFromHistory(detailPath: string, season?: number, episode?: number): void {
  writeAll(
    readAll().filter(
      (it) => keyFor(it) !== keyFor({ detailPath, season, episode }),
    ),
  );
}

/** Clear all history. */
export function clearHistory(): void {
  writeAll([]);
}

/** Read all history items, newest first. SSR-safe (returns []). */
export function getHistory(): WatchHistoryItem[] {
  return readAll();
}

/**
 * Pretty-print the resume time. e.g. "12m left" or "23s left".
 * Returns null if there's no meaningful time left.
 */
export function formatResumeTime(item: WatchHistoryItem): string | null {
  if (!item.duration || item.duration <= 0) return null;
  const left = Math.max(0, item.duration - item.currentTime);
  if (left <= 0) return null;
  if (left < 60) return `${Math.round(left)}s left`;
  if (left < 3600) return `${Math.round(left / 60)}m left`;
  const h = Math.floor(left / 3600);
  const m = Math.round((left % 3600) / 60);
  return `${h}h ${m}m left`;
}

/**
 * Build the watch URL for a history item. Mirrors the route
 * structure in app/watch/[type]/[id]/page.tsx.
 */
export function buildWatchUrl(item: WatchHistoryItem): string {
  const base = `https://movbox.xyz/watch/${item.type}/${encodeURIComponent(item.detailPath)}`;
  if (item.season != null && item.episode != null) {
    return `${base}/${item.season}/${item.episode}`;
  }
  return base;
}
