"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Trash2, Film, Tv, Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MediaGrid } from "@/components/media/MediaGrid";
import {
  getUserWatchlist,
  clearUserWatchlist,
  removeUserWatchlist,
  migrateLocalWatchlistToSupabase,
  type WatchlistEntry,
} from "@/lib/user-data";
import { cn } from "@/lib/utils";

type Filter = "all" | "movie" | "tv";

const FILTERS: Array<{ id: Filter; label: string; icon: React.ElementType }> = [
  { id: "all", label: "All", icon: Heart },
  { id: "movie", label: "Movies", icon: Film },
  { id: "tv", label: "TV Shows", icon: Tv },
];

export function WatchlistClient() {
  const [items, setItems] = useState<WatchlistEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    async function load() {
      const list = await getUserWatchlist();
      if (cancelled) return;
      setItems(list);
      // One-time migration: if the user just signed in, push their
      // localStorage watchlist to supabase.
      migrateLocalWatchlistToSupabase().then((r) => {
        if (r.pushed > 0) console.log(`[watchlist] migrated ${r.pushed} items to supabase`);
      });
    }
    load();
    // Also listen to localStorage events for instant updates within
    // the same tab (e.g. when the user adds an item from the player).
    const handler = () => load();
    window.addEventListener("movbox:watchlist-change", handler);
    window.addEventListener("hmovies:watchlist-change", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("movbox:watchlist-change", handler);
      window.removeEventListener("hmovies:watchlist-change", handler);
    };
  }, []);

  const filtered = items.filter((m) => {
    if (filter === "all") return true;
    return m.type === filter;
  });

  const firstItem = items[0];

  if (!mounted) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded bg-surface" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
            My List
          </h1>
          <p className="mt-2 text-sm text-text-secondary md:text-base">
            {items.length === 0
              ? "Save movies and TV shows to watch later."
              : `${items.length} title${items.length !== 1 ? "s" : ""} saved`}
          </p>
        </div>
        {items.length > 0 && firstItem && (
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link
                href={
                  firstItem.type === "movie"
                    ? `/watch/movie/${firstItem.id}`
                    : `/tv/${firstItem.id}`
                }
              >
                <Play className="h-4 w-4 fill-current" />
                {firstItem.type === "movie" ? "Play First" : "Resume First"}
              </Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (confirm("Clear your entire watchlist?")) {
                  clearUserWatchlist();
                  setItems([]);
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Clear All
            </Button>
          </div>
        )}
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/30 py-20 text-center">
          <Heart className="h-12 w-12 text-text-muted" />
          <p className="mt-4 font-display text-lg text-cream">
            Your list is empty
          </p>
          <p className="mt-1 max-w-sm text-sm text-text-muted">
            Browse movies and TV shows, then tap the + icon to add them here.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/movies">Browse Movies</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/tv">Browse TV Shows</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Filter pills */}
          <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4">
            {FILTERS.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    filter === f.id
                      ? "border-accent bg-accent text-cream"
                      : "border-border bg-surface/40 text-text-secondary hover:border-accent/60 hover:text-cream"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {f.label}
                  <span className="text-xs opacity-70">
                    ({f.id === "all" ? items.length : items.filter((i) => i.type === f.id).length})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick remove section header */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              {filter === "all" ? "All Saved" : filter === "movie" ? "Movies" : "TV Shows"}
            </h2>
            <Badge variant="default">{filtered.length}</Badge>
          </div>

          <MediaGrid
            items={filtered}
            emptyMessage="No items in this category."
          />

          {/* Inline remove all small links */}
          {filtered.length > 0 && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => {
                  filtered.forEach((i) => removeUserWatchlist(i));
                }}
                className="text-xs text-text-muted underline-offset-2 hover:text-error hover:underline"
              >
                Remove all {filter === "all" ? "items" : filter === "movie" ? "movies" : "TV shows"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
