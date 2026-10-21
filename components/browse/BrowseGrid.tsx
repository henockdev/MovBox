"use client";

/**
 * BrowseGrid — paginated grid of cards for /movies, /tv, /animations.
 * Uses the existing MovieCard so the look & feel matches the rest of
 * the site. Skeleton + empty-state included. Infinite-scroll:
 *
 *   - A sentinel <div> at the bottom of the grid watches itself.
 *   - When the sentinel enters the viewport, the parent calls
 *     onPage(nextPage) which appends the next page to the existing list.
 *   - The parent resets items to [] whenever filters change.
 *
 * "Load more" button is the manual fallback in case IO is unavailable
 * (older browsers, prefers-reduced-motion users, etc).
 */

import { useEffect, useRef } from "react";
import { MovieCard } from "@/components/home/MovieCard";
import type { BoxMediaCard } from "@/lib/types";
import { toMediaCard } from "@/lib/adapters";

export interface BrowseGridProps {
  items: BoxMediaCard[];
  loading: boolean;
  hasMore: boolean;
  page: number;
  onPage: (next: number) => void;
  totalCount?: number | null;
  /** Heading shown above the grid. */
  title?: string;
  /** What to show in the empty state. */
  emptyLabel?: string;
}

export function BrowseGrid({
  items,
  loading,
  hasMore,
  page,
  onPage,
  totalCount,
  title,
  emptyLabel = "No results match these filters.",
}: BrowseGridProps) {
  // NO scroll-to-top on page change — that's for paginated flows and
  // it broke infinite scroll by yanking the user back to the top every
  // time the sentinel triggered the next fetch. The infinite scroll
  // contract is: stay where you are, append the next batch.

  // IntersectionObserver — fires when the sentinel enters the viewport.
  // Appends the next page (parent merges it into `items`).
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onPage(page + 1);
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, page, onPage]);

  if (items.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/30 px-6 py-20 text-center">
        <div className="text-5xl">🎬</div>
        <h3 className="mt-4 text-lg font-semibold text-zinc-200">
          Nothing here yet
        </h3>
        <p className="mt-2 max-w-md text-sm text-zinc-500">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div>
      {(title || totalCount != null) && (
        <div className="mb-4 flex items-end justify-between gap-3">
          {title && (
            <h2 className="text-lg font-bold text-cream sm:text-xl">{title}</h2>
          )}
          {totalCount != null && (
            <div className="text-[11px] text-zinc-500">
              {totalCount.toLocaleString()} titles
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-4 md:gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {(() => {
          // Dedup by detailPath — some sections in boxmovies home
          // share items, and the cache + infinite scroll can
          // re-introduce dupes. Keep first occurrence.
          const seen = new Set<string>();
          const out: typeof items = [];
          for (const c of items) {
            if (!c.detailPath || seen.has(c.detailPath)) continue;
            seen.add(c.detailPath);
            out.push(c);
          }
          return out.map((c) => (
            <MovieCard key={c.detailPath} media={toMediaCard(c)} />
          ));
        })()}
        {loading &&
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`sk-${i}`}
              className="aspect-[2/3] animate-pulse rounded-lg bg-zinc-900/60"
            />
          ))}
      </div>

      {/* Infinite-scroll sentinel — invisible until near the bottom of the grid. */}
      {hasMore && (
        <div
          ref={sentinelRef}
          aria-hidden
          className="mt-8 flex h-10 items-center justify-center text-[11px] text-zinc-500"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 animate-pulse rounded-full bg-accent-bright" />
              Loading more…
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onPage(page + 1)}
              className="rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
            >
              Load more
            </button>
          )}
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div className="mt-8 flex items-center justify-center text-[11px] text-zinc-500">
          You've reached the end.
        </div>
      )}
    </div>
  );
}
