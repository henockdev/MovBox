/**
 * Watchlist storage — localStorage based, no auth required.
 * Each entry: { id, type, title, posterPath, addedAt }
 * SSR-safe: every accessor checks `typeof window`.
 * Migrated from `hmovies:watchlist` to `movbox:watchlist` — we read
 * the legacy key for backwards compatibility, then re-save under the
 * new key on the next write.
 */

import type { MediaCard } from "./types";

const KEY = "movbox:watchlist";
const LEGACY_KEYS = ["hmovies:watchlist"];

export interface WatchlistEntry extends MediaCard {
  addedAt: number;
}

function readRaw(): WatchlistEntry[] {
  if (typeof window === "undefined") return [];
  // Try the new key first, then fall back to legacy keys (one-time migration)
  for (const key of [KEY, ...LEGACY_KEYS]) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      return parsed
        .filter(
          (e) =>
            e &&
            typeof e.id === "number" &&
            typeof e.type === "string" &&
            typeof e.title === "string"
        )
        .map((e) => ({
          id: e.id,
          type: e.type,
          title: e.title,
          posterPath: e.posterPath ?? null,
          backdropPath: e.backdropPath ?? null,
          year: e.year ?? "",
          rating: e.rating ?? 0,
          overview: e.overview ?? "",
          runtime: e.runtime ?? null,
          addedAt: e.addedAt ?? Date.now(),
        })) as WatchlistEntry[];
    } catch {
      /* ignore parse errors */
    }
  }
  return [];
}

function read(): WatchlistEntry[] {
  const entries = readRaw();
  // If we read from a legacy key, write through to the new key
  // (one-time migration).
  if (typeof window !== "undefined") {
    const hasNew = window.localStorage.getItem(KEY);
    if (!hasNew && entries.length > 0) {
      try { window.localStorage.setItem(KEY, JSON.stringify(entries)); } catch {}
    }
  }
  return entries;
}

function write(entries: WatchlistEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* quota / disabled storage — silently no-op */
  }
}

export function getWatchlist(): WatchlistEntry[] {
  return read();
}

export function isInWatchlist(id: string, type: "movie" | "tv"): boolean {
  return read().some((e) => e.id === id && e.type === type);
}

export function addToWatchlist(item: MediaCard): void {
  const list = read();
  if (list.some((e) => e.id === item.id && e.type === item.type)) return;
  list.unshift({
    id: item.id,
    type: item.type,
    title: item.title,
    posterPath: item.posterPath,
    backdropPath: item.backdropPath,
    year: item.year,
    rating: item.rating,
    overview: item.overview,
    addedAt: Date.now(),
  });
  write(list);
  window.dispatchEvent(new CustomEvent("movbox:watchlist-change"));
  window.dispatchEvent(new CustomEvent("hmovies:watchlist-change")); // legacy
}

export function removeFromWatchlist(id: string, type: "movie" | "tv"): void {
  write(read().filter((e) => !(e.id === id && e.type === type)));
  window.dispatchEvent(new CustomEvent("movbox:watchlist-change"));
  window.dispatchEvent(new CustomEvent("hmovies:watchlist-change")); // legacy
}

export function toggleWatchlist(item: MediaCard): boolean {
  if (isInWatchlist(item.id, item.type)) {
    removeFromWatchlist(item.id, item.type);
    return false;
  }
  addToWatchlist(item);
  return true;
}

export function clearWatchlist(): void {
  write([]);
  window.dispatchEvent(new CustomEvent("movbox:watchlist-change"));
  window.dispatchEvent(new CustomEvent("hmovies:watchlist-change")); // legacy
}
